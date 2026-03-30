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
    const since = '2026-03-29';
    const until = '2026-03-29';
    const META_API_VERSION = 'v21.0';

    const campaignsUrl = `https://graph.facebook.com/${META_API_VERSION}/${adAccount}/campaigns?fields=id,name,status,objective,daily_budget&limit=500&access_token=${access_token}`;
    const campaignsRes = await fetch(campaignsUrl);
    const campaignsData = await campaignsRes.json();
    const allCampaigns = campaignsData.data || [];

    const timeRange = JSON.stringify({ since, until });
    const filtering = JSON.stringify([{
        field: 'campaign.delivery_info',
        operator: 'IN',
        value: ['active', 'inactive', 'completed', 'limited', 'not_delivering', 'not_published', 'pending_review', 'recently_completed', 'recently_rejected', 'rejected', 'scheduled']
    }]);
    
    // FETCH OLD WAY
    const oldInsightsUrl = `https://graph.facebook.com/${META_API_VERSION}/${adAccount}/insights?fields=campaign_id,campaign_name,spend,impressions,clicks,ctr,cpc,actions,cost_per_action_type,outbound_clicks,inline_link_click_ctr&level=campaign&time_range=${encodeURIComponent(timeRange)}&limit=500&access_token=${access_token}`;
    const oldInsightsRes = await fetch(oldInsightsUrl);
    const oldInsightsData = await oldInsightsRes.json();
    let oldTotalSpend = 0;
    for (const i of oldInsightsData.data || []) {
        oldTotalSpend += parseFloat(i.spend || '0');
    }

    // FETCH NEW WAY
    const insightsUrl = `https://graph.facebook.com/${META_API_VERSION}/${adAccount}/insights?fields=campaign_id,campaign_name,spend,impressions,clicks,ctr,cpc,actions,cost_per_action_type,outbound_clicks,inline_link_click_ctr&level=campaign&time_range=${encodeURIComponent(timeRange)}&use_account_attribution_setting=true&limit=500&access_token=${access_token}`;
    const insightsRes = await fetch(insightsUrl);
    const insightsData = await insightsRes.json();
    
    let allInsights = insightsData.data || [];
    let nextPageUrl = insightsData.paging?.next;
    while (nextPageUrl) {
        const pageRes = await fetch(nextPageUrl);
        const pageData = await pageRes.json();
        allInsights.push(...(pageData.data || []));
        nextPageUrl = pageData.paging?.next;
    }
    
    let newTotalSpend = 0;
    for (const i of allInsights) {
        newTotalSpend += parseFloat(i.spend || '0');
    }

    console.log(`[TEST] Old Total Spend: ${oldTotalSpend.toFixed(2)}`);
    console.log(`[TEST] New Total Spend: ${newTotalSpend.toFixed(2)}`);

    const { data: crmLeads } = await supabase
        .from('leads')
        .select('id, utm_campaign, created_at')
        .eq('organization_id', orgId)
        .gte('created_at', since + 'T00:00:00+02:00')
        .lte('created_at', until + 'T23:59:59+02:00');
        
    console.log(`[TEST] CRM Leads count matching dates: ${crmLeads?.length}`);
    
    const crmLeadsMap: Record<string, number> = {};
    for (const lead of crmLeads || []) {
        if (lead.utm_campaign) {
            const campKey = lead.utm_campaign.toLowerCase().trim();
            crmLeadsMap[campKey] = (crmLeadsMap[campKey] || 0) + 1;
        }
    }
    console.log(`[TEST] crmLeadsMap (Andromeda):`, crmLeadsMap['ms - lead gen - andromeda'] || 0);

}
run();
