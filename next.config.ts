import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Su landing.metodosincro.com la home e' la vetrina di ADPILOTIK. Chi apre il
  // dominio senza percorso (e' quello che Meta mostra nelle inserzioni) deve
  // finire sulla landing della campagna, non sul gestionale.
  async redirects() {
    return [
      {
        source: '/',
        has: [{ type: 'host', value: 'landing.metodosincro.com' }],
        destination: '/f/salto-di-qualita',
        permanent: false,
      },
    ]
  },
  experimental: {
    serverActions: {
      bodySizeLimit: '50mb',
    },
  },
};

export default nextConfig;
