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
    
    if (!conn?.credentials?.access_token) return console.error('No meta token found in DB');
    
    const { access_token, ad_account_id } = conn.credentials;
    const adAccount = `act_${ad_account_id}`;
    const META_API_VERSION = 'v21.0';

    // 1. Get recent campaigns
    const campaignsUrl = `https://graph.facebook.com/${META_API_VERSION}/${adAccount}/campaigns?fields=name,status&limit=10&access_token=${access_token}`;
    const campaignsRes = await fetch(campaignsUrl);
    const campaignsData = await campaignsRes.json();
    
    console.log('--- Active Campaigns ---');
    if (!campaignsData.data || campaignsData.data.length === 0) {
        console.log('No active campaigns found.');
        return;
    }

    // 2. For each active campaign, get the adsets and their targeting
    for (const camp of campaignsData.data) {
        console.log(`\nCampaign: ${camp.name} (${camp.id})`);
        const adsetsUrl = `https://graph.facebook.com/${META_API_VERSION}/${camp.id}/adsets?fields=name,status,targeting,targeting_optimization_types,optimization_goal,targeting_automation&limit=50&access_token=${access_token}`;
        const adsetsRes = await fetch(adsetsUrl);
        const adsetsData = await adsetsRes.json();
        
        if (!adsetsData.data) continue;

        for (const adset of adsetsData.data) {
            if (adset.status !== 'ACTIVE' && adset.status !== 'PAUSED') continue;
            console.log(`  AdSet: ${adset.name} (${adset.id})`);
            
            const targeting = adset.targeting || {};
            
            // Age
            const ageMin = targeting.age_min || 'Not set';
            const ageMax = targeting.age_max || 'Not set';
            console.log(`    Age: ${ageMin} - ${ageMax}`);
            
            // Locales (Languages)
            const locales = targeting.locales ? targeting.locales.join(', ') : 'Not set (All Languages)';
            console.log(`    Locales: ${locales}`);
            
            // Locations
            const geo = targeting.geo_locations || {};
            let locationDesc = 'Not set';
            if (geo.countries) locationDesc = `Countries: ${geo.countries.join(', ')}`;
            if (geo.location_types) locationDesc += ` | Types: ${geo.location_types.join(', ')}`;
            console.log(`    Locations: ${locationDesc}`);
            
            // Advantage+ Audience (targeting_automation)
            let advantagePlus = 'Unknown';
            if (adset.targeting_automation && adset.targeting_automation.advantage_audience !== undefined) {
                 advantagePlus = adset.targeting_automation.advantage_audience === 1 ? 'ON' : 'OFF';
            } else if (targeting.targeting_optimization !== undefined) {
                 advantagePlus = targeting.targeting_optimization;
            }
            console.log(`    Advantage+ Audience: ${advantagePlus}`);
            
            console.log(`    Targeting details:`, JSON.stringify(targeting, null, 2));
        }
    }
}
run();
