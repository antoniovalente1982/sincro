import fs from 'node:fs';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

// Project created in Antonio's existing Clarity account for this adult-parent landing.
const project = 'yjm4a7mui9';
const org = 'a5dd4842-f0ea-4909-b4a3-be2cb1c6ffa5';
const id = 'bb4f12d9-4709-4ecf-9d1a-1a96c0960e46';
const mode = process.argv[2];
if (!['check', 'apply'].includes(mode)) throw new Error('Use check or apply.');
const cfg = dotenv.parse(fs.readFileSync('.env.local'));
const sb = createClient(cfg.NEXT_PUBLIC_SUPABASE_URL, cfg.SUPABASE_SERVICE_ROLE_KEY);
const unwrap = ({ data, error }) => { if (error) throw new Error(error.message); return data; };
const query = () => sb.from('funnels').select('id,slug,status,settings,updated_at').eq('id',id).eq('organization_id',org).eq('slug','salto-di-qualita').single();
const before = unwrap(await query());
if (before.status !== 'active' || before.settings.template !== 'metodo_sincro' || before.settings.messaging_theme !== 'salto_categoria') throw new Error('Unexpected funnel configuration.');
if (before.settings.clarity_project_id && before.settings.clarity_project_id !== project) throw new Error('Another Clarity project is already configured.');
const dir = 'outputs/meta-ads-2026-09-17/';
if (mode === 'apply' && before.settings.clarity_project_id !== project) {
    const at = new Date().toISOString();
    const backup = dir + 'settings-before-clarity-' + at.replaceAll(':','-') + '.json';
    fs.writeFileSync(backup, JSON.stringify(before,null,2), {flag:'wx'});
    const settings = {...before.settings, clarity_project_id:project, clarity_started_at:at};
    const updated = unwrap(await sb.from('funnels').update({settings,updated_at:at}).eq('id',id).eq('organization_id',org).eq('updated_at',before.updated_at).eq('settings',JSON.stringify(before.settings)).select('id'));
    if (updated.length !== 1) throw new Error('Concurrent change detected; no settings overwritten.');
}
const after = mode === 'apply' ? unwrap(await query()) : before;
if (mode === 'apply') {
    if (after.settings.clarity_project_id !== project) throw new Error('Clarity project verification failed.');
    for (const [key,value] of Object.entries(before.settings)) {
        if (['clarity_project_id','clarity_started_at'].includes(key)) continue;
        if (JSON.stringify(after.settings[key]) !== JSON.stringify(value)) throw new Error('Other setting changed: '+key);
    }
    fs.writeFileSync(dir+'settings-after-clarity.json',JSON.stringify(after,null,2));
}
console.log(JSON.stringify({mode,slug:after.slug,project:after.settings.clarity_project_id||null,started_at:after.settings.clarity_started_at||null,updated_at:after.updated_at},null,2));
