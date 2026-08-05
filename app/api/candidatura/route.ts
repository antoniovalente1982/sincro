import { NextRequest, NextResponse } from 'next/server'
import { after } from 'next/server'
import { promises as fs } from 'fs'
import os from 'os'
import path from 'path'
import { syncContact, addToList, applyTagByName, addContactNote } from '@/lib/activecampaign'
import { sendTelegramMessage } from '@/lib/telegram'
import { sendCandidaturaNotification } from '@/lib/email'

// Endpoint pubblico della pagina /candidatura (lancio 24 agosto 2026).
//
// Regola numero uno: una candidatura non si perde MAI. Prima di qualunque
// chiamata esterna la submission viene scritta nei log (e su file, dove il
// filesystem è scrivibile); ActiveCampaign, Telegram e la mail interna girano
// dopo la risposta e possono fallire senza portarsi via il dato.

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Organizzazione Metodo Sincro — serve per risolvere le credenziali Telegram
const MS_ORG_ID = 'a5dd4842-f0ea-4909-b4a3-be2cb1c6ffa5'

const TAG_CANDIDATO = 'lancio26-candidato'
const TAG_LISTA_ATTESA = 'lancio26-lista-attesa'

// Opzionale: se valorizzata, i candidati vengono anche iscritti a una lista AC.
// Il tag da solo fa partire l'automazione, ma un contatto senza liste non può
// ricevere invii: valorizzarla se i candidati devono entrare in una sequenza.
const AC_LIST_ID = process.env.CANDIDATURA_AC_LIST_ID
    ? Number(process.env.CANDIDATURA_AC_LIST_ID)
    : null

const LIVELLI = [
    'Scuola calcio',
    'Agonistica dilettanti',
    'Settore giovanile professionistico',
    'Professionista',
]

// Rate limiting per IP — stessa logica di /api/submit
const rateLimits = new Map<string, { count: number; resetAt: number }>()
const RATE_LIMIT = 10
const RATE_WINDOW = 60_000

type Candidatura = {
    tipo: 'candidatura' | 'lista-attesa'
    nome: string
    email: string
    telefono: string
    etaFiglio: string
    livello: string
    difficolta: string
    utm: Record<string, string>
    landingUrl: string
    ricevutaIl: string
    ip: string
}

export async function POST(req: NextRequest) {
    const ip =
        req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
        req.headers.get('x-real-ip') ||
        'unknown'

    const now = Date.now()
    const entry = rateLimits.get(ip)
    if (entry && now < entry.resetAt && entry.count >= RATE_LIMIT) {
        return NextResponse.json(
            { error: 'Troppe richieste. Riprova fra un minuto.' },
            { status: 429 }
        )
    }
    if (!entry || now > (entry?.resetAt || 0)) {
        rateLimits.set(ip, { count: 1, resetAt: now + RATE_WINDOW })
    } else {
        entry.count++
    }

    let body: Record<string, unknown>
    try {
        body = await req.json()
    } catch {
        return NextResponse.json({ error: 'Richiesta non valida' }, { status: 400 })
    }

    const tipo = body.tipo === 'lista-attesa' ? 'lista-attesa' : 'candidatura'

    const email = String(body.email || '').trim().toLowerCase()
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return NextResponse.json({ error: "Inserisci un'email valida" }, { status: 400 })
    }

    const nome = String(body.nome || '').trim()
    const telefono = String(body.telefono || '').trim()
    const etaFiglio = String(body.etaFiglio || '').trim()
    const livello = String(body.livello || '').trim()
    const difficolta = String(body.difficolta || '').trim().slice(0, 500)

    if (tipo === 'candidatura') {
        if (nome.length < 2) {
            return NextResponse.json({ error: 'Inserisci nome e cognome' }, { status: 400 })
        }
        if (telefono.replace(/\D/g, '').length < 8) {
            return NextResponse.json({ error: 'Inserisci un numero di cellulare valido' }, { status: 400 })
        }
        const eta = Number(etaFiglio)
        if (!Number.isInteger(eta) || eta < 10 || eta > 20) {
            return NextResponse.json({ error: "Seleziona l'età di tuo figlio" }, { status: 400 })
        }
        if (!LIVELLI.includes(livello)) {
            return NextResponse.json({ error: 'Seleziona il livello' }, { status: 400 })
        }
        if (difficolta.length < 3) {
            return NextResponse.json({ error: 'Raccontaci la difficoltà principale' }, { status: 400 })
        }
        if (body.privacy !== true) {
            return NextResponse.json({ error: 'Serve il consenso al trattamento dei dati' }, { status: 400 })
        }
    }

    const utmIn = (body.utm ?? {}) as Record<string, unknown>
    const utm: Record<string, string> = {}
    for (const k of ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term']) {
        const v = utmIn[k]
        if (v) utm[k] = String(v).slice(0, 200)
    }

    const candidatura: Candidatura = {
        tipo,
        nome,
        email,
        telefono,
        etaFiglio,
        livello,
        difficolta,
        utm,
        landingUrl: String(body.landing_url || 'landing.metodosincro.com/candidatura').slice(0, 300),
        ricevutaIl: new Date().toISOString(),
        ip,
    }

    // ── 1. Persistenza prima di tutto ──────────────────────────────
    // Sincrona e attesa: se qui va storto tutto il resto, il dato c'è comunque.
    await persistiSubmission(candidatura)

    // ── 2. Il resto dopo la risposta ───────────────────────────────
    after(async () => {
        const esitoAc = await sincronizzaConActiveCampaign(candidatura)
        await notifica(candidatura, esitoAc)
    })

    return NextResponse.json({ success: true })
}

/**
 * Log strutturato + append su file. Il file su Vercel è effimero (`/tmp`), ma
 * il log resta e la notifica porta comunque tutti i dati: tre reti, non una.
 */
async function persistiSubmission(c: Candidatura) {
    console.log(`[CANDIDATURA] ${JSON.stringify(c)}`)

    try {
        const file = process.env.CANDIDATURA_LOG_PATH || path.join(os.tmpdir(), 'candidature.jsonl')
        await fs.appendFile(file, JSON.stringify(c) + '\n', 'utf8')
    } catch (err) {
        // Filesystem in sola lettura: il console.log sopra è già la copia buona.
        console.warn('[CANDIDATURA] Append su file non riuscito:', err)
    }
}

type EsitoAc = { ok: true; contactId: string } | { ok: false; motivo: string }

async function sincronizzaConActiveCampaign(c: Candidatura): Promise<EsitoAc> {
    const tagName = c.tipo === 'lista-attesa' ? TAG_LISTA_ATTESA : TAG_CANDIDATO
    const tagDescr =
        c.tipo === 'lista-attesa'
            ? 'Ha lasciato l\'email a candidature chiuse: avvisare alla riapertura di ottobre.'
            : 'Ha compilato la candidatura alla chiamata gratuita di 20 minuti con un coach.'

    try {
        const parti = c.nome.split(' ').filter(Boolean)
        const contactId = await syncContact({
            email: c.email,
            firstName: parti[0] || undefined,
            lastName: parti.slice(1).join(' ') || undefined,
            phone: c.telefono || undefined,
        })

        if (!contactId) return { ok: false, motivo: 'nessun ID contatto restituito' }

        if (AC_LIST_ID) {
            await addToList(contactId, AC_LIST_ID).catch((err) =>
                console.error('[AC] Iscrizione alla lista fallita:', err)
            )
        }

        const tagApplicato = await applyTagByName(contactId, tagName, tagDescr)

        // Le risposte del form vivono nella nota: è quello che il coach legge
        // prima di chiamare.
        if (c.tipo === 'candidatura') {
            await addContactNote(contactId, notaPerIlCoach(c)).catch((err) =>
                console.error('[AC] Nota non salvata:', err)
            )
        }

        if (!tagApplicato) return { ok: false, motivo: `tag "${tagName}" non applicato` }

        return { ok: true, contactId }
    } catch (err) {
        console.error('[AC] Sync candidatura fallita:', err)
        return { ok: false, motivo: err instanceof Error ? err.message : String(err) }
    }
}

function notaPerIlCoach(c: Candidatura): string {
    const quando = new Date(c.ricevutaIl).toLocaleString('it-IT', {
        timeZone: 'Europe/Rome',
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    })
    const fonte = Object.entries(c.utm).map(([k, v]) => `${k}=${v}`).join(' · ')

    return [
        'CANDIDATURA CHIAMATA 20 MINUTI — lancio agosto 2026',
        `Genitore: ${c.nome}`,
        `Cellulare/WhatsApp: ${c.telefono}`,
        `Età del figlio: ${c.etaFiglio} anni`,
        `Livello: ${c.livello}`,
        '',
        'Difficoltà principale (parole sue):',
        c.difficolta,
        '',
        `Inviata il ${quando}`,
        fonte ? `Fonte: ${fonte}` : 'Fonte: non tracciata',
    ].join('\n')
}

async function notifica(c: Candidatura, esito: EsitoAc) {
    const esc = (s: string) =>
        s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

    const rigaAc = esito.ok
        ? `\n\n✅ <b>ActiveCampaign:</b> contatto sincronizzato e taggato`
        : `\n\n⚠️ <b>ActiveCampaign:</b> sync FALLITA (${esc(esito.motivo)}) — va aggiunto a mano`

    const fonte = Object.entries(c.utm).map(([k, v]) => `${k}=${v}`).join(' · ')

    const messaggio =
        c.tipo === 'lista-attesa'
            ? `📋 <b>LISTA D'ATTESA</b> (candidature chiuse)\n\n` +
              `📧 <b>Email:</b> ${esc(c.email)}\n` +
              (fonte ? `📡 <b>Fonte:</b> ${esc(fonte)}` : '') +
              rigaAc
            : `🔥 <b>NUOVA CANDIDATURA ALLA CHIAMATA!</b>\n\n` +
              `👤 <b>Genitore:</b> ${esc(c.nome)}\n` +
              `📧 <b>Email:</b> ${esc(c.email)}\n` +
              `📱 <b>WhatsApp:</b> ${esc(c.telefono)}\n` +
              `🎂 <b>Età figlio:</b> ${esc(c.etaFiglio)} anni\n` +
              `⚽ <b>Livello:</b> ${esc(c.livello)}\n\n` +
              `💬 <b>Difficoltà:</b> ${esc(c.difficolta)}\n` +
              (fonte ? `\n📡 <b>Fonte:</b> ${esc(fonte)}` : '') +
              rigaAc

    await Promise.allSettled([
        sendTelegramMessage(MS_ORG_ID, messaggio).catch((err) =>
            console.error('[CANDIDATURA] Telegram fallito:', err)
        ),
        sendCandidaturaNotification({
            tipo: c.tipo,
            nome: c.nome,
            email: c.email,
            telefono: c.telefono,
            etaFiglio: c.etaFiglio,
            livello: c.livello,
            difficolta: c.difficolta,
            fonte,
            acOk: esito.ok,
            acMotivo: esito.ok ? undefined : esito.motivo,
        }).catch((err) => console.error('[CANDIDATURA] Email interna fallita:', err)),
    ])
}
