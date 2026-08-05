/**
 * lib/activecampaign.ts
 * 
 * Utility per l'integrazione con ActiveCampaign REST API v3.
 * Usato server-side (mai nel browser — la API key è privata).
 * 
 * Flusso standard per ogni nuova registrazione:
 *   1. syncContact()     → crea o aggiorna il contatto (upsert via /contact/sync)
 *   2. addToList()       → aggiunge il contatto alla lista specificata
 *   3. applyTag()        → applica il tag specificato
 */

/**
 * Come leggere gli errori di questo account (verificato sul campo il 5/8/2026):
 *   403 con corpo VUOTO → la chiave è sbagliata, troncata o incollata con le
 *                         virgolette attorno. Uno spazio in coda invece passa.
 *   404                 → il base URL non finisce con `/api/3`.
 * Sono due sintomi distinti: non confonderli, costano un lancio.
 *
 * La chiave viene ripulita da spazi e da eventuali virgolette: nessuna chiave
 * AC le contiene, e incollarle dal pannello di Vercel è l'errore più facile
 * da fare e il più difficile da vedere.
 */
const AC_API_KEY = (process.env.ACTIVECAMPAIGN_API_KEY || '')
  .trim()
  .replace(/^["']|["']$/g, '')

/**
 * Normalizza il base URL così il codice funziona con qualunque variante
 * dell'env: con o senza `/api/3`, con o senza slash finale, con spazi
 * copiati per sbaglio.
 */
function normalizeAcBaseUrl(raw: string): string {
  let base = raw.trim().replace(/\/+$/, '')
  if (base && !/\/api\/3$/.test(base)) base += '/api/3'
  return base
}

const AC_BASE_URL = normalizeAcBaseUrl(process.env.ACTIVECAMPAIGN_BASE_URL || '')

function acConfigured(): boolean {
  return Boolean(AC_API_KEY && AC_BASE_URL)
}

async function acGet(endpoint: string): Promise<Record<string, unknown> | null> {
  if (!acConfigured()) {
    console.warn('[AC] Missing ACTIVECAMPAIGN_API_KEY or ACTIVECAMPAIGN_BASE_URL — skipping')
    return null
  }

  const res = await fetch(`${AC_BASE_URL}/${endpoint}`, {
    headers: { 'Api-Token': AC_API_KEY },
  })

  if (!res.ok) {
    const errText = await res.text()
    throw new Error(`[AC] GET ${endpoint} → HTTP ${res.status}: ${errText}`)
  }

  return res.json()
}

async function acPost(endpoint: string, payload: unknown): Promise<any> {
  if (!acConfigured()) {
    console.warn('[AC] Missing ACTIVECAMPAIGN_API_KEY or ACTIVECAMPAIGN_BASE_URL — skipping')
    return null
  }

  const res = await fetch(`${AC_BASE_URL}/${endpoint}`, {
    method: 'POST',
    headers: {
      'Api-Token': AC_API_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  })

  if (!res.ok) {
    const errText = await res.text()
    // URL e lunghezza della chiave (mai la chiave) nell'errore: bastano a
    // distinguere path sbagliato da credenziale sbagliata senza altri test.
    const indizio = errText.trim() || `corpo vuoto · chiave di ${AC_API_KEY.length} caratteri`
    throw new Error(`[AC] POST ${AC_BASE_URL}/${endpoint} → HTTP ${res.status}: ${indizio.slice(0, 300)}`)
  }

  return res.json()
}

/**
 * Crea o aggiorna un contatto in ActiveCampaign.
 * Sicuro da chiamare sempre — se esiste già, aggiorna invece di duplicare.
 * 
 * @returns L'ID numerico del contatto in ActiveCampaign
 */
export async function syncContact(params: {
  email: string
  firstName?: string
  lastName?: string
  phone?: string
}): Promise<string | null> {
  const { email, firstName, lastName, phone } = params

  const contact: Record<string, string> = { email }
  if (firstName) contact.firstName = firstName
  if (lastName) contact.lastName = lastName
  if (phone) contact.phone = phone

  const data = await acPost('contact/sync', { contact })
  const contactId = data?.contact?.id

  if (!contactId) {
    console.error('[AC] syncContact: no ID returned', data)
    return null
  }

  console.log(`[AC] Contact synced → ID ${contactId} (${email})`)
  return String(contactId)
}

/**
 * Aggiunge un contatto a una lista.
 * status 1 = iscritto, 2 = disiscritto
 */
export async function addToList(contactId: string, listId: number): Promise<void> {
  await acPost('contactLists', {
    contactList: { list: listId, contact: contactId, status: 1 },
  })
  console.log(`[AC] Contact ${contactId} → lista ${listId}`)
}

/**
 * Applica un tag a un contatto.
 * Questo fa scattare le automazioni configurate su quel tag.
 */
export async function applyTag(contactId: string, tagId: number): Promise<void> {
  await acPost('contactTags', {
    contactTag: { contact: contactId, tag: tagId },
  })
  console.log(`[AC] Contact ${contactId} → tag ${tagId}`)
}

/**
 * Risolve un tag per NOME, creandolo se non esiste.
 *
 * Serve alle pagine che applicano tag nuovi (es. la candidatura alla chiamata):
 * l'ID non è noto in anticipo e il tag potrebbe non essere ancora stato creato
 * a mano nell'editor di ActiveCampaign.
 *
 * Gli ID risolti restano in cache per la vita del processo — il nome di un tag
 * non cambia in corsa e così si evita una GET per ogni submission.
 */
const tagIdCache = new Map<string, number>()

export async function getOrCreateTagId(name: string, description = ''): Promise<number | null> {
  if (!acConfigured()) return null

  const cached = tagIdCache.get(name)
  if (cached) return cached

  const find = async (): Promise<number | null> => {
    // Il filtro `search` su questo account è inaffidabile: lo passiamo comunque
    // ma il match esatto lo facciamo noi sui risultati.
    const data = await acGet(`tags?filters[search][eq]=${encodeURIComponent(name)}&limit=100`)
    const tags = (data?.tags as { id?: string; tag?: string }[] | undefined) || []
    const match = tags.find((t) => t.tag === name)
    return match?.id ? Number(match.id) : null
  }

  try {
    let id = await find()

    if (!id) {
      const created = await acPost('tags', {
        tag: { tag: name, tagType: 'contact', description },
      }).catch(async (err) => {
        // Corsa fra due submission simultanee: se l'ha creato l'altra, rileggiamo.
        console.warn(`[AC] Creazione tag "${name}" fallita, riprovo a leggerlo:`, err)
        return null
      })
      id = created?.tag?.id ? Number(created.tag.id) : await find()
      if (id) console.log(`[AC] Tag "${name}" creato → ID ${id}`)
    }

    if (!id) {
      console.error(`[AC] Impossibile risolvere o creare il tag "${name}"`)
      return null
    }

    tagIdCache.set(name, id)
    return id
  } catch (err) {
    console.error(`[AC] getOrCreateTagId("${name}") fallita:`, err)
    return null
  }
}

/**
 * Applica un tag a un contatto usando il nome invece dell'ID.
 * Crea il tag se manca. Ritorna false se non è stato possibile applicarlo.
 */
export async function applyTagByName(
  contactId: string,
  tagName: string,
  description = ''
): Promise<boolean> {
  const tagId = await getOrCreateTagId(tagName, description)
  if (!tagId) return false
  await applyTag(contactId, tagId)
  return true
}

/**
 * Attacca una nota al contatto. È il posto dove finiscono le risposte del form
 * di candidatura: il coach le legge nella scheda contatto prima della chiamata.
 */
export async function addContactNote(contactId: string, note: string): Promise<void> {
  await acPost('notes', {
    note: { note, relid: Number(contactId), reltype: 'Subscriber' },
  })
  console.log(`[AC] Nota aggiunta al contatto ${contactId}`)
}

/** Esito del sync, usato per riportarlo nella notifica Telegram */
export type AcSyncResult =
  | { ok: true; contactId: string }
  | { ok: false; reason: string }

/**
 * Funzione principale: esegue le 3 chiamate in sequenza.
 * Da chiamare dentro next/server `after()` per non bloccare la risposta.
 *
 * La configurazione AC viene dal campo settings.activecampaign del funnel:
 *   { "activecampaign": { "list_id": 9, "tag_id": 176 } }
 */
export async function syncToActiveCampaign(params: {
  email: string
  name: string
  phone?: string
  listId: number
  tagId: number
}): Promise<AcSyncResult> {
  const { email, name, phone, listId, tagId } = params

  // Estrae nome e cognome dal campo name
  const parts = name.trim().split(' ')
  const firstName = parts[0] || ''
  const lastName = parts.slice(1).join(' ') || undefined

  try {
    // 1. Upsert contatto
    const contactId = await syncContact({ email, firstName, lastName, phone })
    if (!contactId) return { ok: false, reason: 'nessun ID contatto restituito' }

    // 2. Aggiungi alla lista + 3. Applica tag — in parallelo dopo aver l'ID
    await Promise.all([
      addToList(contactId, listId),
      applyTag(contactId, tagId),
    ])

    console.log(`[AC] ✅ Sync completa per ${email} → lista ${listId}, tag ${tagId}`)
    return { ok: true, contactId }
  } catch (err) {
    // Non-fatal: logghiamo ma non facciamo fallire il flusso principale
    console.error(`[AC] ❌ Sync fallita per ${email}:`, err)
    return { ok: false, reason: err instanceof Error ? err.message : String(err) }
  }
}
