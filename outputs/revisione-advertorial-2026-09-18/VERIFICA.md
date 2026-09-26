# Verifica finale — 18 settembre 2026

- Build di produzione finale: PASS (`npm run build`, TypeScript incluso).
- ESLint mirato `app/f/pochi-minuti`: PASS.
- Test collegamento alla consulenza: 3/3 PASS (attribuzione, esclusione dati arbitrari, modalità anteprima).
- `git diff --check`: PASS.
- Browser desktop 1365×900 e mobile 390×844: nessun overflow; tutte le immagini caricate; ritratto e fondatore identificati anche su mobile.
- Clic effettivo sulla CTA: apre `https://landing.metodosincro.com/f/salto-di-qualita?entry=advertorial-pochi-minuti&ab=A#ms-form`; modulo con tre campi di testo presente. Nessun invio.
- Route anteprima con server production locale: HTTP 404 verificato.
- Detector design eseguito una volta: due warning sull’uso di Arial per interfaccia e metadati, scelta intenzionale. Il display usa Source Serif 4 e Barlow.
- Revisione indipendente: SHIP per revisione locale. Risolti identificazione del fondatore su mobile e ricattura completa delle immagini lazy.
- Screenshot finali: `review/desktop.png`, `review/mobile.png`.

Confini: verifica locale. Nessun deploy, aggiornamento del database o test di conversione. Record remoto non letto via configurazione locale (fetch failed); vecchia pagina pubblica e modulo verificati nel browser. Il file già modificato `app/api/settings/route.ts` non è stato toccato da questa revisione.
# Aggiornamento V3 — immagini, FAQ e proposta Mappa

- `npm run build`: superata dopo avere precisato il controllo TypeScript sul nuovo blocco immagine opzionale.
- ESLint mirato sul componente modificato: superato. `git diff --check`: superato.
- Nuove immagini ispezionate: azione in campo e sessione online. Esportate in WebP, 1536×1024, rispettivamente 159.866 e 95.634 byte. Didascalie e alt distinguono le scene illustrative da persone e casi reali.
- Verifica browser desktop 1365×900 e mobile 390×844: nuove immagini visibili, nessun overflow orizzontale. FAQ presenti nel DOM in numero di sei. Screenshot delle nuove sezioni in `review/v3-sessione-desktop.png` e `review/v3-sessione-mobile.png`.
- Modello Mappa: verificati campi anagrafici e contenuti editabili; provata la compilazione con testo di prova, poi ripristinato il modello vuoto. Verificato anche a 390 px senza overflow. Screenshot `review/mappa-modello.png`. Layout di stampa A4 predisposto; nessun PDF esportato in questa verifica.
- Proposta Mappa separata dalle promesse attive: nessun cambio CTA verso un servizio non ancora organizzato. Non è una revisione indipendente della V3.
