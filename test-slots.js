const { Client } = require('pg');
require('dotenv').config({ path: '.env.local' });
async function test() {
  const fetch = (await import('node-fetch')).default;
  const from = new Date().toISOString();
  const to = new Date(Date.now() + 7 * 86400000).toISOString();
  
  // Directly test the function logic or hit the local dev server.
  // Since we don't have local dev server running, let's just write the exact slot generator logic here to debug it.
  const availability = []; // empty array
  const effectiveAvailability = availability.length > 0 ? availability : [0, 1, 2, 3, 4, 5, 6].map(day => ({
            day_of_week: day,
            start_time: '00:00',
            end_time: '23:59',
            slot_duration_minutes: 45,
            break_between_slots: 0
  }));

  const slots = [];
  const cursor = new Date(from);
  cursor.setHours(0, 0, 0, 0);
  const endDate = new Date(to);

  while (cursor < endDate) {
      const dayOfWeek = cursor.getDay();
      const dayAvail = effectiveAvailability.find((a) => a.day_of_week === dayOfWeek);

      if (dayAvail) {
          const [startH, startM] = dayAvail.start_time.split(':').map(Number);
          const [endH, endM] = dayAvail.end_time.split(':').map(Number);
          const slotDuration = dayAvail.slot_duration_minutes || 45;

          let slotStart = new Date(cursor);
          slotStart.setHours(startH, startM, 0, 0);

          const dayEnd = new Date(cursor);
          dayEnd.setHours(endH, endM, 0, 0);

          while (slotStart.getTime() + slotDuration * 60000 <= dayEnd.getTime()) {
              const slotEnd = new Date(slotStart.getTime() + slotDuration * 60000);
              
              slots.push({
                  date: cursor.toISOString().split('T')[0],
                  start: slotStart.toISOString(),
                  end: slotEnd.toISOString(),
              });

              slotStart = new Date(slotStart.getTime() + slotDuration * 60000);
          }
      }
      cursor.setDate(cursor.getDate() + 1);
  }
  
  console.log(`Generated ${slots.length} slots.`);
  if (slots.length > 0) {
      console.log(slots.slice(0, 5));
  }
}
test();
