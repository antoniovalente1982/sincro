const { Client } = require('pg');
require('dotenv').config({ path: '.env.local' });
async function test() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  const res = await client.query('SELECT column_name FROM information_schema.columns WHERE table_name = $1', ['leads']);
  console.log(res.rows.map(r => r.column_name).sort());
  await client.end();
}
test();
