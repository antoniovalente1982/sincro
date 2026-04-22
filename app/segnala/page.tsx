import { Metadata } from 'next'
import SegnalaForm from './SegnalaForm'

export const metadata: Metadata = {
    title: 'Segnala un Contatto — Metodo Sincro Partner',
    description: 'Form riservato ai partner Metodo Sincro per segnalare un contatto diretto.',
}

export default function SegnalaPage() {
    return <SegnalaForm />
}
