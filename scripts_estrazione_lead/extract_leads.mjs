import xlsx from 'xlsx';
import fs from 'fs';

const filePath = './LEADS MS.xlsx';
console.log(`Leggendo il file: ${filePath}`);

const workbook = xlsx.readFile(filePath);
const sheets = workbook.SheetNames;

const results = [];

for (const sheetName of sheets) {
  const worksheet = workbook.Sheets[sheetName];
  const rows = xlsx.utils.sheet_to_json(worksheet, { header: 1, defval: '' });
  
  let headerRowIndex = -1;
  let headers = [];
  
  // Cerchiamo la riga di intestazione (quella che contiene NOME e EMAIL/MAIL)
  for (let i = 0; i < Math.min(100, rows.length); i++) {
    const row = rows[i];
    if (!row) continue;
    const rowUpper = row.map(c => String(c).toUpperCase().trim());
    if (rowUpper.includes('NOME') && (rowUpper.includes('EMAIL') || rowUpper.includes('MAIL') || rowUpper.includes('E-MAIL'))) {
      headerRowIndex = i;
      headers = rowUpper;
      break;
    }
  }

  if (headerRowIndex === -1) {
    console.log(`⚠️  Nessuna intestazione NOME/EMAIL trovata nel foglio "${sheetName}". Salto.`);
    continue;
  }

  // Mappa degli indici
  const idxNome = headers.findIndex(h => h === 'NOME');
  const idxData = headers.findIndex(h => h === 'DATA' || h.includes('DATA ARRIVO') || h.includes('DATA INSERIMENTO'));
  const idxEmail = headers.findIndex(h => h === 'EMAIL' || h === 'MAIL' || h === 'E-MAIL' || h === 'E MAIL');
  
  // Colonne relative all'appuntamento
  const idxStatoApp = headers.findIndex(h => h === 'STATO APPUNTAMENTO');
  const idxAppFatto = headers.findIndex(h => h === 'APPUNTAMENTO FATTO');
  
  // Colonne relative all'esito
  const idxEsito = headers.findIndex(h => h === 'ESITO');
  const idxVinta = headers.findIndex(h => h === 'VINTA');
  const idxPersa = headers.findIndex(h => h === 'PERSA');

  // Se non c'è traccia di info sugli appuntamenti, saltiamo il foglio
  if (idxStatoApp === -1 && idxAppFatto === -1 && idxEsito === -1 && idxVinta === -1 && idxPersa === -1) {
    console.log(`⚠️  Nessuna colonna appuntamento/esito trovata in "${sheetName}". Salto.`);
    continue;
  }

  for (let i = headerRowIndex + 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.length === 0 || !row[idxNome]) continue;

    const nome = String(row[idxNome]).trim();
    const data = idxData !== -1 ? String(row[idxData]).trim() : '';
    const email = idxEmail !== -1 ? String(row[idxEmail]).trim() : '';
    
    let appFatto = false;
    let haComprato = false;
    let esitoTesto = '';

    // Logica Appuntamento
    if (idxStatoApp !== -1) {
      const val = String(row[idxStatoApp]).toUpperCase().trim();
      if (val.includes('FATTO')) appFatto = true;
    } else if (idxAppFatto !== -1) {
      const val = String(row[idxAppFatto]).toUpperCase().trim();
      if (val.includes('FATTO')) appFatto = true;
    }

    // Logica Esito
    if (idxEsito !== -1) {
      const val = String(row[idxEsito]).toUpperCase().trim();
      esitoTesto = val;
      if (val.includes('VINTA') || val.includes('PAGATO')) haComprato = true;
    } else {
      let isVinta = false;
      let isPersa = false;
      if (idxVinta !== -1) {
         const v = String(row[idxVinta]).toUpperCase().trim();
         if (v !== '') { isVinta = true; esitoTesto = 'VINTA'; haComprato = true; }
      }
      if (idxPersa !== -1 && !isVinta) {
         const p = String(row[idxPersa]).toUpperCase().trim();
         if (p.includes('PERSA')) { isPersa = true; esitoTesto = 'PERSA'; }
      }
    }

    // Condizione finale: ha fatto l'appuntamento MA NON ha comprato
    if (appFatto && !haComprato) {
      results.push({
        'Data': data,
        'Nome': nome,
        'Email': email,
        'Mese e Anno': sheetName,
        'Appuntamento Fatto': 'SÌ',
        'Esito': esitoTesto || 'PERSA'
      });
    }
  }
}

if (results.length > 0) {
  const outputHeaders = ['Data', 'Nome', 'Email', 'Mese e Anno', 'Appuntamento Fatto', 'Esito'];
  const csvRows = [outputHeaders.join(',')];
  for (const r of results) {
    csvRows.push([
      `"${r['Data']}"`,
      `"${r['Nome']}"`,
      `"${r['Email']}"`,
      `"${r['Mese e Anno']}"`,
      `"${r['Appuntamento Fatto']}"`,
      `"${r['Esito']}"`
    ].join(','));
  }
  fs.writeFileSync('Lead_Da_Recuperare_Tutti.csv', csvRows.join('\n'));
  console.log(`\n✅ SUCCESSO! Creato file Lead_Da_Recuperare_Tutti.csv con ${results.length} contatti totali da tutti i fogli.`);
} else {
  console.log('\nNessun contatto trovato con i criteri specificati.');
}
