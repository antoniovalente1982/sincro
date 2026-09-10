/**
 * Riconosce un embed VTurb incollato dal pannello e ne ricava gli identificativi.
 *
 * VTurb offre due varianti di codice, JavaScript e iFrame, ma entrambe
 * contengono lo stesso indirizzo nella forma:
 *   https://scripts.converteai.net/<account>/players/<player>/v4/<file>
 * Quindi non serve chiedere all'utente quale versione stia incollando: basta
 * leggere quell'indirizzo, ovunque si trovi nel testo. Funziona anche se
 * incolla il solo blocco di precaricamento o l'URL nudo.
 *
 * Sulla pagina renderizziamo sempre l'iframe, a prescindere da cosa e' stato
 * incollato: l'embed JavaScript vive in shadow DOM dentro la pagina e non
 * sopravvive ai re-render di React, mentre l'iframe e' un documento a se'.
 */
export interface VturbIds {
    account: string
    player: string
}

const RE = /scripts\.converteai\.net\/([0-9a-fA-F-]{36})\/players\/([0-9a-zA-Z]{16,})/

export function parseVturbEmbed(input?: string | null): VturbIds | null {
    if (!input) return null
    const m = String(input).match(RE)
    if (!m) return null
    return { account: m[1].toLowerCase(), player: m[2] }
}

/** Indirizzo della pagina che l'iframe deve caricare. */
export function vturbEmbedUrl({ account, player }: VturbIds): string {
    return `https://scripts.converteai.net/${account}/players/${player}/v4/embed.html`
}

/**
 * Indirizzo completo da assegnare all'iframe, da comporre nel browser.
 * Ricalca l'embed ufficiale: propaga la query della pagina e aggiunge `vl`
 * con l'URL corrente, che VTurb usa per riconoscere il dominio.
 */
export function vturbFrameSrc(ids: VturbIds, href: string, search: string): string {
    return `${vturbEmbedUrl(ids)}${search || '?'}&vl=${encodeURIComponent(href)}`
}

/** Lo script che sulla pagina ospite fa da ponte con l'iframe. */
export const VTURB_SDK_SRC = 'https://scripts.converteai.net/lib/js/smartplayer-wc/v4/sdk.js'
