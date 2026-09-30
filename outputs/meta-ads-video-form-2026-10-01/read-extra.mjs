import { account, graph, save, db } from './meta-client.mjs';
import fs from 'node:fs';
const src = JSON.parse(fs.readFileSync(new URL('./SOURCE_CAMPAIGN_READ.json', import.meta.url)));
const ads = src.matching_campaigns[0].ads.map(a => ({ name: a.name, oss: a.creative?.object_story_spec, url_tags: a.creative?.url_tags }));
const fam = await graph('search', { type: 'adTargetingCategory', class: 'family_statuses' });
const { data: tags } = await db.from('funnel_routing_engine').select('trigger_keyword,angle_name,headline').limit(100);
save('EXTRA_READ.json', { ads, family_statuses: fam.data, tags });
console.log(JSON.stringify({ identity: ads.map(a => ({ name: a.name, page: a.oss?.page_id, ig: a.oss?.instagram_user_id, link: a.oss?.video_data?.call_to_action?.value?.link || a.oss?.link_data?.link, cta: a.oss?.video_data?.call_to_action?.type, url_tags: a.url_tags })), family: fam.data.map(f => `${f.id} ${f.name} (${f.audience_size_lower_bound || ''})`), tags: tags?.map(t => t.trigger_keyword) }, null, 1));
