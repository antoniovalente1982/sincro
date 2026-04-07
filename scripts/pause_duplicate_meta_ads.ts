import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

const SCALING_CAMPAIGN_ID = '120243861437670047'
const TESTING_CAMPAIGN_ID = '120243861179740047'

function normalizeName(name: string) {
    return name
        .replace(/ - Copia \d*$/i, '')
        .replace(/ - Copia$/i, '')
        .replace(/ - Copy \d*$/i, '')
        .replace(/ - Copy$/i, '')
        .trim()
        .toLowerCase();
}

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

    const { access_token } = conn.credentials;
    
    console.log("Fetching active ads for SCALING campaign...");
    const scalingUrl = `https://graph.facebook.com/v21.0/${SCALING_CAMPAIGN_ID}/ads?fields=id,name,effective_status&limit=500&access_token=${access_token}`;
    const scalingRes = await (await fetch(scalingUrl)).json();
    const activeScalingAds = (scalingRes.data || []).filter((ad: any) => ad.effective_status === 'ACTIVE');
    
    console.log(`Found ${activeScalingAds.length} active ads in SCALING.`);
    const scalingAdNames = new Set(activeScalingAds.map((ad: any) => normalizeName(ad.name)));

    console.log("Fetching active ads for TESTING campaign...");
    let activeTestingAds: any[] = [];
    let testingUrl = `https://graph.facebook.com/v21.0/${TESTING_CAMPAIGN_ID}/ads?fields=id,name,effective_status,status&limit=500&access_token=${access_token}`;
    
    while (testingUrl) {
        const testingRes = await (await fetch(testingUrl)).json();
        if (testingRes.data) {
            activeTestingAds = activeTestingAds.concat(
                 testingRes.data.filter((ad: any) => ad.effective_status === 'ACTIVE' || ad.status === 'ACTIVE')
            );
        }
        testingUrl = testingRes.paging?.next || null;
    }
    
    console.log(`Found ${activeTestingAds.length} active ads in TESTING.`);

    const duplicatesToPause = [];

    for (const ad of activeTestingAds) {
        const normalizedTestingName = normalizeName(ad.name);
        if (scalingAdNames.has(normalizedTestingName)) {
            duplicatesToPause.push(ad);
        }
    }

    console.log(`\nIdentified ${duplicatesToPause.length} duplicate ads to pause in TESTING:`);
    for (const ad of duplicatesToPause) {
        console.log(`- ${ad.name} (ID: ${ad.id})`);
    }

    if (duplicatesToPause.length === 0) {
        console.log("No duplicates found based on name.");
        return;
    }

    console.log("\nPausing duplicates now...");
    for (const ad of duplicatesToPause) {
        console.log(`Pausing ad: ${ad.name}...`);
        const pauseUrl = `https://graph.facebook.com/v21.0/${ad.id}`;
        
        const params = new URLSearchParams();
        params.append('status', 'PAUSED');
        params.append('access_token', access_token);
        
        const res = await fetch(pauseUrl, {
            method: 'POST',
            body: params
        });
        
        const json = await res.json();
        if (json.success) {
            console.log(`✅ Successfully paused ${ad.name}`);
        } else {
            console.error(`❌ Failed to pause ${ad.name}:`, json.error);
        }
    }

    console.log("\nDone!");
}

run().catch(console.error);
