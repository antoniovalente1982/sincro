import { textToSpeechWithTimestamps } from './lib/elevenlabs';
import * as dotenv from 'dotenv';
import * as fs from 'fs';

dotenv.config({ path: '.env.local' });

async function run() {
    const text = "Sblocca il tuo vero potenziale con il Metodo Sincro. Stai ancora aspettando o agisci? Sblocca una prestazione sottotono e raggiungi il successo che meriti. Questo è il momento di prendere in mano la tua vita.";
    console.log("Generating for:", text);
    const start = Date.now();
    const result = await textToSpeechWithTimestamps(text, "WS1kH1PJ5Xqt3tTn5Suw");
    console.log("Took", Date.now() - start, "ms");
    if (result && result.audioBase64) {
        const buffer = Buffer.from(result.audioBase64, 'base64');
        console.log("Generated audio size:", buffer.length, "bytes");
        fs.writeFileSync('test_long.mp3', buffer);
    } else {
        console.log("Failed to generate");
    }
}
run();
