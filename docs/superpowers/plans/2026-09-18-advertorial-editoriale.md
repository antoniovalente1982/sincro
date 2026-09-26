# Revisione dell’advertorial — piano di lavoro

**Obiettivo:** consegnare una revisione completa del testo e una pagina editoriale navigabile per genitori di calciatori di 16–18 anni, basata sui tre esempi indicati da Antonio.

**Ambito:** pagina `app/f/pochi-minuti`, contenuti, documentazione e anteprima locale. Conservare destinazione del modulo, whitelist UTM e tracciamento esistente. La pubblicazione e le campagne non fanno parte di questa revisione.

**Direzione:** articolo sportivo di approfondimento prodotto da Metodo Sincro; testata editoriale esplicita, titolo serif, colonna di lettura, immagini nel racconto, dimostrazione grafica della reazione all’errore. Proposta: consulenza gratuita per valutare l’idoneità a un percorso a pagamento. Dati Trustpilot con fonte e data, nessun caso fittizio presentato come testimonianza.

- [x] Leggere manuale, bozza, pagina pubblica, AV Brain e tre riferimenti live.
- [x] Riscrivere `content.json` e produrre il testo integrale in Markdown.
- [x] Aggiornare `Advertorial.tsx` e `advertorial.module.css`; usare asset esistenti e font locale Source Serif 4.
- [x] Preparare anteprima disponibile solo in sviluppo, con tracciamento assente.
- [x] Verificare build, ESLint, test del collegamento, lettura desktop/mobile e CTA senza inviare contatti.
- [x] Documentare diagnosi, ragioni della nuova struttura, fonti, limiti e passaggi per un eventuale rilascio.

**Verifica:** `npx eslint app/f/pochi-minuti`; `npx tsx --test lib/advertorial.test.ts`; `npm run build`. Ispezione browser a 1365×900 e 390×844; controllare immagini, overflow e destinazione delle CTA.
