import { createClient } from "@supabase/supabase-js";
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
const orgId = 'a5dd4842-f0ea-4909-b4a3-be2cb1c6ffa5';

async function run() {
    const { data: conn } = await supabase
        .from('connections')
        .select('credentials')
        .eq('organization_id', orgId)
        .eq('provider', 'meta_ads')
        .eq('status', 'active')
        .single();
    
    if (!conn?.credentials?.access_token) return console.error('No meta');
    
    const { access_token, ad_account_id } = conn.credentials;
    const adAccount = `act_${ad_account_id}`;
    const since = '2026-03-28';
    const until = '2026-03-28';
    const META_API_VERSION = 'v21.0';

    const timeRange = JSON.stringify({ since, until });
    const insightsUrl = `https://graph.facebook.com/${META_API_VERSION}/${adAccount}/insights?fields=campaign_id,campaign_name,spend,impressions,clicks,ctr,cpc,actions,cost_per_action_type,outbound_clicks,inline_link_click_ctr&level=campaign&time_range=${encodeURIComponent(timeRange)}&use_account_attribution_setting=true&limit=500&access_token=${access_token}`;
    const insightsRes = await fetch(insightsUrl);
    const insightsData = await insightsRes.json();
    
    let allInsights = insightsData.data || [];
    let newTotalSpend = 0;
    for (const i of allInsights) {
        newTotalSpend += parseFloat(i.spend || '0');
    }

    console.log(`[TEST 28/03] Total Spend: ${newTotalSpend.toFixed(2)}`);
    const andromeda = allInsights.find((i:any) => i.campaign_name.includes('Andromeda'));
    console.log(`[TEST 28/03] Leads from Meta:`, andromeda?.actions?.find((a:any) => a.action_type === 'lead')?.value);
}
run();
