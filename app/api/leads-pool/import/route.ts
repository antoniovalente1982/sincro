import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import * as XLSX from 'xlsx'

// Next.js route segment config — aumenta limite upload a 50MB
export const maxDuration = 60  // max 60s (per file grandi)

// POST /api/leads-pool/import
// Carica un file CSV/XLSX/JSON e inserisce i lead nel pool
// Accetta multipart/form-data con: file, list_name, list_id (opzionale)

// Mappa automatica colonne → campi sistema (case-insensitive, supporta aliases italiani/inglesi)
// Calibrata sul formato specifico del file leads Metodo Sincro
const COLUMN_ALIASES: Record<string, string> = {
    // ── Nome ──
    'nome': 'full_name',            // colonna principale del file
    'name': 'first_name', 'first name': 'first_name', 'firstname': 'first_name',
    'cognome': 'last_name', 'surname': 'last_name', 'last name': 'last_name', 'lastname': 'last_name',
    'nome e cognome': 'full_name', 'full name': 'full_name', 'fullname': 'full_name',
    'nominativo': 'full_name', 'nome completo': 'full_name', 'cliente': 'full_name',

    // ── Telefono ──
    'telefono': 'phone', 'tel': 'phone', 'phone': 'phone', 'cellulare': 'phone',
    'mobile': 'phone', 'cell': 'phone', 'numero': 'phone', 'numero di telefono': 'phone',
    'cell.': 'phone', 'tel.': 'phone', 'phone number': 'phone', 'numero telefono': 'phone',

    // ── Email ──
    'email': 'email', 'mail': 'email', 'e-mail': 'email', 'posta elettronica': 'email',

    // ── Città / Provincia ──
    'città': 'city', 'citta': 'city', 'city': 'city', 'comune': 'city', 'residenza': 'city',
    'provincia': 'province', 'prov': 'province', 'province': 'province', 'prov.': 'province',

    // ── Età / Genere ──
    'età': 'age', 'eta': 'age', 'age': 'age', 'anni': 'age',
    'sesso': 'gender', 'genere': 'gender', 'gender': 'gender', 'sex': 'gender',

    // ── Punteggio / Priorità (specifico file Metodo Sincro) ──
    'punteggio': 'priority_score',   // valore 0-100 → normalizziamo a 0.0-1.0
    'score': 'priority_score', 'lead score': 'priority_score', 'punteggio lead': 'priority_score',
    'priorità': 'lead_priority',     // P1 - Massima priorità, P2, ecc. → note
    'priorita': 'lead_priority', 'priority': 'lead_priority',

    // ── Temperatura (specifico file Metodo Sincro) ──
    'temperatura (email list)': 'temperature',
    'temperatura': 'temperature', 'temperature': 'temperature', 'temp': 'temperature',
    'caldo/freddo': 'temperature',

    // ── Note / Storico ──
    'note': 'notes', 'notes': 'notes', 'annotazioni': 'notes', 'commenti': 'notes', 'comments': 'notes',
    'storico/note': 'notes', 'storico note': 'notes', 'storico': 'notes',

    // ── Fonte / Provenienza ──
    'venditore storico': 'source',   // es. appuntamenti.metodosincro, nan, Jacob Dridi
    'fonte': 'source', 'source': 'source', 'provenienza': 'source', 'canale': 'source',
    'origine/fonte': 'utm_source',   // specifico file Metodo Sincro
    'origine': 'utm_source', 'origin': 'utm_source',
    'fonti dati (storico)': 'utm_campaign',  // testo lungo archivio → utm_campaign (raw)
    'fonti dati storico': 'utm_campaign', 'fonti dati': 'utm_campaign',

    // ── UTM standard ──
    'campagna': 'utm_campaign', 'campaign': 'utm_campaign', 'utm_campaign': 'utm_campaign',
    'utm source': 'utm_source', 'utm_source': 'utm_source',
    'utm medium': 'utm_medium', 'utm_medium': 'utm_medium',

    // ── Ultimo contatto (raw) ──
    'ultimo contatto': 'last_contact_raw',
    'data contatto': 'last_contact_raw', 'last contact': 'last_contact_raw',
}

function mapColumn(rawKey: string): string {
    const normalized = rawKey.toLowerCase().trim()
    return COLUMN_ALIASES[normalized] || 'raw_extra'
}

// Valori "vuoti" da trattare come null (incluso 'nan' di pandas/Excel)
const NULL_VALUES = new Set(['nan', 'none', 'null', 'n/a', 'n.a.', 'nd', '-', ''])
function sanitize(val: any): string | null {
    if (val === null || val === undefined) return null
    const s = String(val).trim()
    return NULL_VALUES.has(s.toLowerCase()) ? null : s
}

function normalizeRow(row: Record<string, any>): Record<string, any> {
    const mapped: Record<string, any> = {}
    const raw: Record<string, any> = {}

    for (const [key, value] of Object.entries(row)) {
        const field = mapColumn(key)

        if (field === 'raw_extra') {
            raw[key] = value
            continue
        }

        // Campi speciali con logica dedicata
        if (field === 'age') {
            mapped[field] = parseInt(String(value)) || null
            continue
        }

        if (field === 'priority_score') {
            // Punteggio 0-100 → normalizza a 0.0-1.0
            const score = parseFloat(String(value))
            mapped[field] = isNaN(score) ? 0.5 : Math.min(1, Math.max(0, score / 100))
            continue
        }

        if (field === 'lead_priority') {
            // P1 - Massima priorità → aggiungiamo alle note con prefisso
            const cleaned = sanitize(value)
            if (cleaned) {
                mapped['notes'] = [mapped['notes'], `Priorità: ${cleaned}`].filter(Boolean).join(' | ')
            }
            continue
        }

        if (field === 'temperature') {
            // caldo/medio/freddo → conserva in raw_data e aggiunge alla fonte
            raw['temperatura'] = sanitize(value)
            continue
        }

        if (field === 'last_contact_raw') {
            // Data ultimo contatto → conserva in raw_data
            raw['ultimo_contatto'] = sanitize(value)
            continue
        }

        if (field === 'phone') {
            // Normalizza telefono: rimuovi spazi extra, mantieni +39
            const cleaned = sanitize(value)
            if (cleaned) {
                mapped[field] = cleaned.replace(/\s+/g, '').replace(/^\+39/, '+39')
            } else {
                mapped[field] = null
            }
            continue
        }

        // Tutti gli altri campi stringa
        mapped[field] = sanitize(value)
    }

    // Build full_name se non presente ma first+last ci sono
    if (!mapped.full_name && (mapped.first_name || mapped.last_name)) {
        mapped.full_name = [mapped.first_name, mapped.last_name].filter(Boolean).join(' ')
    }

    // Se source è 'nan' o simile, pulisci
    if (mapped.source && NULL_VALUES.has(String(mapped.source).toLowerCase())) {
        mapped.source = null
    }

    // Merge raw_data
    mapped.raw_data = { ...raw }
    if (row.orig_sheet_name) {
        mapped.raw_data.orig_sheet_name = row.orig_sheet_name
    }
    return mapped
}

async function parseFile(buffer: Buffer, mimeType: string, fileName: string): Promise<Record<string, any>[]> {
    const ext = fileName.split('.').pop()?.toLowerCase() || ''

    // JSON
    if (ext === 'json' || mimeType.includes('json')) {
        const text = buffer.toString('utf-8')
        const parsed = JSON.parse(text)
        return Array.isArray(parsed) ? parsed : [parsed]
    }

    // CSV or XLSX/XLS — use xlsx library which handles both
    const workbook = XLSX.read(buffer, { type: 'buffer', cellText: true, cellDates: true })
    const allRows: Record<string, any>[] = []

    for (const sheetName of workbook.SheetNames) {
        const sheet = workbook.Sheets[sheetName]
        const rows = XLSX.utils.sheet_to_json(sheet, { defval: null, raw: false }) as Record<string, any>[]
        
        if (rows.length === 0) continue

        // Check if sheet contains lead-like headers
        const firstRowKeys = Object.keys(rows[0] || {})
        const hasLeadHeaders = firstRowKeys.some(key => {
            const mapped = mapColumn(key)
            return mapped === 'full_name' || mapped === 'first_name' || mapped === 'phone' || mapped === 'email'
        })

        // Skip instructions sheets or summary sheets that have no mapped columns
        if (!hasLeadHeaders) {
            console.log(`Skipping sheet ${sheetName}: no lead headers found.`)
            continue
        }

        // Add sheet name source to each row
        rows.forEach(r => {
            r['orig_sheet_name'] = sheetName
        })
        allRows.push(...rows)
    }

    return allRows
}

async function requireAdmin(supabase: any) {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { error: 'Non autorizzato', status: 401 }
    const { data: member } = await supabase
        .from('organization_members')
        .select('organization_id, role')
        .eq('user_id', user.id)
        .is('deactivated_at', null)
        .single()
    if (!member || !['owner', 'admin', 'manager'].includes(member.role)) {
        return { error: 'Solo admin/manager possono importare leads', status: 403 }
    }
    return { user, member, orgId: member.organization_id }
}

export async function POST(request: Request) {
    const supabase = await createClient()
    const auth = await requireAdmin(supabase)
    if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status as number })

    const { user, orgId } = auth

    let formData: FormData
    try {
        formData = await request.formData()
    } catch {
        return NextResponse.json({ error: 'Richiesta non valida: atteso multipart/form-data' }, { status: 400 })
    }

    const file = formData.get('file') as File | null
    const listName = (formData.get('list_name') as string) || `Import ${new Date().toLocaleDateString('it-IT')}`
    const listId = formData.get('list_id') as string | null
    const tagsRaw = formData.get('tags') as string | null
    const tags = tagsRaw ? tagsRaw.split(',').map(t => t.trim()).filter(Boolean) : []

    if (!file) {
        return NextResponse.json({ error: 'File non fornito' }, { status: 400 })
    }

    const fileName = file.name
    const mimeType = file.type
    const buffer = Buffer.from(await file.arrayBuffer())

    // Parse file
    let rows: Record<string, any>[]
    try {
        rows = await parseFile(buffer, mimeType, fileName)
    } catch (e: any) {
        return NextResponse.json({ error: `Errore parsing file: ${e.message}` }, { status: 422 })
    }

    if (rows.length === 0) {
        return NextResponse.json({ error: 'Il file è vuoto o non ha righe valide' }, { status: 422 })
    }

    // Determine format
    const ext = fileName.split('.').pop()?.toLowerCase() || 'csv'
    const sourceFormat = ['xlsx', 'xls'].includes(ext) ? 'xlsx' : ext === 'json' ? 'json' : 'csv'

    // Create or get list
    let resolvedListId = listId
    if (!resolvedListId) {
        const { data: newList, error: listError } = await supabase
            .from('lead_lists')
            .insert({
                organization_id: orgId,
                name: listName,
                source_format: sourceFormat,
                uploaded_by: user.id,
                tags,
                metadata: { original_filename: fileName, columns: Object.keys(rows[0] || {}) },
                total_count: 0,
                available_count: 0,
            })
            .select()
            .single()

        if (listError || !newList) {
            return NextResponse.json({ error: 'Errore creazione lista', detail: listError?.message }, { status: 500 })
        }
        resolvedListId = newList.id
    }

    // Normalize rows and prepare batch insert
    const now = new Date().toISOString()
    const insertRows = rows.map(row => {
        const normalized = normalizeRow(row)
        return {
            organization_id: orgId,
            list_id: resolvedListId,
            first_name: normalized.first_name || null,
            last_name: normalized.last_name || null,
            full_name: normalized.full_name || null,
            phone: normalized.phone || null,
            email: normalized.email || null,
            city: normalized.city || null,
            province: normalized.province || null,
            age: normalized.age || null,
            gender: normalized.gender || null,
            notes: normalized.notes || null,
            source: normalized.source || null,
            utm_campaign: normalized.utm_campaign || null,
            utm_source: normalized.utm_source || null,
            utm_medium: normalized.utm_medium || null,
            raw_data: normalized.raw_data || {},
            status: 'available',
            // Usa il punteggio dal file (già normalizzato 0-1), altrimenti 0.5
            priority_score: normalized.priority_score ?? 0.5,
            created_at: now,
            updated_at: now,
        }
    }).filter(r => r.phone || r.email || r.full_name) // Skip completamente vuote


    if (insertRows.length === 0) {
        return NextResponse.json({ error: 'Nessuna riga valida trovata (serve almeno telefono, email o nome)' }, { status: 422 })
    }

    // Batch insert in chunks of 500
    const CHUNK_SIZE = 500
    let insertedCount = 0
    const errors: string[] = []

    for (let i = 0; i < insertRows.length; i += CHUNK_SIZE) {
        const chunk = insertRows.slice(i, i + CHUNK_SIZE)
        const { data, error } = await supabase
            .from('lead_pool')
            .insert(chunk)
            .select('id')

        if (error) {
            errors.push(`Chunk ${Math.floor(i / CHUNK_SIZE) + 1}: ${error.message}`)
        } else {
            insertedCount += data?.length || 0
        }
    }

    // Update list counts
    const { data: availCount } = await supabase
        .from('lead_pool')
        .select('id', { count: 'exact' })
        .eq('list_id', resolvedListId)
        .eq('status', 'available')

    await supabase
        .from('lead_lists')
        .update({
            total_count: insertedCount,
            available_count: (availCount as any)?.length || insertedCount,
            updated_at: now,
        })
        .eq('id', resolvedListId)

    return NextResponse.json({
        success: true,
        list_id: resolvedListId,
        parsed_rows: rows.length,
        inserted: insertedCount,
        skipped: rows.length - insertRows.length,
        errors: errors.length > 0 ? errors : undefined,
        columns_detected: Object.keys(rows[0] || {}),
        preview: insertRows.slice(0, 3).map(r => ({
            full_name: r.full_name,
            phone: r.phone,
            email: r.email,
            city: r.city,
        })),
    })
}

// GET /api/leads-pool/import — list available lists
export async function GET() {
    const supabase = await createClient()
    const auth = await requireAdmin(supabase)
    if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status as number })

    const { data: lists } = await supabase
        .from('lead_lists')
        .select('*')
        .eq('organization_id', auth.orgId)
        .order('created_at', { ascending: false })

    return NextResponse.json({ lists: lists || [] })
}
