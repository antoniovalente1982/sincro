import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const CANVA_API_URL = 'https://api.canva.com/v1';

async function canvaRequest(method, endpoint, body = null) {
  const token = process.env.CANVA_ACCESS_TOKEN;
  if (!token) {
    throw new Error('Mancante CANVA_ACCESS_TOKEN nel file .env.local');
  }

  const url = `${CANVA_API_URL}/${endpoint}`;
  const options = {
    method,
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  };

  if (body) {
    options.body = JSON.stringify(body);
  }

  const res = await fetch(url, options);
  const data = await res.json();
  
  if (!res.ok) {
    console.error(`❌ Canva API Error [${res.status}] ${endpoint}:`, JSON.stringify(data, null, 2));
    throw new Error(data.message || 'Errore Canva API');
  }

  return data;
}

// 1. Ottiene la struttura dei campi di un Brand Template
export async function getTemplateDetails(templateId) {
  console.log(`📡 Recupero dettagli template Canva ${templateId}...`);
  return canvaRequest('GET', `brand-templates/${templateId}`);
}

// 2. Avvia il job di Autofill su Canva
export async function autofillTemplate(templateId, title, dataFields) {
  console.log(`🎨 Avvio autofill su template Canva ${templateId}...`);
  const payload = {
    brand_template_id: templateId,
    title: title,
    data: dataFields
  };

  const res = await canvaRequest('POST', 'autofills', payload);
  const jobId = res.job?.id;
  console.log(`   Job autofill avviato con ID: ${jobId}`);

  // Polling del job
  let status = res.job?.status || 'in_progress';
  let designId = null;

  while (status === 'in_progress') {
    console.log('   ...attesa completamento autofill (5 secondi)...');
    await new Promise(r => setTimeout(r, 5000));
    const check = await canvaRequest('GET', `autofills/${jobId}`);
    status = check.job?.status;
    if (status === 'success') {
      designId = check.job?.result?.design?.id;
    } else if (status === 'failed') {
      throw new Error(`Autofill fallito: ${JSON.stringify(check.job?.error)}`);
    }
  }

  console.log(`   ✅ Autofill completato con successo! Nuovo design ID: ${designId}`);
  return designId;
}

// 3. Esporta un design in formato PNG
export async function exportDesign(designId) {
  console.log(`📡 Avvio esportazione design ${designId} in formato PNG...`);
  const payload = {
    design_id: designId,
    format: 'png'
  };

  const res = await canvaRequest('POST', 'exports', payload);
  const jobId = res.job?.id;
  console.log(`   Job esportazione avviato con ID: ${jobId}`);

  // Polling del job
  let status = res.job?.status || 'in_progress';
  let downloadUrl = null;

  while (status === 'in_progress') {
    console.log('   ...attesa completamento esportazione (5 secondi)...');
    await new Promise(r => setTimeout(r, 5000));
    const check = await canvaRequest('GET', `exports/${jobId}`);
    status = check.job?.status;
    if (status === 'success') {
      downloadUrl = check.job?.result?.urls?.[0];
    } else if (status === 'failed') {
      throw new Error(`Esportazione fallita: ${JSON.stringify(check.job?.error)}`);
    }
  }

  console.log(`   ✅ Esportazione completata! URL download: ${downloadUrl}`);
  return downloadUrl;
}

// 4. Scarica il file esportato localmente
export async function downloadFile(url, destPath) {
  console.log(`📥 Download file da Canva: ${url} -> ${destPath}...`);
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Errore download file: ${res.statusText}`);
  }
  const buffer = Buffer.from(await res.arrayBuffer());
  fs.writeFileSync(destPath, buffer);
  console.log(`   ✅ File scaricato con successo.`);
}

// CLI Execution support per testing manuale
if (process.argv[1] && path.basename(process.argv[1]) === 'canva_autofill.mjs') {
  const templateId = process.env.CANVA_TEMPLATE_ID;
  if (!templateId) {
    console.log('Fornire CANVA_TEMPLATE_ID nel file .env.local per eseguire il test.');
    process.exit(0);
  }

  try {
    console.log('🧪 Avvio test manuale Canva Autofill...');
    const details = await getTemplateDetails(templateId);
    console.log('Dettagli template:', JSON.stringify(details, null, 2));
  } catch (err) {
    console.error('❌ Errore test:', err.message);
  }
}
