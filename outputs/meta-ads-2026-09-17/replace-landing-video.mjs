import fs from 'node:fs';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

// Antonio supplied this new VTurb player for the existing category landing.
const account = 'aa89ca91-c4e7-487e-aa5a-13ea76503b32';
const player = '6aab8c0b901f91136b129b4b';
const media = '6aab8c059fb45fdc15d78c4c';
const playerUrl = `https://scripts.converteai.net/${account}/players/${player}/v4/player.js`;
const embedUrl = `https://scripts.converteai.net/${account}/players/${player}/v4/embed.html`;
const manifestUrl = `https://cdn.converteai.net/${account}/${media}/main.m3u8`;
const embed = `<vturb-smartplayer id="vid-${player}" style="display: block; margin: 0 auto; width: 100%;"><div class="vturb-player-placeholder" style="position: relative; width: 100%; padding: 56.25% 0 0; z-index: 0; background-color: black;"></div></vturb-smartplayer><script type="text/javascript">var s=document.createElement("script");s.src="${playerUrl}";s.async=true;document.head.appendChild(s);</script>`;
const mode = process.argv[2];
if (!['check', 'apply'].includes(mode)) throw new Error('Use check or apply.');
const preflight = await Promise.all([playerUrl, embedUrl, manifestUrl].map(async url => {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Video resource unavailable: ${response.status} ${url}`);
  const body = await response.text();
  if (url === embedUrl && !body.includes(player)) throw new Error('Unexpected embed response.');
  if (url === manifestUrl && !body.startsWith('#EXTM3U')) throw new Error('Invalid streaming manifest.');
  return { url, status: response.status, bytes: Buffer.byteLength(body), content_type: response.headers.get('content-type'), ...(url === embedUrl ? {has_player_script:body.includes(playerUrl),has_preloads:body.includes('preload')} : {}) };
}));
const cfg = dotenv.parse(fs.readFileSync('.env.local'));
const sb = createClient(cfg.NEXT_PUBLIC_SUPABASE_URL, cfg.SUPABASE_SERVICE_ROLE_KEY);
const org = 'a5dd4842-f0ea-4909-b4a3-be2cb1c6ffa5';
const id = 'bb4f12d9-4709-4ecf-9d1a-1a96c0960e46';
const unwrap = ({data,error}) => { if(error) throw new Error(error.message); return data; };
const query = () => sb.from('funnels').select('id,slug,status,settings,updated_at').eq('id',id).eq('organization_id',org).eq('slug','salto-di-qualita').single();
const before = unwrap(await query());
if (before.status !== 'active' || before.settings.template !== 'metodo_sincro' || before.settings.messaging_theme !== 'salto_categoria') throw new Error('Unexpected funnel configuration.');
const dir = 'outputs/meta-ads-2026-09-17/';
const backup = dir + 'settings-before-new-video.json';
if (!fs.existsSync(backup)) fs.writeFileSync(backup, JSON.stringify(before,null,2));
fs.writeFileSync(dir + 'new-video-preflight.json', JSON.stringify(preflight,null,2));
if (mode === 'apply' && before.settings.video_embed !== embed) {
  const checked = JSON.parse(fs.readFileSync(backup));
  if (before.settings.video_embed !== checked.settings.video_embed) throw new Error('Video changed since review; aborting.');
  const at = new Date().toISOString();
  const settings = {...before.settings,video_embed:embed,video_revision:player,video_revision_started_at:at};
  const updated = unwrap(await sb.from('funnels').update({settings,updated_at:at}).eq('id',id).eq('organization_id',org).eq('updated_at',before.updated_at).eq('settings',JSON.stringify(before.settings)).select('id'));
  if (updated.length !== 1) throw new Error('Concurrent change detected; nothing overwritten.');
}
const after = mode === 'apply' ? unwrap(await query()) : before;
if (mode === 'apply') {
  if (after.settings.video_embed !== embed) throw new Error('Stored video verification failed.');
  for (const [key,value] of Object.entries(before.settings)) {
    if (['video_embed','video_revision','video_revision_started_at'].includes(key)) continue;
    if (JSON.stringify(after.settings[key]) !== JSON.stringify(value)) throw new Error('Other setting changed: '+key);
  }
  fs.writeFileSync(dir + 'settings-after-new-video.json',JSON.stringify(after,null,2));
}
console.log(JSON.stringify({mode,preflight,slug:after.slug,previous_player:before.settings.video_embed.match(/players\/([^/]+)/)?.[1],new_player:player,applied:after.settings.video_embed===embed,updated_at:after.updated_at},null,2));
