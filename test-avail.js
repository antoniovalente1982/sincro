const { Client } = require('pg');
require('dotenv').config({ path: '.env.local' });
async function test() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  const res = await client.query('SELECT user_id, start_time, end_time FROM calendar_availability');
  console.log(res.rows);
  await client.end();
}
test();
