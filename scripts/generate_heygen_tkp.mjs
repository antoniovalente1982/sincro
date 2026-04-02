import fs from 'fs';

const HEYGEN_API_KEY = 'sk_V2_hgu_kOZo0SKk0Uj_EGLJGdxeAQloV87wzImQAW0J2b2eckv7';
const AVATAR_ID = 'df8fc9c5f0f74afba2217797cf1d83f4';
const VOICE_ID = '5cc4c6b457ce4edb8d2a50efab08f03e';

const scriptText = "Ciao e complimenti per aver richiesto la consulenza gratuita di Metodo Sincro. Sono Antonio Valente. La tua richiesta è confermata. Nelle prossime ore riceverai una chiamata dal nostro team: ti prego di mantenere il telefono vicino a te e di rispondere, altrimenti il tuo posto passerà al prossimo. Prima della chiamata, focalizzati sul problema principale di tuo figlio in campo e chiediti da quanto tempo esiste questo blocco. Ah, un'ultima sorpresa: se ti presenti puntuale alla consulenza, riceverai in regalo l'accesso premium ad Anthon Chat, il tuo Mental Coach AI personale disponibile ventiquattro ore su ventiquattro. Preparati e a prestissimo!";

async function generate() {
    console.log("Generating video...");
    const res = await fetch('https://api.heygen.com/v2/video/generate', {
        method: 'POST',
        headers: {
            'X-Api-Key': HEYGEN_API_KEY,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            video_inputs: [
                {
                    character: {
                        type: "avatar",
                        avatar_id: AVATAR_ID,
                        avatar_style: 'normal'
                    },
                    voice: {
                        type: "text",
                        input_text: scriptText,
                        voice_id: VOICE_ID
                    }
                }
            ],
            aspect_ratio: '16:9', // Default per desktop/mobile thank you page
            test: true // Mettiamo a true per risparmiare crediti? No wait Heygen test flag is 'test' or we just generate. Let's just generate.
        })
    });
    
    const data = await res.json();
    console.log(data);
    
    if (data.error) {
        console.error("Error:", data.error);
        return;
    }
    
    const videoId = data.data.video_id;
    console.log(`Video ID: ${videoId}`);
    console.log("Polling for completion...");
    
    while(true) {
        const sRes = await fetch(`https://api.heygen.com/v1/video_status.get?video_id=${videoId}`, {
            headers: {
                'X-Api-Key': HEYGEN_API_KEY
            }
        });
        const sData = await sRes.json();
        
        if (sData.data.status === 'completed') {
            console.log("Video URL:", sData.data.video_url);
            break;
        } else if (sData.data.status === 'failed') {
            console.error("Failed:", sData.data.error);
            break;
        }
        console.log(`Status: ${sData.data.status}...`);
        await new Promise(r => setTimeout(r, 5000));
    }
}

generate();
