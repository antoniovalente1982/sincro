import { appendLeadToSheet } from '../lib/google-sheets'

async function pushCarmine() {
    const success = await appendLeadToSheet('a5dd4842-f0ea-4909-b4a3-be2cb1c6ffa5', {
        name: 'Carmine',
        email: 'carmine.maione.66@virgilio.it',
        phone: '+393336000783',
        funnel: 'Consulenza Gratuita - Mental Coaching Calcio',
        utm_source: 'facebook',
        utm_campaign: 'MS - Lead Gen - Andromeda',
        created_at: '2026-03-30T23:40:04.997Z',
        landing_url: 'landing.metodosincro.com'
    })

    if (success) {
        console.log('✅ Lead Carmine appended successfully to Google Sheet.')
    } else {
        console.error('❌ Failed to append lead Carmine.')
    }
}

pushCarmine()
