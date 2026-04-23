const { Client } = require('pg');
const fs = require('fs');

async function run() {
  const connectionString = "postgresql://postgres.bktiuhxenxwhkgvdaxnp:Adpilotik1982%21@aws-1-eu-central-1.pooler.supabase.com:5432/postgres";
  const client = new Client({ connectionString });
  
  try {
    await client.connect();
    const sql = fs.readFileSync('./supabase/migrations/20260423_fix_rls_policies.sql', 'utf8');
    await client.query(sql);
    console.log("Migration applied successfully!");
  } catch (err) {
    console.error("Migration failed:", err);
  } finally {
    await client.end();
  }
}
run();
