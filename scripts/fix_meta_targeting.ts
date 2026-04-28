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
    
    console.log('--- Scanning and Fixing AdSets ---');
    if (!campaignsData.data || campaignsData.data.length === 0) {
        console.log('No campaigns found.');
        return;
    }

    for (const camp of campaignsData.data) {
        console.log(`\nCampaign: ${camp.name} (${camp.id})`);
        const adsetsUrl = `https://graph.facebook.com/${META_API_VERSION}/${camp.id}/adsets?fields=name,status,targeting&limit=50&access_token=${access_token}`;
        const adsetsRes = await fetch(adsetsUrl);
        const adsetsData = await adsetsRes.json();
        
        if (!adsetsData.data) continue;

        for (const adset of adsetsData.data) {
            if (adset.status !== 'ACTIVE' && adset.status !== 'PAUSED') continue;
            
            const targeting = adset.targeting || {};
            const geo = targeting.geo_locations || {};
            const locationTypes = geo.location_types || [];
            
            if (locationTypes.includes('recent')) {
                console.log(`  [FIXING] AdSet: ${adset.name} (${adset.id})`);
                console.log(`    Current location_types: ${locationTypes.join(', ')}`);
                
                // Update targeting to only include 'home'
                geo.location_types = ['home'];
                targeting.geo_locations = geo;
                
                // Send update to Meta API
                const updateUrl = `https://graph.facebook.com/${META_API_VERSION}/${adset.id}`;
                const updateBody = new URLSearchParams();
                updateBody.append('targeting', JSON.stringify(targeting));
                updateBody.append('access_token', access_token);
                
                const updateRes = await fetch(updateUrl, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/x-www-form-urlencoded'
                    },
                    body: updateBody.toString()
                });
                
                const updateData = await updateRes.json();
                if (updateData.success) {
                    console.log(`    ✅ Successfully updated to "home" only (Persone che vivono in questo luogo).`);
                } else {
                    console.error(`    ❌ Failed to update:`, updateData.error?.message || updateData);
                }
            } else {
                console.log(`  [OK] AdSet: ${adset.name} (${adset.id}) already correctly configured: ${locationTypes.join(', ')}`);
            }
        }
    }
}
run();
