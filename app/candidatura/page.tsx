import type { Metadata } from 'next'
import CandidaturaClient from './CandidaturaClient'

export const metadata: Metadata = {
    title: 'Candidati alla chiamata — Metodo Sincro®',
    description:
        '20 minuti con uno dei coach del Metodo Sincro sulla situazione di tuo figlio. Gratuita, nessun impegno.',
    robots: { index: false, follow: false },
}

// La pagina legge la variabile a ogni richiesta: chiudere le candidature deve
// essere questione di un flag su Vercel, non di un nuovo deploy.
export const dynamic = 'force-dynamic'

export default function CandidaturaPage() {
    const aperte = process.env.CANDIDATURE_APERTE !== 'false'

    return <CandidaturaClient aperte={aperte} />
}
