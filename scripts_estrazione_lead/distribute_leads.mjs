import xlsx from 'xlsx';
import fs from 'fs';

const filePath = './LEADS MS.xlsx';
console.log(`Leggendo il file Excel: ${filePath} per calcolo priorità e divisione venditori...`);
const workbook = xlsx.readFile(filePath);
const sheets = workbook.SheetNames;

// 1. Costruiamo la mappa Email -> Telefono esplorando tutte le schede "Lead"
const phoneMap = new Map();

for (const sheetName of sheets) {
  const sheetLower = sheetName.toLowerCase();
  const worksheet = workbook.Sheets[sheetName];
  const rows = xlsx.utils.sheet_to_json(worksheet, { header: 1, defval: '' });
  
  if (rows.length === 0) continue;
  
  // Trova header
  let headerRowIndex = -1;
  let headers = [];
  for (let i = 0; i < Math.min(100, rows.length); i++) {
    const row = rows[i];
    if (!row) continue;
    const rowUpper = row.map(c => String(c).toUpperCase().trim());
    if (rowUpper.includes('NOME') && (rowUpper.includes('EMAIL') || rowUpper.includes('MAIL') || rowUpper.includes('E-MAIL')) && (rowUpper.includes('TELEFONO') || rowUpper.includes('NUMERO DI TELEFONO'))) {
      headerRowIndex = i;
      headers = rowUpper;
      break;
    }
  }

  if (headerRowIndex !== -1) {
    const idxEmail = headers.findIndex(h => h === 'EMAIL' || h === 'MAIL' || h === 'E-MAIL' || h === 'E MAIL');
    const idxTel = headers.findIndex(h => h === 'TELEFONO' || h === 'NUMERO DI TELEFONO');
    
    for (let i = headerRowIndex + 1; i < rows.length; i++) {
      const row = rows[i];
      if (!row || row.length === 0) continue;
      const email = idxEmail !== -1 ? String(row[idxEmail]).trim().toLowerCase() : '';
      const tel = idxTel !== -1 ? String(row[idxTel]).trim() : '';
      
      if (email && tel && tel !== '') {
        phoneMap.set(email, tel);
      }
    }
  }
}

// 2. Estraiamo i Lead "Appuntamenti Fatti e Non Comprati"
const allLeads = [];

const hotMonths = ['agosto', 'settembre', 'ottobre', 'novembre', 'dicembre'];
const warmMonths = ['aprile', 'maggio', 'giugno', 'luglio'];

for (const sheetName of sheets) {
  const worksheet = workbook.Sheets[sheetName];
  const rows = xlsx.utils.sheet_to_json(worksheet, { header: 1, defval: '' });
  
  let headerRowIndex = -1;
  let headers = [];
  
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

  if (headerRowIndex === -1) continue;

  const idxNome = headers.findIndex(h => h === 'NOME');
  const idxData = headers.findIndex(h => h === 'DATA' || h.includes('DATA ARRIVO') || h.includes('DATA INSERIMENTO'));
  const idxEmail = headers.findIndex(h => h === 'EMAIL' || h === 'MAIL' || h === 'E-MAIL' || h === 'E MAIL');
  const idxStatoApp = headers.findIndex(h => h === 'STATO APPUNTAMENTO');
  const idxAppFatto = headers.findIndex(h => h === 'APPUNTAMENTO FATTO');
  const idxEsito = headers.findIndex(h => h === 'ESITO');
  const idxVinta = headers.findIndex(h => h === 'VINTA');
  const idxPersa = headers.findIndex(h => h === 'PERSA');

  if (idxStatoApp === -1 && idxAppFatto === -1 && idxEsito === -1 && idxVinta === -1 && idxPersa === -1) {
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

    if (idxStatoApp !== -1) {
      const val = String(row[idxStatoApp]).toUpperCase().trim();
      if (val.includes('FATTO')) appFatto = true;
    } else if (idxAppFatto !== -1) {
      const val = String(row[idxAppFatto]).toUpperCase().trim();
      if (val.includes('FATTO')) appFatto = true;
    }

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

    if (appFatto && !haComprato) {
      // Look up phone -> SE NON C'E' IL NUMERO LO SCARTIAMO
      const phone = phoneMap.get(email.toLowerCase());
      if (!phone || phone === '') {
        continue; // ELIMINA I MANCANTI
      }

      // 3. Calcolo Priorità
      let priorita = 3; // Bassa (Fredda) di default
      const sheetNameLower = sheetName.toLowerCase();
      
      if (hotMonths.some(m => sheetNameLower.includes(m))) {
        priorita = 1;
      } else if (warmMonths.some(m => sheetNameLower.includes(m))) {
        priorita = 2;
      }
      
      allLeads.push({
        'Priorità': priorita,
        'Data Inserimento': data,
        'Nome': nome,
        'Email': email,
        'Telefono': phone,
        'Mese e Anno': sheetName,
        'Appuntamento Fatto': 'SÌ',
        'Esito': esitoTesto || 'PERSA'
      });
    }
  }
}

console.log(`Recuperati ${allLeads.length} leads validi (CON numero di telefono). Quelli "mancanti" sono stati eliminati.`);

// Ordinamento per priorità: prima i 1, poi i 2, poi i 3.
allLeads.sort((a, b) => a['Priorità'] - b['Priorità']);

// 4. Round Robin Distribution (Pareggiando i lead per numero)
const sellers = ['Diego_Napolitano', 'Margherita_Vitale', 'Chezia_Carminati', 'Jacob_Dridi'];
const sellersData = {
  'Diego_Napolitano': [],
  'Margherita_Vitale': [],
  'Chezia_Carminati': [],
  'Jacob_Dridi': []
};

let sellerIndex = 0;
for (const lead of allLeads) {
  const sellerName = sellers[sellerIndex];
  sellersData[sellerName].push(lead);
  sellerIndex = (sellerIndex + 1) % sellers.length; // Passa al successivo
}

// 5. Scrittura dei 4 file
const outputHeaders = ['Priorità', 'Data Inserimento', 'Nome', 'Telefono', 'Email', 'Mese/Foglio', 'Esito'];

for (const seller of sellers) {
  const data = sellersData[seller];
  if (data.length === 0) continue;
  
  const csvRows = [outputHeaders.join(',')];
  for (const r of data) {
    csvRows.push([
      `"${r['Priorità']}"`,
      `"${r['Data Inserimento']}"`,
      `"${r['Nome']}"`,
      `"${r['Telefono']}"`,
      `"${r['Email']}"`,
      `"${r['Mese e Anno']}"`,
      `"${r['Esito']}"`
    ].join(','));
  }
  
  const fileName = `Leads_Per_${seller}.csv`;
  fs.writeFileSync(fileName, csvRows.join('\n'));
  console.log(`✅ Sovrascritto ${fileName} con ${data.length} leads.`);
}

console.log('\nProcesso completato con successo!');
