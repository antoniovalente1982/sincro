// Meta Ads Graph API action helpers

const META_API_VERSION = 'v21.0'

interface MetaActionResult {
    success: boolean
    action: string
    entity_id: string
    details?: any
    error?: string
}

/**
 * Pause an ad on Meta
 */
export async function pauseAd(adId: string, accessToken: string): Promise<MetaActionResult> {
    try {
        const res = await fetch(`https://graph.facebook.com/${META_API_VERSION}/${adId}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: 'PAUSED', access_token: accessToken }),
        })
        const data = await res.json()
        if (data.success || data.id) {
            return { success: true, action: 'pause_ad', entity_id: adId }
        }
        return { success: false, action: 'pause_ad', entity_id: adId, error: JSON.stringify(data.error || data) }
    } catch (err: any) {
        return { success: false, action: 'pause_ad', entity_id: adId, error: err.message }
    }
}

/**
 * Enable (unpause) an ad on Meta
 */
export async function enableAd(adId: string, accessToken: string): Promise<MetaActionResult> {
    try {
        const res = await fetch(`https://graph.facebook.com/${META_API_VERSION}/${adId}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: 'ACTIVE', access_token: accessToken }),
        })
        const data = await res.json()
        if (data.success || data.id) {
            return { success: true, action: 'enable_ad', entity_id: adId }
        }
        return { success: false, action: 'enable_ad', entity_id: adId, error: JSON.stringify(data.error || data) }
    } catch (err: any) {
        return { success: false, action: 'enable_ad', entity_id: adId, error: err.message }
    }
}

/**
 * Update campaign daily budget on Meta
 * @param newBudgetCents - new daily budget in CENTS (Meta uses cents)
 */
export async function updateCampaignBudget(
    campaignId: string,
    newBudgetCents: number,
    accessToken: string
): Promise<MetaActionResult> {
    try {
        const res = await fetch(`https://graph.facebook.com/${META_API_VERSION}/${campaignId}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                daily_budget: Math.round(newBudgetCents),
                access_token: accessToken,
            }),
        })
        const data = await res.json()
        if (data.success || data.id) {
            return {
                success: true, action: 'update_budget', entity_id: campaignId,
                details: { new_budget_cents: newBudgetCents, new_budget_eur: (newBudgetCents / 100).toFixed(2) },
            }
        }
        return { success: false, action: 'update_budget', entity_id: campaignId, error: JSON.stringify(data.error || data) }
    } catch (err: any) {
        return { success: false, action: 'update_budget', entity_id: campaignId, error: err.message }
    }
}

/**
 * Calculate new budget with percentage change, respecting min/max guards
 */
export function calculateNewBudget(
    currentBudgetEur: number,
    changePercent: number, // positive = increase, negative = decrease
    minBudgetEur: number = 5,
    maxChangePercent: number = 20,
): { newBudgetEur: number; newBudgetCents: number; actualChangePercent: number } {
    // Cap the change at maxChangePercent
    const cappedChange = Math.max(-maxChangePercent, Math.min(maxChangePercent, changePercent))
    const multiplier = 1 + cappedChange / 100
    let newBudget = currentBudgetEur * multiplier

    // Enforce minimum budget
    newBudget = Math.max(minBudgetEur, newBudget)

    return {
        newBudgetEur: Math.round(newBudget * 100) / 100,
        newBudgetCents: Math.round(newBudget * 100),
        actualChangePercent: cappedChange,
    }
}
