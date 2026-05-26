import fs from 'fs';

const sellers = ['Diego_Napolitano', 'Margherita_Vitale', 'Chezia_Carminati', 'Jacob_Dridi'];
const outputHeaders = ['Priorità', 'Data Inserimento', 'Nome', 'Telefono', 'Email', 'Mese/Foglio', 'Esito/Note'];

for (const seller of sellers) {
  const allRows = [];
  
  // Funzione helper per leggere i file saltando l'header
  const parseFile = (fileName) => {
    if (!fs.existsSync(fileName)) return;
    const content = fs.readFileSync(fileName, 'utf-8');
    const lines = content.split('\n');
    
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      
      // Il parse del CSV semplice (funziona se non ci sono virgole interne problematiche, 
      // ma noi abbiamo generato i campi racchiusi tra virgolette, es: "1","Data","Nome",...)
      // Split by '","' to handle safely. We know the format is exactly:
      // "Priorità","Data Inserimento","Nome","Telefono","Email","Mese/Foglio","CampoExtra"
      const cleanLine = line.replace(/^"|"$/g, ''); 
      const parts = cleanLine.split('","');
      
      if (parts.length >= 7) {
        allRows.push({
          priorita: parseInt(parts[0], 10),
          data: parts[1],
          nome: parts[2],
          telefono: parts[3],
          email: parts[4],
          mese: parts[5],
          extra: parts[6] // Esito o Descrizione
        });
      }
    }
  };

  parseFile(`Leads_Per_${seller}.csv`);
  parseFile(`Leads_SenzaApp_Per_${seller}.csv`);
  
  // Ordina per priorità (dal 1 al 4)
  allRows.sort((a, b) => a.priorita - b.priorita);
  
  // Crea il CSV finale
  const csvOutput = [outputHeaders.join(',')];
  for (const r of allRows) {
    csvOutput.push([
      `"${r.priorita}"`,
      `"${r.data}"`,
      `"${r.nome}"`,
      `"${r.telefono}"`,
      `"${r.email}"`,
      `"${r.mese}"`,
      `"${r.extra}"`
    ].join(','));
  }
  
  const finalFileName = `Lista_Completa_${seller}.csv`;
  fs.writeFileSync(finalFileName, csvOutput.join('\n'));
  console.log(`✅ Creato ${finalFileName} con ${allRows.length} leads in totale.`);
}

console.log('Merge e ordinamento completati!');
