import * as dotenv from 'dotenv';

import * as fs from 'fs';

dotenv.config({ path: '.env.local' });

async function run() {
    const text = "Sblocca il tuo vero potenziale con il Metodo Sincro. Stai ancora aspettando o agisci? Sblocca una prestazione sottotono e raggiungi il successo che meriti. Questo è il momento di prendere in mano la tua vita.";
    const voiceId = "WS1kH1PJ5Xqt3tTn5Suw";
    
    const start = Date.now();
    const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}/with-timestamps`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'xi-api-key': process.env.ELEVENLABS_API_KEY as string,
        },
        body: JSON.stringify({
            text,
            model_id: "eleven_multilingual_v2"
        })
    });
    
    console.log("Status:", res.status);
    if (!res.ok) {
        console.log("Error:", await res.text());
        return;
    }
    
    const data = await res.json() as any;
    console.log("Time:", Date.now() - start, "ms");
    console.log("Base64 length:", data.audio_base64?.length);
    if (data.audio_base64) {
        const buffer = Buffer.from(data.audio_base64, 'base64');
        console.log("Buffer size:", buffer.length);
        fs.writeFileSync('test_v3.mp3', buffer);
    }
}
run();
