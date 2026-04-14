const { Client } = require('pg');
require('dotenv').config({ path: '.env.local' });
async function test() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  const res = await client.query("SELECT id, full_name, email FROM profiles WHERE id IN ('b9a3a458-20e3-4ced-b442-fd100e97a51f', '97e1fe48-a3bb-474a-84ad-eb0ed7f252c9', 'e8dae4eb-c741-4e87-9407-44b8f4d4fdd4', '658024aa-5032-43f8-9f91-ec1f2dcad583', '36bca03b-f840-4d21-ab3d-fa316703a4cb')");
  console.log(res.rows);
  await client.end();
}
test();
