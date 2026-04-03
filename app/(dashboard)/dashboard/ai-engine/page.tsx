import CommandCenter from './CommandCenter'

export const metadata = {
  title: 'AdPilotik Command Center',
  description: 'Centro di comando autonomo per gestione AI-driven di Meta Ads, CRM e funnel.',
}

export default async function AIEnginePage() {
  return <CommandCenter />
}
