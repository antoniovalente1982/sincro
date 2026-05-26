import xlsx from 'xlsx';

const filePath = './LEADS MS.xlsx';
const workbook = xlsx.readFile(filePath);
const sheets = workbook.SheetNames.filter(s => s.toLowerCase().includes('lead'));

for (const sheetName of sheets) {
  const worksheet = workbook.Sheets[sheetName];
  const rows = xlsx.utils.sheet_to_json(worksheet, { header: 1, defval: '' });
  
  if (rows.length > 0) {
    console.log(`Foglio ${sheetName}:`, rows[0].map(c => String(c).trim()).slice(0, 10));
  }
}
