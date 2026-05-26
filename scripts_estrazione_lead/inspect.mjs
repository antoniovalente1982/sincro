import xlsx from 'xlsx';

const filePath = './LEADS MS.xlsx';
const workbook = xlsx.readFile(filePath);
const sheetsToInspect = ['App. Maggio 2025', 'Lead Maggio 2025'];

for (const sheetName of sheetsToInspect) {
  if (!workbook.Sheets[sheetName]) continue;
  const worksheet = workbook.Sheets[sheetName];
  const rows = xlsx.utils.sheet_to_json(worksheet, { header: 1, defval: '' });
  
  console.log(`\n=== Indagine foglio: ${sheetName} ===`);
  for (let i = 0; i < Math.min(10, rows.length); i++) {
    console.log(`Riga ${i}:`, rows[i].map(c => String(c).trim()));
  }
}
