export function advertorialConsultationHref(search: string, preview = false): string {
    const incoming = new URLSearchParams(search)
    const outgoing = new URLSearchParams()
    for (const key of ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'fbclid', 'fbadid']) {
        const value = incoming.get(key)
        if (value) outgoing.set(key, value)
    }
    outgoing.set('entry', 'advertorial-pochi-minuti')
    if (preview) outgoing.set('ab', 'A')
    return `/f/salto-di-qualita?${outgoing.toString()}#ms-form`
}
