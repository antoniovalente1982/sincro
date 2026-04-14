const { Client } = require('pg');
require('dotenv').config({ path: '.env.local' });
async function test() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  const res = await client.query("SELECT id, title, start_time, closer_id, lead_id FROM calendar_events ORDER BY created_at DESC LIMIT 5");
  console.log(res.rows);
  await client.end();
}
test();
