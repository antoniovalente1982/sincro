import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

async function run() {
    console.log("Fetching Meta Ads credentials...");
    const { data: conn } = await supabase
        .from('connections')
        .select('credentials')
        .eq('provider', 'meta_ads')
        .eq('status', 'active')
        .limit(1)
        .single();
    
    if (!conn) {
        console.error("No active Meta Ads connection found.");
        return;
    }

    const { access_token, ad_account_id } = conn.credentials;
    const adAccount = `act_${ad_account_id}`;
    
    console.log(`Analyzing campaigns for Ad Account: ${adAccount}...`);
    
    // Fetch campaigns
    const campaignsUrl = `https://graph.facebook.com/v21.0/${adAccount}/campaigns?fields=id,name,status&limit=50&access_token=${access_token}`;
    const res = await fetch(campaignsUrl);
    const json = await res.json();
    
    if (json.error) {
        console.error("Error from Meta:", json.error);
        return;
    }
    
    console.log("Campaigns:");
    for (const c of json.data) {
        console.log(`- [${c.status}] ${c.name} (ID: ${c.id})`);
    }
}

run().catch(console.error);
