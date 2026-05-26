import xlsx from 'xlsx';
import fs from 'fs';

const filePath = './LEADS MS.xlsx';
console.log(`Leggendo il file Excel: ${filePath} per estrarre lead puri e scartare il junk...`);
const workbook = xlsx.readFile(filePath);
const sheets = workbook.SheetNames;

// 1. Raccogliamo tutte le email di chi HA PRESO (o provato a prendere) UN APPUNTAMENTO in passato
const bookedEmails = new Set();

for (const sheetName of sheets) {
  const worksheet = workbook.Sheets[sheetName];
  const rows = xlsx.utils.sheet_to_json(worksheet, { header: 1, defval: '' });
  
  if (rows.length === 0) continue;
  
  let headerRowIndex = -1;
  let headers = [];
  
  for (let i = 0; i < Math.min(100, rows.length); i++) {
    const row = rows[i];
    if (!row) continue;
    const rowUpper = row.map(c => String(c).toUpperCase().trim());
    if (rowUpper.includes('EMAIL') || rowUpper.includes('MAIL') || rowUpper.includes('E-MAIL')) {
      // Controlliamo se ci sono colonne "Appuntamenti"
      const hasApp = rowUpper.some(h => h.includes('APPUNTAMENTO') || h === 'VENDITORE' || h === 'ESITO' || h === 'PROVA');
      if (hasApp) {
        headerRowIndex = i;
        headers = rowUpper;
        break;
      }
    }
  }

  if (headerRowIndex !== -1) {
    const idxEmail = headers.findIndex(h => h === 'EMAIL' || h === 'MAIL' || h === 'E-MAIL' || h === 'E MAIL');
    if (idxEmail !== -1) {
      for (let i = headerRowIndex + 1; i < rows.length; i++) {
        const row = rows[i];
        if (!row || row.length === 0) continue;
        const email = String(row[idxEmail]).trim().toLowerCase();
        if (email) bookedEmails.add(email);
      }
    }
  }
}

console.log(`Trovate ${bookedEmails.size} email associate a tentativi di appuntamento (saranno escluse).`);

// 2. Estrazione Lead Puri dalle schede "Lead" e opt-in
const pureLeads = [];
const junkKeywords = [
  'fuori target', 'sbagliato', 'inesistente', 'non interessat', 
  'bambino', 'piccolo', 'fuori età', 'già cliente', 'non vuole', 
  'lasciare stare', 'non risponde', 'spento', 'non disponibile', 
  'sconosciuto', 'falso', 'numero inesatto', 'numero errato'
];

for (const sheetName of sheets) {
  const sheetLower = sheetName.toLowerCase();
  const worksheet = workbook.Sheets[sheetName];
  const rows = xlsx.utils.sheet_to_json(worksheet, { header: 1, defval: '' });
  
  if (rows.length === 0) continue;
  
  let headerRowIndex = -1;
  let headers = [];
  for (let i = 0; i < Math.min(100, rows.length); i++) {
    const row = rows[i];
    if (!row) continue;
    const rowUpper = row.map(c => String(c).toUpperCase().trim());
    if (rowUpper.includes('NOME') && (rowUpper.includes('EMAIL') || rowUpper.includes('MAIL')) && (rowUpper.includes('TELEFONO') || rowUpper.includes('NUMERO DI TELEFONO'))) {
      headerRowIndex = i;
      headers = rowUpper;
      break;
    }
  }

  if (headerRowIndex === -1) continue;

  const idxNome = headers.findIndex(h => h === 'NOME');
  const idxData = headers.findIndex(h => h === 'DATA' || h.includes('DATA ARRIVO') || h.includes('DATA INSERIMENTO'));
  const idxEmail = headers.findIndex(h => h === 'EMAIL' || h === 'MAIL' || h === 'E-MAIL' || h === 'E MAIL');
  const idxTel = headers.findIndex(h => h === 'TELEFONO' || h === 'NUMERO DI TELEFONO');
  const idxDesc = headers.findIndex(h => h === 'DESCRIZIONE' || h === 'NOTE');

  for (let i = headerRowIndex + 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.length === 0 || !row[idxNome]) continue;

    const email = idxEmail !== -1 ? String(row[idxEmail]).trim().toLowerCase() : '';
    const tel = idxTel !== -1 ? String(row[idxTel]).trim() : '';
    const desc = idxDesc !== -1 ? String(row[idxDesc]).toLowerCase() : '';

    // Filtro 1: Devono avere tel e mail
    if (!email || !tel || tel === '') continue;

    // Filtro 2: Non devono mai aver provato a fare un appuntamento
    if (bookedEmails.has(email)) continue;

    // Filtro 3: Esclusione spazzatura
    let isJunk = false;
    for (const kw of junkKeywords) {
      if (desc.includes(kw)) {
        isJunk = true;
        break;
      }
    }
    if (isJunk) continue;

    const nome = String(row[idxNome]).trim();
    const data = idxData !== -1 ? String(row[idxData]).trim() : '';

    pureLeads.push({
      'Priorità': 4,
      'Data Inserimento': data,
      'Nome': nome,
      'Telefono': tel,
      'Email': email,
      'Mese e Anno': sheetName,
      'Descrizione': String(row[idxDesc] || '').trim().replace(/"/g, '""')
    });
  }
}

// Rimuovi eventuali duplicati basati sull'email (nel caso di doppi opt-in)
const uniqueLeads = [];
const seenEmails = new Set();
for (const lead of pureLeads) {
  if (!seenEmails.has(lead.Email)) {
    seenEmails.add(lead.Email);
    uniqueLeads.push(lead);
  }
}

console.log(`Recuperati ${uniqueLeads.length} lead PURI, VERGINI e FILTRATI dallo spam/junk.`);

// 3. Round Robin Distribution (Pareggiando i lead per numero)
const sellers = ['Diego_Napolitano', 'Margherita_Vitale', 'Chezia_Carminati', 'Jacob_Dridi'];
const sellersData = {
  'Diego_Napolitano': [],
  'Margherita_Vitale': [],
  'Chezia_Carminati': [],
  'Jacob_Dridi': []
};

let sellerIndex = 0;
for (const lead of uniqueLeads) {
  const sellerName = sellers[sellerIndex];
  sellersData[sellerName].push(lead);
  sellerIndex = (sellerIndex + 1) % sellers.length;
}

// 4. Scrittura dei 4 file
const outputHeaders = ['Priorità', 'Data Inserimento', 'Nome', 'Telefono', 'Email', 'Mese/Foglio', 'Descrizione'];

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
      `"${r['Descrizione']}"`
    ].join(','));
  }
  
  const fileName = `Leads_SenzaApp_Per_${seller}.csv`;
  fs.writeFileSync(fileName, csvRows.join('\n'));
  console.log(`✅ Creato ${fileName} con ${data.length} leads.`);
}

console.log('\nProcesso completato con successo!');
