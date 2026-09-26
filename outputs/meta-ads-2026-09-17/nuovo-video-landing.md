# Nuovo video nella landing — 17 settembre 2026

Richiesta di Antonio: sostituire il video usando l’embed VTurb fornito, con priorità all’utilizzo da telefono.

- Landing: https://landing.metodosincro.com/f/salto-di-qualita
- Player precedente: `6aa2c34558d18024915cc00a`.
- Nuovo player: `6aab8c0b901f91136b129b4b`.
- Titolo visibile del documento player: **NUOVA VSL SETTEMBRE.mp4**.
- Account VTurb: `aa89ca91-c4e7-487e-aa5a-13ea76503b32`.
- Media: `6aab8c059fb45fdc15d78c4c`.
- Sostituzione applicata e riletta dal database alle **08:56:56, ora di Roma**, nel funnel `bb4f12d9-4709-4ecf-9d1a-1a96c0960e46`.

Lo snippet è stato ripulito dagli escape e dalla formattazione dei link Markdown. Il renderer esistente ricava l’ID e usa il documento iframe ufficiale VTurb con SDK, evitando il reinserimento del player a ogni aggiornamento React. Il documento del nuovo player include preload; script, iframe e manifest HLS hanno risposto HTTP 200. Non sono stati aggiunti player duplicati o caricatori JavaScript concorrenti.

## Verifica pubblica

- A 390 px: player 352 × 198 px, prima del modulo.
- A 320 px: player 282 × 158,625 px, interamente entro lo schermo e prima del modulo.
- A 1440 px: player 560 × 315 px.
- Un solo iframe, sempre con il nuovo player nell’URL.
- Osservati avvio silenzioso e invito ad attivare l’audio. Provati i controlli tramite clic diretto del browser, verificando l’avanzamento delle immagini, dei sottotitoli e della barra di riproduzione. Riproduzione infine messa in pausa.
- Verifica mobile eseguita con le dimensioni del browser, non su un dispositivo fisico iOS o Android.
- Ripristinate le dimensioni del browser al termine.

Modifica effettuata nelle impostazioni del funnel, senza cambiamenti al codice della landing: non è necessario un nuovo deploy GitHub/Vercel. Layout, headline, pulsanti, campi e annunci sono rimasti invariati. Non sono stati inviati contatti di prova né misurate variazioni di conversione.

Backup completo prima della sostituzione: `settings-before-new-video.json`. Verifica finale: `settings-after-new-video.json`. Risorse verificate: `new-video-preflight.json`. Script: `replace-landing-video.mjs`.
