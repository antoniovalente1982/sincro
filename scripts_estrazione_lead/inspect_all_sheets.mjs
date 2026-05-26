import xlsx from 'xlsx';

const filePath = './LEADS MS.xlsx';
const workbook = xlsx.readFile(filePath);
console.log("Tutti i fogli presenti nel file:");
workbook.SheetNames.forEach((s, i) => console.log(`${i+1}. ${s}`));
