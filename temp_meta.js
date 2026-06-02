const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

async function run() {
    const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    console.log("Fetching Meta Ads connection...");
    const { data, error } = await supabase
        .from('connections')
        .select('credentials')
        .eq('provider', 'meta_ads')
        .eq('status', 'active')
        .limit(1)
        .single();

    if (error || !data) {
        console.error("Error fetching connection:", error);
        return;
    }

    const userAccessToken = data.credentials.access_token;
    if (!userAccessToken) {
        console.error("No access token found in credentials");
        return;
    }

    console.log("Fetching Page Access Token for 108451268302248...");
    const accountsRes = await fetch(`https://graph.facebook.com/v21.0/me/accounts?access_token=${userAccessToken}`);
    const accountsData = await accountsRes.json();
    
    if (accountsData.error) {
        console.error("Error fetching accounts:", accountsData.error);
        return;
    }

    const page = accountsData.data.find(p => p.id === '108451268302248');
    if (!page) {
        console.error("Page not found in user's accounts", accountsData);
        return;
    }

    const pageAccessToken = page.access_token;
    console.log("Found Page Access Token, subscribing...");

    const response = await fetch('https://graph.facebook.com/v21.0/108451268302248/subscribed_apps', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: new URLSearchParams({
            access_token: pageAccessToken,
            subscribed_fields: 'leadgen'
        })
    });

    const result = await response.json();
    console.log("Meta API Response:", result);
}

run().catch(console.error);
