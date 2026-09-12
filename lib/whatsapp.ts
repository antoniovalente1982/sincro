/**
 * Primo contatto WhatsApp verso un lead.
 *
 * Il messaggio e' precompilato ma non viene inviato: si apre la chat con il
 * testo gia' scritto, cosi' chi scrive puo' ritoccarlo prima di premere invio.
 */

/**
 * Porta un numero nel formato che wa.me richiede: solo cifre, con prefisso
 * internazionale e senza segni. I numeri nel CRM arrivano scritti in tutti i
 * modi — "+39 333 123 4567", "0039...", "333-1234567" — e wa.me li rifiuta
 * tutti tranne la forma pulita.
 */
export function normalizzaTelefono(raw?: string | null): string | null {
    if (!raw) return null
    let n = String(raw).replace(/\D/g, '')
    if (!n) return null
    if (n.startsWith('00')) n = n.slice(2)
    // Un cellulare italiano e' 10 cifre e comincia per 3: se il prefisso paese
    // non c'e', lo mettiamo noi. I numeri esteri arrivano gia' col loro.
    if (n.length === 10 && n.startsWith('3')) n = '39' + n
    if (n.length < 8 || n.length > 15) return null
    return n
}

/** "oggi", "ieri", oppure "il 10 settembre" — come lo direbbe una persona. */
function quando(data?: string | null): string {
    if (!data) return ''
    const d = new Date(data)
    if (isNaN(d.getTime())) return ''
    const giorno = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime()
    const differenza = Math.round((giorno(new Date()) - giorno(d)) / 86400000)
    if (differenza <= 0) return 'oggi'
    if (differenza === 1) return 'ieri'
    return 'il ' + d.toLocaleDateString('it-IT', { day: 'numeric', month: 'long' })
}

export interface DatiPrimoContatto {
    nome?: string | null
    creatoIl?: string | null
    etaFiglio?: string | null
    nomeFunnel?: string | null
}

/**
 * Chi siamo, perche' scriviamo, quando ha chiesto di essere contattato e la
 * domanda che apre la conversazione. Se conosciamo l'eta' del figlio la
 * citiamo: dimostra che la richiesta e' stata letta davvero.
 */
export function messaggioPrimoContatto({ nome, creatoIl, etaFiglio }: DatiPrimoContatto): string {
    const saluto = nome ? `Buongiorno ${String(nome).trim().split(' ')[0]}` : 'Buongiorno'
    const q = quando(creatoIl)
    // quando() restituisce "oggi" / "il 10 settembre": apre la frase, quindi va
    // in maiuscolo.
    const riferimento = q
        ? `${q.charAt(0).toUpperCase()}${q.slice(1)} ha richiesto una consulenza gratuita dal nostro sito`
        : 'Ha richiesto una consulenza gratuita dal nostro sito'

    const domanda = etaFiglio
        ? `Ho visto che ha indicato ${etaFiglio} anni: la richiesta è per suo figlio? Mi dica in che categoria gioca e cosa vorreste migliorare.`
        : 'Le chiedo una conferma: la richiesta è per suo figlio? Se mi dice quanti anni ha e in che categoria gioca, la metto in contatto con il coach giusto.'

    return [
        `${saluto}, le scrivo da Metodo Sincro.`,
        '',
        `${riferimento} sul mental coaching per calciatori.`,
        '',
        domanda,
    ].join('\n')
}

/** Indirizzo da aprire. null se il numero non e' utilizzabile. */
export function linkWhatsApp(telefono: string | null | undefined, dati: DatiPrimoContatto): string | null {
    const n = normalizzaTelefono(telefono)
    if (!n) return null
    return `https://wa.me/${n}?text=${encodeURIComponent(messaggioPrimoContatto(dati))}`
}
