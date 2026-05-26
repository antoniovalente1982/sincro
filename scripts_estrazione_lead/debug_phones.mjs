import fs from 'fs';
import xlsx from 'xlsx';

const sellers = ['Diego_Napolitano', 'Margherita_Vitale', 'Chezia_Carminati', 'Jacob_Dridi'];
let mancanti = [];

for (const seller of sellers) {
  const content = fs.readFileSync(`Leads_Per_${seller}.csv`, 'utf-8');
  const lines = content.split('\n');
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) continue;
    const parts = line.split(','); // Attenzione se ci sono virgole nei valori tra virgolette, ma va bene per un test veloce
    // Header: Priorità, Data Inserimento, Nome, Telefono, Email, Mese/Foglio, Esito
    const telefono = parts[3].replace(/"/g, '');
    const email = parts[4].replace(/"/g, '');
    const nome = parts[2].replace(/"/g, '');
    
    if (telefono === 'MANCANTE') {
      mancanti.push({ email, nome });
    }
  }
}

console.log(`Totale mancanti: ${mancanti.length}`);

// Proviamo a cercare questi mancanti in TUTTI i fogli
const filePath = './LEADS MS.xlsx';
const workbook = xlsx.readFile(filePath);
const sheets = workbook.SheetNames;

let trovati = 0;

for (const sheetName of sheets) {
  const worksheet = workbook.Sheets[sheetName];
  const rows = xlsx.utils.sheet_to_json(worksheet, { header: 1, defval: '' });
  
  if (rows.length === 0) continue;
  
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (!row) continue;
    const rowStr = row.join(' ').toLowerCase();
    
    // Controlliamo se qualche email mancante è in questa riga
    for (const m of mancanti) {
      if (rowStr.includes(m.email.toLowerCase())) {
        // Trovata la riga, vediamo se c'è qualcosa che assomiglia a un numero di telefono
        const phoneRegex = /(?:\+39|0039)?[\s\-]?3\d{2}[\s\-]?\d{6,7}/;
        const match = row.join(' ').match(phoneRegex);
        if (match && !m.trovato) {
          m.trovato = true;
          trovati++;
          console.log(`Trovato numero per ${m.email} in foglio ${sheetName}: ${match[0]}`);
        }
      }
    }
  }
}

console.log(`Su ${mancanti.length} mancanti, ne abbiamo recuperati ${trovati} con ricerca profonda in tutti i fogli.`);
