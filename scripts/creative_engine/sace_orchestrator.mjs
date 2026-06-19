import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';
import { generateCompositeAd } from './gemini_composite.mjs';
import { generateVideo, pollVideo, downloadVideo } from './higgsfield_video.mjs';

dotenv.config({ path: '.env.local' });

// SACE Orchestrator function
export async function runCreativePipeline(options = {}) {
  const {
    backgroundPrompt = 'A professional empty soccer stadium at sunset, warm golden lights, high contrast, cinematic background, dark-themed, premium quality',
    headline = 'MASTER PACK GENITORE E FIGLIO',
    subHeadline = '6 Guide PDF (3 per Genitori + 3 per Calciatori)',
    description = "Il Box Completo del Mental Coach per sbloccare l'Autostima e gestire la Pressione",
    discountText = '-60%',
    discountBadgeTitle = 'OFFERTA LANCIO',
    discountBadgeSub = 'DI SCONTO',
    videoPrompt = 'A young talented soccer player running on the field under golden hour sunset, cinematic lighting, slow motion, professional 8k video.',
    outputDir = 'scratch/creative_engine_output',
    canvasWidth = 1200,
    canvasHeight = 1700
  } = options;

  console.log('\n🚀 AVVIO SINCRO AUTOPILOT CREATIVE ENGINE (SACE)...');
  console.log('═'.repeat(60));

  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  let imageDestPath = path.join(outputDir, 'gemini_ad_output.png');
  let videoDestPath = path.join(outputDir, 'higgsfield_ad_output.mp4');

  // --- PHASE 1: Gemini + Sharp Static Image Generation ---
  let generatedImageLocalPath = null;
  try {
    console.log('\n🎨 [Gemini + Sharp] Inizio generazione immagine statica...');
    const adImagePath = await generateCompositeAd({
      backgroundPrompt,
      headline,
      subHeadline,
      description,
      discountText,
      discountBadgeTitle,
      discountBadgeSub,
      outputPath: imageDestPath,
      canvasWidth,
      canvasHeight
    });
    generatedImageLocalPath = adImagePath;
    console.log('   ✅ Immagine statica generata con successo!');
  } catch (err) {
    console.error('   ❌ Errore durante la generazione dell\'immagine con Gemini/Sharp:', err.message);
  }

  // --- PHASE 2: Higgsfield Video Generation ---
  let generatedVideoLocalPath = null;
  const hasHiggsfield = process.env.HIGGSFIELD_API_KEY || (process.env.HIGGSFIELD_CLIENT_ID && process.env.HIGGSFIELD_CLIENT_SECRET);
  
  if (hasHiggsfield) {
    try {
      console.log('\n🎬 [Higgsfield] Inizio generazione video ad... ');
      const taskId = await generateVideo(videoPrompt);
      const videoUrl = await pollVideo(taskId);
      await downloadVideo(videoUrl, videoDestPath);
      generatedVideoLocalPath = videoDestPath;
      console.log('   ✅ Video ad generato con successo!');
    } catch (err) {
      console.error('   ❌ Errore durante la generazione del video con Higgsfield:', err.message);
    }
  } else {
    console.log('\nℹ️ [Higgsfield] Saltato (mancanti credenziali Higgsfield nel file .env.local).');
  }

  console.log('\n' + '═'.repeat(60));
  console.log('🎉 PROCESSO SACE COMPLETATO!');
  console.log(`👉 File Immagine: ${generatedImageLocalPath || 'Non generato'}`);
  console.log(`👉 File Video:    ${generatedVideoLocalPath || 'Non generato'}`);
  console.log('═'.repeat(60) + '\n');

  return {
    imagePath: generatedImageLocalPath,
    videoPath: generatedVideoLocalPath
  };
}

// CLI Execution support
if (process.argv[1] && path.basename(process.argv[1]) === 'sace_orchestrator.mjs') {
  runCreativePipeline().catch(console.error);
}
