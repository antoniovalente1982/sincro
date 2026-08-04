import type { Metadata } from 'next'

export const metadata: Metadata = {
    title: 'Ci sei — Metodo Sincro®',
    description: 'Confermato: continuerai a ricevere i materiali per la stagione di tuo figlio.',
    robots: { index: false, follow: false },
}

// Pagina di conferma per i pulsanti "SÌ, GIOCA ANCORA" (email B1) e
// "RESTO IN LISTA" (email B2) del flusso di riattivazione freddi.
//
// Il tagging del contatto NON avviene qui: ActiveCampaign traccia il click
// sul link dell'email e applica i tag (lancio26-riattivato + lancio26-invitabile)
// tramite la condizione "ha cliccato un link" dentro l'automazione A1-Freddi.
// Questa pagina deve solo confermare, in coerenza visiva con le email.

export default function RestoPage() {
    return (
        <div
            style={{ background: '#f6f4ef', minHeight: '100vh' }}
            className="flex items-center justify-center px-4 py-10"
        >
            <main
                className="w-full overflow-hidden rounded-lg bg-white shadow-sm"
                style={{ maxWidth: 600 }}
            >
                {/* Header in brand, identico alle email */}
                <div style={{ background: '#0d1b2a' }} className="px-8 py-5">
                    <span
                        style={{
                            color: '#c9a84c',
                            letterSpacing: '3.5px',
                            fontFamily: 'Helvetica, Arial, sans-serif',
                        }}
                        className="text-[13px] font-bold"
                    >
                        METODO SINCRO&reg;
                    </span>
                </div>

                <div className="px-8 py-10" style={{ fontFamily: 'Helvetica, Arial, sans-serif' }}>
                    {/* Check */}
                    <div
                        className="mb-6 flex h-14 w-14 items-center justify-center rounded-full"
                        style={{ background: '#f6f4ef', border: '2px solid #c9a84c' }}
                        aria-hidden="true"
                    >
                        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#0d1b2a" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="20 6 9 17 4 12" />
                        </svg>
                    </div>

                    <h1
                        className="mb-4 text-[26px] font-bold leading-tight"
                        style={{ color: '#0d1b2a' }}
                    >
                        Ricevuto. Ci sei.
                    </h1>

                    <p className="mb-4 text-[17px] leading-relaxed" style={{ color: '#1a1a1a' }}>
                        Non devi fare nient&apos;altro: nei prossimi giorni ti arrivano via email i
                        materiali che sto preparando per l&apos;inizio della stagione — le cose
                        concrete che contano nelle prime settimane, quando si decidono le gerarchie.
                    </p>

                    <p className="mb-8 text-[17px] leading-relaxed" style={{ color: '#1a1a1a' }}>
                        Un consiglio solo, nel frattempo: se le mie email finiscono in Promozioni o
                        in spam, trascinane una nella posta in arrivo. Basta una volta.
                    </p>

                    <div
                        className="rounded-md px-6 py-5"
                        style={{ background: '#f6f4ef' }}
                    >
                        <p className="text-[15px] leading-relaxed" style={{ color: '#6b6b6b' }}>
                            In bocca al lupo a tuo figlio per la stagione che comincia.
                        </p>
                        <p className="mt-2 text-[16px]" style={{ color: '#1a1a1a' }}>
                            Antonio Valente
                            <span className="block text-[13px]" style={{ color: '#6b6b6b' }}>
                                Fondatore, Metodo Sincro&reg;
                            </span>
                        </p>
                    </div>
                </div>
            </main>
        </div>
    )
}
