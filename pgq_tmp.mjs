import pg from 'pg'; import fs from 'fs';
const url = fs.readFileSync('.env.local','utf8').match(/^DATABASE_URL=(.*)$/m)[1].replace(/^"|"$/g,'');
const c = new pg.Client({ connectionString: url, ssl:{rejectUnauthorized:false} });
await c.connect();

// job da spegnere: tutta l'AI che analizza campagne PAUSED + i report ridondanti
const spegni = [1, 4, 5, 6, 7, 8, 9, 10, 11, 12, 14];
// tenuti accesi: 2 (reset quota setter, SQL puro) e 13 (report Telegram giornaliero)

for (const id of spegni) {
  await c.query('select cron.alter_job($1::bigint, active := false)', [id]);
}

const r = await c.query('select jobid, schedule, active from cron.job order by jobid');
console.log('=== STATO FINALE CRON SUPABASE ===');
for (const j of r.rows) console.log(`  job ${String(j.jobid).padStart(2)}  ${j.schedule.padEnd(14)} ${j.active ? 'ATTIVO' : 'spento'}`);
const on = r.rows.filter(j => j.active).length;
console.log(`\n  attivi: ${on} su ${r.rows.length}`);
await c.end();
