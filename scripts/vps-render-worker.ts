import { createClient } from '@supabase/supabase-js';
import { bundle } from '@remotion/bundler';
import { renderMedia, selectComposition } from '@remotion/renderer';
import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';

dotenv.config({ path: path.join(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!supabaseUrl || !supabaseKey) {
    console.error("Mancano le chiavi Supabase in .env.local!");
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

let isRendering = false;

async function processPendingJobs() {
    if (isRendering) return;
    
    const { data, error } = await supabase
        .from('video_render_jobs')
        .select('*')
        .eq('status', 'pending')
        .order('created_at', { ascending: true })
        .limit(1)
        .single();
        
    if (!data || error) return;
    
    isRendering = true;
    try {
        await renderJob(data);
    } catch (e: any) {
        console.error("Errore durante il render:", e);
        await supabase.from('video_render_jobs').update({ status: 'failed', error: e.message }).eq('id', data.id);
    } finally {
        isRendering = false;
        // Ripassa finché ci sono job
        setTimeout(() => processPendingJobs(), 1000);
    }
}

async function renderJob(job: any) {
    console.log(`\n[Worker] 🚀 Avvio rendering del Job ID: ${job.id}`);
    await supabase.from('video_render_jobs').update({ status: 'processing', error: 'Avvio bundle Webpack...' }).eq('id', job.id);
    
    const bundleLocation = await bundle({
        entryPoint: path.resolve(process.cwd(), 'remotion/index.ts'),
        webpackOverride: (config) => config,
    });
    
    console.log(`[Worker] Bundle completato. Calcolo composizione...`);
    
    const composition = await selectComposition({
        serveUrl: bundleLocation,
        id: 'SincroVideoAd',
        inputProps: job.payload
    });
    
    const outputFile = path.resolve(process.cwd(), `tmp-render-${job.id}.mp4`);
    
    console.log(`[Worker] Rendering dei frame... (Durerà qualche secondo)`);
    await renderMedia({
        composition,
        serveUrl: bundleLocation,
        codec: 'h264',
        outputLocation: outputFile,
        inputProps: job.payload,
        onProgress: async ({ progress }) => {
            const perc = Math.round(progress * 100);
            if (perc % 10 === 0) {
                 await supabase.from('video_render_jobs').update({ error: `Rendering: ${perc}%` }).eq('id', job.id);
            }
            if (perc % 25 === 0) console.log(`[Worker] Rendering: ${perc}%`);
        }
    });
    
    console.log(`[Worker] Rendering completato! Upload su Supabase Storage...`);
    await supabase.from('video_render_jobs').update({ error: 'Upload in corso...' }).eq('id', job.id);
    
    const fileBuffer = fs.readFileSync(outputFile);
    
    const { data: uploadData, error: uploadError } = await supabase.storage
        .from('sincro-renders')
        .upload(`${job.id}.mp4`, fileBuffer, { contentType: 'video/mp4', upsert: true });
        
    if (uploadError) throw new Error("Upload fallito: " + uploadError.message);
    
    const { data: publicUrlData } = supabase.storage.from('sincro-renders').getPublicUrl(`${job.id}.mp4`);
    const finalUrl = publicUrlData.publicUrl;
    
    await supabase.from('video_render_jobs').update({ 
        status: 'completed', 
        video_url: finalUrl,
        error: 'Completato'
    }).eq('id', job.id);
    
    console.log(`[Worker] ✅ Job ${job.id} Finito! Link: ${finalUrl}`);
    
    // Pulizia file locale
    fs.unlinkSync(outputFile);
    
    // Invia a Telegram
    if (process.env.TELEGRAM_BOT_TOKEN) {
        try {
            await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({
                    chat_id: "-1002347346852",
                    text: `🎬 *SINCRO AI DIRECTOR*\nNuovo video generato ed esportato con successo!\n\n[Guarda il Video MP4 in 1080x1920](${finalUrl})`,
                    parse_mode: 'Markdown',
                })
            });
            console.log(`[Worker] Notifica Telegram inviata.`);
        } catch(e) {
            console.log(`[Worker] Errore invio Telegram:`, e);
        }
    }
}

console.log("=========================================");
console.log("🤖 SINCRO VPS WORKER AVVIATO");
console.log("Ascolto i rendering in coda via Supabase Realtime...");
console.log("=========================================");

// Usa Realtime per svegliarsi all'istante
supabase
  .channel('realtime-jobs')
  .on(
    'postgres_changes',
    { event: 'INSERT', schema: 'public', table: 'video_render_jobs' },
    (payload) => {
      console.log('⚡ Nuovo inserimento rilevato dal Realtime!');
      processPendingJobs();
    }
  )
  .subscribe();

// Avvia controllo inziale
processPendingJobs();
