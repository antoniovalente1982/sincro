---
description: Pipeline completo per creare video ads cinematici con AI — usa SEMPRE questo workflow
---

# Video Ads Production Pipeline — Metodo Sincro

**SEGUI QUESTO WORKFLOW PER OGNI VIDEO AD**

## Fase 1: Script (Buyer Pocket)

1. Identifica il **Buyer Pocket** dal CSV (`docs/knowledge-base/creative-strategy/100 Buyer Pockets.xlsx`)
2. Scrivi lo script diviso in **5-8 scene** (4-8 secondi ciascuna)
3. Per ogni scena definisci:
   - **Testo parlato** (voiceover)
   - **Prompt visivo** (cosa si vede nella scena Higgsfield)
   - **Parola chiave** da mostrare in overlay
   - **Camera movement** (dolly, zoom, crane, drone, pan)
4. ⚠️ **MAI citare nomi di calciatori famosi** nelle ads video
5. Naming: `#[pocket_id] [pocket_name] | [cluster] | [funnel_role] — Video Reel`

## Fase 2: Voiceover (ElevenLabs)

1. **Voice ID**: `WS1kH1PJ5Xqt3tTn5Suw` (voce clonata Antonio Valente)
2. **API Key**: in `.env.local` → `ELEVENLABS_API_KEY`
3. **Settings consigliati**:
   - `stability: 0.55` (più naturale)
   - `similarity_boost: 0.9` (molto simile ad Antonio)
   - `style: 0.35` (espressivo)
   - `speed: 1.0` (poi si velocizza con FFmpeg)
4. **Output**: file MP3
5. **Verifica**: ascolta il file — le affermazioni devono suonare come affermazioni, non domande
6. Se la pronuncia non è buona, riscrivi il testo con punteggiatura diversa e rigenera

## Fase 3: Avatar PiP (HeyGen)

1. **Avatar ID**: `df8fc9c5f0f74afba2217797cf1d83f4` (Antonio Valente)
2. **Voice**: `type: "audio"` con `audio_url` → upload audio su servizio pubblico (catbox.moe) e passa URL
3. **Background**: `#00FF00` (green screen per chroma key)
4. **Dimension**: 1080x1920 (9:16)
5. **Output**: video MP4 dell'avatar che parla su green screen
6. **Post-processing FFmpeg**: rimuovi sfondo verde con chroma key
   ```bash
   ffmpeg -i avatar.mp4 -vf "chromakey=0x00FF00:0.3:0.1" -c:v png avatar_transparent.mov
   ```

## Fase 4: Scene Cinematiche (Higgsfield AI)

1. **API Key**: in `.env.local` → `HIGGSFIELD_API_KEY`
2. Per ogni scena dello script, genera una clip di 4-8 secondi
3. **Prompt format**: `[soggetto], [azione], [ambiente], [luce], [camera movement]`
4. **Esempi prompt Metodo Sincro**:
   - "Ragazzo 15 anni solo in campo di calcio al tramonto, dolly shot, cinematico"
   - "Padre e figlio che si abbracciano dopo partita, luce calda, zoom in lento"
   - "Close-up mani che stringono un pallone, luce dorata, crane shot"
   - "Campo da calcio vuoto al tramonto, nebbia leggera, drone pan"
   - "Ragazzo che esulta dopo un gol, slow motion, epic cinematic"
5. **Camera effects disponibili**: dolly, zoom, crane, drone, pan, orbit, tilt, tracking
6. **Output**: clip MP4 per ogni scena

## Fase 5: Composizione (Remotion)

Assembla tutto in `video-engine/`:

```
Struttura video 30 secondi:
┌─────────────────────────────────────────┐
│ [Scena 1 Higgsfield]  5s               │
│   + Parola chiave animata in overlay     │
│   + Voiceover Antonio                    │
│                        ┌──────┐          │
│ [Scena 2 Higgsfield]  │Avatar│  5s      │
│   + Keyword            │ PiP  │          │
│                        └──────┘          │
│ [Scena 3 Higgsfield]  5s               │
│   + Stats counter animato                │
│                                          │
│ [Scena 4 Higgsfield]  5s               │
│   + Trustpilot badge                     │
│                        ┌──────┐          │
│ [Scena 5]              │Avatar│  5s      │
│   + CTA animata        │ PiP  │          │
│                        └──────┘          │
│ [Progress bar in alto tutto il video]    │
└─────────────────────────────────────────┘
```

**Effetti Remotion da applicare:**
- Parole chiave a ritmo con l'audio (sync manuale o auto via timestamps)
- Transizioni fluide tra scene (crossfade, zoom transition, wipe)
- Avatar PiP che appare/scompare con fade (scena 2 e 5)
- Stats counter animato (spring physics)
- Badge Trustpilot con shimmer
- CTA gold pulsante
- Progress bar sottile in alto

## Fase 6: Post-Processing (FFmpeg)

1. **Velocizza a 1.2x**: `ffmpeg -filter_complex "[0:v]setpts=0.833*PTS[v];[0:a]atempo=1.2[a]"`
2. **Formati output**:
   - 9:16 (Reel/Story) → principale
   - 1:1 (Feed) → crop center
   - 16:9 (In-stream) → crop + pad
3. **Qualità**: `-crf 18 -preset slow` per massima qualità

## Fase 7: Review e Upload

1. **NON caricare su Meta prima di review** da Antonio
2. Mostra il video per approvazione
3. Solo dopo approvazione → upload su Meta e crea l'ad
4. Segui `/meta-ads-preflight` per tutti i parametri

## IDs e API Keys Reference

| Risorsa | ID/Key |
|---|---|
| ElevenLabs Voice | `WS1kH1PJ5Xqt3tTn5Suw` |
| HeyGen Avatar | `df8fc9c5f0f74afba2217797cf1d83f4` |
| HeyGen Voice (clonata) | `5cc4c6b457ce4edb8d2a50efab08f03e` |
| Meta Ad Account | `act_511099830249139` |
| Meta Page | `108451268302248` |
| Pixel | `311586900940615` |

## Errori da NON ripetere

| Errore | Regola |
|---|---|
| Voce HeyGen generica | **SEMPRE** usare ElevenLabs → audio_url → HeyGen |
| Nomi calciatori famosi | **MAI** nelle video ads |
| Video troppo lenti | **SEMPRE** velocizzare 1.2x con FFmpeg |
| Animazioni a scatti | Renderizzare a **30fps** minimo, evitare troppe particelle |
| Pubblicare senza review | **MAI** — sempre far vedere ad Antonio prima |
