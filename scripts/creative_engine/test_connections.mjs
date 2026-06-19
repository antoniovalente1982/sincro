import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

async function testGemini() {
  console.log('\n🧠 TESTING CONNESIONE GOOGLE GEMINI IMAGE API...');
  console.log('─'.repeat(40));

  const apiKey = process.env.GEMINI_API_KEY;
  const MODEL = 'gemini-3.1-flash-image-preview';

  if (!apiKey) {
    console.log('❌ GEMINI_API_KEY mancante nel file .env.local.');
    return false;
  }

  const testUrl = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${apiKey}`;

  try {
    const res = await fetch(testUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [{ text: 'A small soccer ball on grass' }]
        }],
        generationConfig: {
          responseModalities: ['Image'],
          imageConfig: {
            aspectRatio: '1:1'
          }
        }
      })
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error?.message || 'Errore API Gemini');
    }

    const candidates = data.candidates || [];
    const parts = candidates[0]?.content?.parts || [];
    const imagePart = parts.find(p => p.inlineData);

    if (imagePart?.inlineData?.data) {
      console.log('✅ Connessione Gemini riuscita! Generazione immagine funzionante.');
      return true;
    } else {
      throw new Error(`Nessuna immagine restituita. Reason: ${candidates[0]?.finishReason}`);
    }
  } catch (err) {
    console.log('❌ Connessione Gemini Fallita!');
    console.log('   Errore:', err.message);
    return false;
  }
}

async function testHiggsfield() {
  console.log('\n🎬 TESTING CONNESIONE HIGGSFIELD AI...');
  console.log('─'.repeat(40));

  const apiKey = process.env.HIGGSFIELD_API_KEY;
  const clientId = process.env.HIGGSFIELD_CLIENT_ID;
  const clientSecret = process.env.HIGGSFIELD_CLIENT_SECRET;

  if (!apiKey && (!clientId || !clientSecret)) {
    console.log('❌ Nessuna credenziale Higgsfield (API Key o Client ID/Secret) nel file .env.local.');
    return false;
  }

  try {
    let method = '';
    let token = '';

    if (apiKey) {
      method = 'API Key';
      token = apiKey;
      console.log('📡 Verifica API Key diretta...');
    } else {
      method = 'Client Credentials';
      console.log('📡 Richiesta token OAuth via Client ID/Secret...');
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
        throw new Error(data.message || 'Errore OAuth Token Request');
      }
      token = data.access_token;
    }

    // Call generations GET to check connection
    const testUrl = 'https://api.higgsfield.ai/v1/generations?limit=1';
    const checkRes = await fetch(testUrl, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const checkData = await checkRes.json();

    if (!checkRes.ok) {
      throw new Error(checkData.message || 'Errore connessione API generations');
    }

    console.log(`✅ Connessione Higgsfield (${method}) riuscita!`);
    return true;
  } catch (err) {
    console.log('❌ Connessione Higgsfield Fallita!');
    console.log('   Errore:', err.message);
    return false;
  }
}

async function main() {
  console.log('🔍 INIZIO DIAGNOSTICA CONNESSIONI SACE...');
  const geminiOk = await testGemini();
  const higgsfieldOk = await testHiggsfield();
  
  console.log('\n' + '═'.repeat(40));
  console.log('📊 STATO CONCLUSIVO DIAGNOSTICA:');
  console.log(`   - Google Gemini: ${geminiOk ? '🟢 FUNZIONANTE' : '🔴 ERRORE'}`);
  console.log(`   - Higgsfield:    ${higgsfieldOk ? '🟢 FUNZIONANTE' : '🔴 NON CONFIGURATO / ERRORE'}`);
  console.log('═'.repeat(40) + '\n');
}

main().catch(console.error);
