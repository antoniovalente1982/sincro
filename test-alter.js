const { Client } = require('pg');
require('dotenv').config({ path: '.env.local' });
async function test() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  const sql = "ALTER TABLE organization_members ADD COLUMN in_round_robin BOOLEAN DEFAULT true";
  await client.query(sql);
  console.log('ALTER successfully executed.');
  await client.end();
}
test().catch(e => console.error(e));
