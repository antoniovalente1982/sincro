import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'METODO SINCRO® Mental Coach Calcio | Antonio Valente',
  description: 'Il percorso di Mental Coaching n.1 in Italia per giovani calciatori.',
  icons: {
    icon: 'https://metodosincro.it/wp-content/uploads/2024/02/cropped-MS-32x32.png',
    apple: 'https://metodosincro.it/wp-content/uploads/2024/02/cropped-MS-192x192.png',
  }
}

export default function FunnelLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <>{children}</>
}
