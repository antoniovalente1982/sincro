// Attiva campagna, adset e annunci (tranne quelli in HOLD). L'adset parte comunque alla start_time programmata.
import fs from 'node:fs'; import path from 'node:path';
import { out, graph, save } from './meta-client.mjs';
const HOLD = ['V02'] // immagini di atleti famosi: in attesa di conferma di Antonio
const st = JSON.parse(fs.readFileSync(path.join(out, 'CREATED_OBJECTS.json')));
const receipt = { activated_at: new Date().toISOString(), hold: HOLD, results: [] };
receipt.results.push({ campaign: st.campaign.id, ...(await graph(st.campaign.id, { status: 'ACTIVE' }, 'POST')) });
receipt.results.push({ adset: st.adset.id, ...(await graph(st.adset.id, { status: 'ACTIVE' }, 'POST')) });
for (const a of st.ads) if (!HOLD.includes(a.code)) receipt.results.push({ ad: a.code, id: a.ad_id, ...(await graph(a.ad_id, { status: 'ACTIVE' }, 'POST')) });
await new Promise(r => setTimeout(r, 8000));
receipt.readback = {
  campaign: await graph(st.campaign.id, { fields: 'status,effective_status' }),
  adset: await graph(st.adset.id, { fields: 'status,effective_status,start_time,daily_budget' }),
  ads: []
};
for (const a of st.ads) receipt.readback.ads.push({ code: a.code, ...(await graph(a.ad_id, { fields: 'name,status,effective_status,issues_info,ad_review_feedback' })) });
save('ACTIVATION_RECEIPT.json', receipt);
console.log(JSON.stringify({ campaign: receipt.readback.campaign, adset: receipt.readback.adset, ads: receipt.readback.ads.map(a => `${a.code} ${a.status}/${a.effective_status}${a.issues_info ? ' ISSUES ' + JSON.stringify(a.issues_info) : ''}`) }, null, 1));
