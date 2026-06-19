import fs from 'fs';
import path from 'path';
import sharp from 'sharp';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const MODEL = 'gemini-3.1-flash-image-preview';
const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${GEMINI_API_KEY}`;

/**
 * Genera uno sfondo sportivo con Google Gemini Image API (Imagen 3)
 * @param {string} prompt Il prompt descrittivo per lo sfondo
 * @returns {Promise<Buffer|null>} Buffer dell'immagine generata o null in caso di errore
 */
async function generateGeminiBackground(prompt) {
  if (!GEMINI_API_KEY) {
    console.warn('⚠️ GEMINI_API_KEY non configurata. Salto la generazione dello sfondo.');
    return null;
  }

  console.log(`📡 Richiesta generazione sfondo a Gemini: "${prompt}"...`);

  try {
    const res = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [{ text: prompt }]
        }],
        generationConfig: {
          responseModalities: ['Image'],
          imageConfig: {
            aspectRatio: '4:5' // Ottimo per vertical layout 1200x1700
          }
        }
      })
    });

    const data = await res.json();
    if (!res.ok) {
      console.error('❌ Errore API Gemini:', data);
      return null;
    }

    const candidates = data.candidates || [];
    const parts = candidates[0]?.content?.parts || [];
    const imagePart = parts.find(p => p.inlineData);

    if (imagePart?.inlineData?.data) {
      console.log('✅ Sfondo generato con successo da Gemini!');
      return Buffer.from(imagePart.inlineData.data, 'base64');
    } else {
      console.warn('⚠️ Gemini non ha restituito dati immagine. Finish reason:', candidates[0]?.finishReason);
      return null;
    }
  } catch (err) {
    console.error('❌ Eccezione durante la chiamata API Gemini:', err.message);
    return null;
  }
}

/**
 * Compone dinamicamente l'immagine dell'annuncio
 * @param {Object} options Parametri di configurazione
 */
export async function generateCompositeAd(options = {}) {
  const {
    backgroundPrompt = 'A professional empty soccer stadium at sunset, warm golden lights, high contrast, cinematic background, dark-themed, premium quality',
    headline = 'MASTER PACK GENITORE E FIGLIO',
    subHeadline = '6 Guide PDF (3 per Genitori + 3 per Calciatori)',
    description = "Il Box Completo del Mental Coach per sbloccare l'Autostima e gestire la Pressione",
    discountText = '-60%',
    discountBadgeTitle = 'OFFERTA LANCIO',
    discountBadgeSub = 'DI SCONTO',
    outputPath = 'scratch/creative_engine_output/gemini_ad_output.png',
    canvasWidth = 1200,
    canvasHeight = 1700
  } = options;

  console.log(`🎨 [SACE Gemini/Sharp] Avvio composizione grafica...`);
  console.log(`👉 Salvo in: ${outputPath}`);

  const outputDir = path.dirname(outputPath);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const tempDir = 'scratch/temp_covers';
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
  }

  // 1. Ottiene lo sfondo (chiamata a Gemini con fallback a tinta unita)
  let bgBuffer = await generateGeminiBackground(backgroundPrompt);
  let baseSharp;

  if (bgBuffer) {
    baseSharp = sharp(bgBuffer).resize(canvasWidth, canvasHeight, { fit: 'cover' });
    console.log('   Utilizzo sfondo generato da Gemini.');
  } else {
    baseSharp = sharp({
      create: {
        width: canvasWidth,
        height: canvasHeight,
        channels: 4,
        background: { r: 11, g: 21, b: 40, alpha: 1 } // Navy scuro di fallback
      }
    });
    console.log('   Utilizzo sfondo a tinta unita di fallback (navy scuro).');
  }

  // 2. Definizione dei componenti di composizione
  const composites = [];

  // A. Gradiente scuro sovrapposto (per garantire la leggibilità di testi e copertine, lasciando emergere lo sfondo Gemini)
  const overlayGradSvg = Buffer.from(`
    <svg width="${canvasWidth}" height="${canvasHeight}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="overlayGrad" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stop-color="#0b1528" stop-opacity="0.85"/>
          <stop offset="30%" stop-color="#0b1528" stop-opacity="0.35"/>
          <stop offset="70%" stop-color="#0b1528" stop-opacity="0.35"/>
          <stop offset="100%" stop-color="#0b1528" stop-opacity="0.85"/>
        </linearGradient>
      </defs>
      <rect width="100%" height="100%" fill="url(#overlayGrad)"/>
    </svg>
  `);
  composites.push({ input: overlayGradSvg, top: 0, left: 0 });

  // B. Logo Metodo Sincro
  const logoPath = path.join(tempDir, 'logo.png');
  let logoBuffer;
  if (fs.existsSync(logoPath)) {
    logoBuffer = await sharp(logoPath).resize(320).toBuffer();
    composites.push({ input: logoBuffer, top: 40, left: 440 });
  } else {
    console.warn(`⚠️ File logo non trovato in ${logoPath}. Salto il logo.`);
  }

  // C. Testi dinamici (Headline, Subheadline, Descrizione)
  // Escapiamo i caratteri speciali per evitare errori nell'SVG
  const escapeXml = (unsafe) => {
    return unsafe.replace(/[<>&'"]/g, (c) => {
      switch (c) {
        case '<': return '&lt;';
        case '>': return '&gt;';
        case '&': return '&amp;';
        case '\'': return '&apos;';
        case '"': return '&quot;';
      }
    });
  };

  const cleanHeadline = escapeXml(headline);
  const cleanSubHeadline = escapeXml(subHeadline);
  const cleanDescription = escapeXml(description);

  const titleSvg = Buffer.from(`
    <svg width="1200" height="150" viewBox="0 0 1200 150" xmlns="http://www.w3.org/2000/svg">
      <text x="50%" y="45" text-anchor="middle" fill="#10B981" font-family="Arial, sans-serif" font-size="38" font-weight="bold" letter-spacing="1">${cleanHeadline.toUpperCase()}</text>
      <text x="50%" y="90" text-anchor="middle" fill="#E2E8F0" font-family="Arial, sans-serif" font-size="24" font-weight="bold">${cleanSubHeadline}</text>
      <text x="50%" y="125" text-anchor="middle" fill="#94A3B8" font-family="Arial, sans-serif" font-size="16" font-style="italic">${cleanDescription}</text>
    </svg>
  `);
  composites.push({ input: titleSvg, top: 160, left: 0 });

  // D. Copertine delle 6 guide (griglia 2x3)
  const coverWidth = 270;
  const coverHeight = 380;

  const covers = [
    // Calciatore (Player) - Sinistra
    { path: path.join(tempDir, 'cover_1011.webp'), name: 'Vol 1' },
    { path: path.join(tempDir, 'cover_1021.webp'), name: 'Vol 2' },
    { path: path.join(tempDir, 'cover_1016.webp'), name: 'Vol 3' },
    // Genitore (Parent) - Destra
    { path: path.join(tempDir, 'cover_353.webp'), name: 'Genitori Leader' },
    { path: path.join(tempDir, 'cover_374.jpeg'), name: '5 Errori' },
    { path: path.join(tempDir, 'cover_386.webp'), name: 'Sempre al tuo fianco' }
  ];

  const positions = [
    { left: 250, top: 380 },   // Player Vol 1
    { left: 250, top: 800 },   // Player Vol 2
    { left: 250, top: 1220 },  // Player Vol 3
    { left: 680, top: 380 },   // Parent Genitori Leader
    { left: 680, top: 800 },   // Parent 5 Errori
    { left: 680, top: 1220 }   // Parent Sempre al tuo fianco
  ];

  for (let i = 0; i < covers.length; i++) {
    const c = covers[i];
    if (fs.existsSync(c.path)) {
      const coverBuffer = await sharp(c.path)
        .resize(coverWidth, coverHeight, { fit: 'fill' })
        .toBuffer();
      composites.push({
        input: coverBuffer,
        top: positions[i].top,
        left: positions[i].left
      });
    } else {
      console.warn(`⚠️ Copertina non trovata in: ${c.path} (${c.name}). Salto copertina.`);
    }
  }

  // E. Badge dello sconto
  const cleanBadgeTitle = escapeXml(discountBadgeTitle);
  const cleanBadgeSub = escapeXml(discountBadgeSub);
  const cleanDiscountText = escapeXml(discountText);

  const badgeSvg = Buffer.from(`
    <svg width="200" height="200" viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">
      <circle cx="100" cy="100" r="90" fill="#DC2626" stroke="#FFFFFF" stroke-width="4"/>
      <text x="50%" y="36%" text-anchor="middle" fill="#FFFFFF" font-family="Arial, sans-serif" font-size="14" font-weight="bold" letter-spacing="1">${cleanBadgeTitle.toUpperCase()}</text>
      <text x="50%" y="68%" text-anchor="middle" fill="#FFFFFF" font-family="Arial, sans-serif" font-size="44" font-weight="bold">${cleanDiscountText}</text>
      <text x="50%" y="85%" text-anchor="middle" fill="#FFFFFF" font-family="Arial, sans-serif" font-size="14" font-weight="bold" letter-spacing="1">${cleanBadgeSub.toUpperCase()}</text>
    </svg>
  `);
  composites.push({ input: badgeSvg, top: 50, left: 930 });

  // 3. Esegue la composizione finale e scrive il file
  await baseSharp
    .composite(composites)
    .png()
    .toFile(outputPath);

  console.log(`✅ [SACE Gemini/Sharp] Immagine pubblicitaria creata con successo!`);
  return outputPath;
}

// CLI Execution support per testing manuale
if (process.argv[1] && path.basename(process.argv[1]) === 'gemini_composite.mjs') {
  console.log('🧪 Esecuzione test manuale gemini_composite...');
  generateCompositeAd({
    backgroundPrompt: 'A professional empty soccer stadium at sunset, warm golden lights, high contrast, cinematic background',
    headline: 'MASTER PACK GENITORE E FIGLIO',
    subHeadline: '6 Guide PDF (3 per Genitori + 3 per Calciatori)',
    description: "Il Box Completo del Mental Coach per sbloccare l'Autostima e gestire la Pressione",
    discountText: '-60%',
    outputPath: 'scratch/creative_engine_output/gemini_ad_test.png'
  })
  .then((path) => {
    console.log(`🎉 Test manuale completato con successo! File salvato in: ${path}`);
  })
  .catch((err) => {
    console.error('❌ Errore test manuale:', err);
  });
}
