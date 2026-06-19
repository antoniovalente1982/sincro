import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const HIGGSFIELD_API_URL = 'https://api.higgsfield.ai/v1/generations';

async function getAccessToken() {
  // If API Key is directly provided, use it
  if (process.env.HIGGSFIELD_API_KEY) {
    return process.env.HIGGSFIELD_API_KEY;
  }

  // If Client ID and Secret are provided, exchange them for a token
  const clientId = process.env.HIGGSFIELD_CLIENT_ID;
  const clientSecret = process.env.HIGGSFIELD_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error('Mancante HIGGSFIELD_API_KEY o credenziali Client ID/Secret nel file .env.local');
  }

  console.log('📡 Richiesta token OAuth a Higgsfield AI tramite Client Credentials...');
  // Standard OAuth 2.0 Token Endpoint for Higgsfield
  const res = await fetch('https://auth.higgsfield.ai/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      grant_type: 'client_credentials',
      client_id: clientId,
      client_secret: clientSecret
    })
  });

  const data = await res.json();
  if (!res.ok) {
    console.error('❌ Errore autenticazione Higgsfield:', data);
    throw new Error(data.message || 'Errore autenticazione OAuth');
  }

  return data.access_token;
}

// Avvia la generazione del video
export async function generateVideo(prompt, imageUrl = null, duration = 10, aspectRatio = '9:16') {
  const token = await getAccessToken();
  console.log(`🎬 Invio richiesta video a Higgsfield: "${prompt}"...`);

  const payload = {
    model: 'v2',
    prompt,
    duration,
    aspect_ratio: aspectRatio
  };

  if (imageUrl) {
    payload.image_url = imageUrl;
  }

  const res = await fetch(HIGGSFIELD_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify(payload)
  });

  const data = await res.json();
  if (!res.ok) {
    console.error('❌ Errore avvio video Higgsfield:', data);
    throw new Error(data.message || 'Errore generazione video');
  }

  const taskId = data.id || data.task_id;
  console.log(`   Job video avviato! Task ID: ${taskId}`);
  return taskId;
}

// Controlla lo stato di generazione del video (Polling)
export async function pollVideo(taskId) {
  const token = await getAccessToken();
  console.log(`📡 Controllo stato video per Task ID ${taskId}...`);

  let status = 'in_progress';
  let videoUrl = null;

  while (status === 'in_progress' || status === 'pending') {
    console.log('   ...attesa completamento video (10 secondi)...');
    await new Promise(r => setTimeout(r, 10000));

    const res = await fetch(`${HIGGSFIELD_API_URL}/${taskId}`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    const data = await res.json();
    if (!res.ok) {
      console.error('❌ Errore recupero stato video:', data);
      throw new Error(data.message || 'Errore recupero stato task');
    }

    status = data.status;
    if (status === 'completed' || status === 'success') {
      videoUrl = data.video_url || data.result?.url;
    } else if (status === 'failed') {
      throw new Error(`Generazione video fallita: ${data.error || 'Errore sconosciuto'}`);
    }
  }

  console.log(`   ✅ Video generato con successo! URL: ${videoUrl}`);
  return videoUrl;
}

// Scarica il video locale
export async function downloadVideo(url, destPath) {
  console.log(`📥 Download video da Higgsfield: ${url} -> ${destPath}...`);
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Errore download video: ${res.statusText}`);
  }
  const buffer = Buffer.from(await res.arrayBuffer());
  fs.writeFileSync(destPath, buffer);
  console.log(`   ✅ Video scaricato con successo.`);
}

// CLI Execution support per testing manuale
if (process.argv[1] && path.basename(process.argv[1]) === 'higgsfield_video.mjs') {
  try {
    console.log('🧪 Avvio test manuale Higgsfield Video...');
    const token = await getAccessToken();
    console.log('Token ottenuto correttamente (primi 15 caratteri):', token.substring(0, 15) + '...');
  } catch (err) {
    console.error('❌ Errore test:', err.message);
  }
}
