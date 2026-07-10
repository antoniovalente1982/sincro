// ============================================================
// Timezone helpers — tutto il sistema Stazione Leads lavora
// in ora italiana (Europe/Rome), non in UTC del server Vercel.
//
// Su Vercel `new Date()` è UTC: senza questi helper gli orari
// permessi, il quota_date e lo streak sarebbero sfasati di 1-2h.
// ============================================================

export const APP_TIMEZONE = 'Europe/Rome'

/**
 * Data odierna in ora italiana, formato 'YYYY-MM-DD'.
 * Usata come chiave per lead_daily_quota.quota_date.
 */
export function romeDateString(date: Date = new Date()): string {
    // en-CA produce il formato ISO YYYY-MM-DD
    return new Intl.DateTimeFormat('en-CA', {
        timeZone: APP_TIMEZONE,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
    }).format(date)
}

/**
 * Ora corrente in ora italiana, formato 'HH:MM' (24h).
 * Usata per il confronto con allowed_hours_start/end.
 */
export function romeTimeString(date: Date = new Date()): string {
    return new Intl.DateTimeFormat('en-GB', {
        timeZone: APP_TIMEZONE,
        hour: '2-digit',
        minute: '2-digit',
        hourCycle: 'h23',
    }).format(date)
}

/**
 * Giorno della settimana in ora italiana: 1 = Lunedì … 7 = Domenica.
 * Coerente con lead_distribution_rules.allowed_days.
 */
export function romeDayOfWeek(date: Date = new Date()): number {
    const weekday = new Intl.DateTimeFormat('en-US', {
        timeZone: APP_TIMEZONE,
        weekday: 'short',
    }).format(date)
    const map: Record<string, number> = {
        Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7,
    }
    return map[weekday] ?? 1
}

/**
 * Data di N giorni fa in ora italiana, formato 'YYYY-MM-DD'.
 */
export function romeDateStringDaysAgo(days: number): string {
    return romeDateString(new Date(Date.now() - days * 24 * 60 * 60 * 1000))
}
