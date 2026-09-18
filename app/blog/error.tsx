'use client'
export default function BlogError({ reset }: { reset: () => void }) {
    return <main style={{ maxWidth: 640, margin: '80px auto', padding: 24 }}><h1>Gli articoli non sono disponibili in questo momento.</h1><p>Non è stato possibile caricare il blog. Riprova tra poco.</p><button className="btn btn-primary" onClick={reset}>Riprova</button></main>
}
