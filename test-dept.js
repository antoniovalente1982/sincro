const { Client } = require('pg');
require('dotenv').config({ path: '.env.local' });
async function test() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  const res = await client.query('SELECT user_id, role, department, in_round_robin FROM organization_members');
  console.log(res.rows);
  await client.end();
}
test();
