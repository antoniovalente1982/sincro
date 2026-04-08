import { createClient } from '@supabase/supabase-js'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

async function run() {
    const { data: adsConn } = await supabase.from('connections').select('credentials').eq('provider', 'meta_ads').eq('status', 'active').single()
    const { access_token, ad_account_id } = adsConn?.credentials || {}
    const { data: capiConn } = await supabase.from('connections').select('config, credentials').eq('provider', 'meta_capi').eq('status', 'active').single()
    const pixelId = capiConn?.credentials?.pixel_id || capiConn?.config?.pixel_id
    
    // Test different formats
    const testCases = [
        { type: "time_spent", method: "percentile", operator: "in_range", value: { min: 0, max: 25 } },
        { type: "time_spent", method: "percentile", operator: "in_range", value: { "from": 0, "to": 25 } },
        { type: "time_spent", method: "percentile", operator: "gte", value: 75 },
        { type: "time_spent", operator: "gte", value: 25 },
        { type: "time_spent", method: "percentile", operator: "top", value: 25 },
        { type: "time_spent", config: { method: "percentile" }, operator: "in_range", value: { min: 0, max: 25 } }
    ];
    
    for (let i = 0; i < testCases.length; i++) {
        const tc = testCases[i]
        const rule = {
            inclusions: {
                operator: 'or',
                rules: [{
                    event_sources: [{id: pixelId, type: "pixel"}],
                    retention_seconds: 30 * 86400,
                    filter: { operator: 'and', filters: [{ field: 'event', operator: 'eq', value: 'PageView' }] },
                    aggregation: tc
                }]
            }
        }

        const payload = new URLSearchParams()
        payload.set('name', 'TEST - Aggregation Test ' + i + ' - ' + Math.random())
        payload.set('rule', JSON.stringify(rule))
        payload.set('access_token', access_token)

        const res = await fetch(`https://graph.facebook.com/v21.0/act_${ad_account_id}/customaudiences`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: payload
        })
        const json = await res.json()
        if (json.id) console.log(`Test ${i}: SUCCESS ${json.id}`)
        else console.log(`Test ${i}: ERROR ${json.error.message}`)
    }
}
run().catch(console.error)
