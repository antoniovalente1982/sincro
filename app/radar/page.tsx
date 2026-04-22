import { Metadata } from 'next'
import RadarQuiz from './RadarQuiz'

export const metadata: Metadata = {
    title: 'Radar Sincro — Tuo figlio ha un freno invisibile?',
    description: 'Test gratuito di 3 minuti: scopri se il tuo giovane atleta ha un blocco mentale sportivo che lo sta frenando dal tirare fuori il suo potenziale.',
}

export default function RadarPage() {
    return <RadarQuiz />
}
