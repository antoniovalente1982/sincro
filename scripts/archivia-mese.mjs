#!/usr/bin/env node
/**
 * Archiviazione mensile dei dati Sincro.
 *
 *   node scripts/archivia-mese.mjs 2026-07     archivia un mese
 *   node scripts/archivia-mese.mjs --tutti     archivia ogni mese passato
 *   node scripts/archivia-mese.mjs --elenco    mostra cosa c'e' gia' archiviato
 *
 * Aggiungi --forza per riscrivere un archivio esistente.
 *
 * Gli archivi finiscono in ~/Desktop/sincro-archivi/AAAA-MM.json.gz
 * Sono file tuoi, su disco: restano leggibili anche senza Supabase.
 */
import pg from 'pg';
import fs from 'fs';
import path from 'path';
import zlib from 'zlib';

const DEST = path.join(process.env.HOME, 'Desktop', 'sincro-archivi');

// Tabelle con una data che permette di tagliarle per mese.
const TABELLE = [
  'leads', 'lead_activities', 'funnel_submissions', 'calendar_events',
  'page_views', 'tracked_events', 'notifications', 'ai_episodes',
  'lead_distribution_sessions', 'revenue_attribution',
];

function leggiUrl() {
  const env = fs.readFileSync(new URL('../.env.local', import.meta.url), 'utf8');
  return env.match(/^DATABASE_URL=(.*)$/m)[1].replace(/^"|"$/g, '');
}

async function mesiDisponibili(c) {
  const r = await c.query(`
    select distinct to_char(created_at,'YYYY-MM') as mese
    from leads where created_at is not null
    union
    select distinct to_char(created_at,'YYYY-MM') from page_views where created_at is not null
    order by 1`);
  return r.rows.map(x => x.mese);
}

async function archivia(c, mese, forza) {
  fs.mkdirSync(DEST, { recursive: true });
  const file = path.join(DEST, `${mese}.json.gz`);
  if (fs.existsSync(file) && !forza) {
    console.log(`  ${mese}  gia' archiviato, salto  (--forza per riscrivere)`);
    return null;
  }

  const dentro = {};
  let righe = 0;
  for (const t of TABELLE) {
    try {
      const r = await c.query(
        `select * from public."${t}"
         where created_at >= $1::date and created_at < ($1::date + interval '1 month')`,
        [`${mese}-01`]
      );
      if (r.rows.length) { dentro[t] = r.rows; righe += r.rows.length; }
    } catch (e) {
      if (e.code !== '42P01' && e.code !== '42703') throw e;   // tabella o colonna assente: ignora
    }
  }

  const pacco = { mese, creato: new Date().toISOString(), righe, tabelle: Object.keys(dentro), dati: dentro };
  const gz = zlib.gzipSync(Buffer.from(JSON.stringify(pacco), 'utf8'));
  fs.writeFileSync(file, gz);
  console.log(`  ${mese}  ${String(righe).padStart(7)} righe  ${(gz.length / 1024).toFixed(0).padStart(5)} KB  ${Object.keys(dentro).length} tabelle`);
  return { mese, righe, byte: gz.length };
}

function elenco() {
  if (!fs.existsSync(DEST)) return console.log('Nessun archivio: la cartella non esiste ancora.');
  const f = fs.readdirSync(DEST).filter(x => x.endsWith('.json.gz')).sort();
  if (!f.length) return console.log('Nessun archivio presente.');
  console.log(`Archivi in ${DEST}\n`);
  let tot = 0;
  for (const x of f) {
    const s = fs.statSync(path.join(DEST, x));
    const d = JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(DEST, x))));
    tot += s.size;
    console.log(`  ${x.replace('.json.gz', '')}  ${String(d.righe).padStart(7)} righe  ${(s.size / 1024).toFixed(0).padStart(5)} KB`);
  }
  console.log(`\n  ${f.length} archivi, ${(tot / 1048576).toFixed(1)} MB in totale`);
}

const arg = process.argv[2];
if (!arg) {
  console.log('Uso: node scripts/archivia-mese.mjs <AAAA-MM> | --tutti | --elenco  [--forza]');
  process.exit(1);
}
if (arg === '--elenco') { elenco(); process.exit(0); }

const forza = process.argv.includes('--forza');
const c = new pg.Client({ connectionString: leggiUrl(), ssl: { rejectUnauthorized: false } });
await c.connect();

console.log(`Archivio in ${DEST}\n`);
if (arg === '--tutti') {
  const mesi = await mesiDisponibili(c);
  for (const m of mesi) await archivia(c, m, forza);
} else {
  if (!/^\d{4}-\d{2}$/.test(arg)) { console.error('Formato mese non valido: usa AAAA-MM'); process.exit(1); }
  await archivia(c, arg, forza);
}
await c.end();
console.log('\nFatto.');
