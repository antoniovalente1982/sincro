# Landing collegate agli advertorial

Pubblicato il 18 settembre 2026 · commit `194170b7`. Ora sono online 19 advertorial: la prima pagina, i 17 articoli precedenti e il nuovo approfondimento sul calcio femminile.

## Link per vedere il risultato

- [Nuovo advertorial: tua figlia e il calcio femminile](https://landing.metodosincro.com/blog/calciatrice-fiducia-calcio-femminile).
- [Landing sul calcio femminile](https://landing.metodosincro.com/f/salto-di-qualita?entry=blog-calciatrice-fiducia-calcio-femminile#ms-form).
- [Landing sulla panchina](https://landing.metodosincro.com/f/salto-di-qualita?entry=blog-mio-figlio-gioca-poco#ms-form).
- [Landing sul rientro dopo l’infortunio](https://landing.metodosincro.com/f/salto-di-qualita?entry=blog-paura-rientro-infortunio-calcio#ms-form).
- [Tutti gli articoli](../advertorial-storie-2026-09-18/ANTEPRIME.md).
- [Gestionale Blog](https://landing.metodosincro.com/dashboard/blog).

## Come funziona per gli articoli futuri

1. Crea l’advertorial nel Blog: titolo, argomento, immagine e testo.
2. La landing usa automaticamente titolo e immagine; l’argomento determina situazioni, percorso, obiettivi, FAQ e chiusura.
3. In **Landing collegata** puoi scegliere un tema più preciso e scrivere titolo e introduzione specifici. I campi sono facoltativi.
4. Pubblica o aggiorna l’articolo. Il pulsante dell’advertorial porta automaticamente alla versione pertinente della stessa landing. Il collegamento “Apri la landing salvata” nell’editor permette di controllare la versione pubblicata.

Non occorre aggiungere ogni nuovo indirizzo nel codice. Non viene generato testo AI durante la visita: si usano i contenuti salvati dell’articolo e i temi editoriali predisposti. Un argomento completamente nuovo può usare il tema più pertinente; per una struttura diversa si potrà aggiungere un tema riutilizzabile.

La personalizzazione riguarda titolo, introduzione, immagine, modulo, situazioni riconoscibili, costo del problema, percorso, obiettivi, FAQ, invito finale, barra mobile, popup e conferma. Le informazioni sul team e le prove del servizio restano condivise. Il primo incontro è rivolto al genitore; l’eventuale percorso è a pagamento.

## Famiglie e calcio dilettantistico

Messaggio esplicito all’inizio e vicino al modulo: non serve essere professionisti; il percorso è anche per ragazzi e ragazze di scuole calcio, squadre locali e settore giovanile. La galleria dei professionisti si apre su richiesta. Non viene più presentata come requisito implicito di accesso.

## Nuovo advertorial e immagini

La storia di Emma è illustrativa, non una testimonianza. Il testo è in [ADVERTORIAL_CALCIATRICE.md](ADVERTORIAL_CALCIATRICE.md), i dati editoriali in [CALCIATRICE.json](CALCIATRICE.json).

Tre immagini create con lo strumento integrato `image_gen`, conservando lo stesso personaggio:

- [Copertina: Emma a bordo campo](../../public/images/blog/storie/calciatrice-fiducia-calcio-femminile-01.webp).
- [Emma con sua madre](../../public/images/blog/storie/calciatrice-fiducia-calcio-femminile-02.webp).
- [Emma durante l’allenamento](../../public/images/blog/storie/calciatrice-fiducia-calcio-femminile-03.webp).

[Prompt completi e sorgenti](GENERAZIONE.json). Le fonti FIGC e UEFA sono collegate nel testo dell’articolo.

## Verifica

- 22 test automatici superati su blog, link e risoluzione della landing.
- 22 controlli HTTP locali e 22 in produzione: 19 provenienze editoriali, pagina generale e due casi di ingresso non riconosciuto in produzione.
- Nuovo articolo: HTTP 200, tre immagini presenti, CTA al femminile, canonical, dati Article e sitemap verificati.
- Controllo visivo desktop, modulo a 390 e 320 pixel senza overflow, campi dell’editor e apertura/chiusura della galleria professionisti.
- Controllo TypeScript superato escludendo una copia duplicata preesistente del file generato `.next/types/routes.d 2.ts`; build Vercel completata. Lint dei nuovi moduli e dell’editor superato; la landing conserva le segnalazioni preesistenti, senza nuove categorie o conteggi.
- Nessun lead di prova inviato. L’indicizzazione effettiva resta a discrezione di Google.

[Ricevuta pubblicazione](PUBBLICAZIONE_CALCIATRICE.json) · [Verifica landing live](VERIFICA_LIVE.json) · [Verifica articolo](VERIFICA_CALCIATRICE.json). Backup dei contenuti precedenti nella cartella locale `snapshots`.

## Ritocchi richiesti il 18 settembre

Titolo aggiornato a «Dalla squadra provinciale ai professionisti» (`697d1251`). Il pulsante «Scopri i professionisti che seguiamo» è ora un riquadro giallo con testo scuro più grande, icona e indicatore di apertura (`9c84a19d`). Verificati apertura e chiusura della galleria e assenza di overflow a 320 pixel.

## Tracciamento attivato il 19 settembre

Tutti i 19 advertorial, e automaticamente i prossimi articoli pubblicati nel Blog, usano il pixel condiviso `311586900940615` e aprono la landing personalizzata conservando la provenienza. Non serve inserire il pixel in ogni articolo.

Il percorso distingue visita all’articolo, coinvolgimento, clic, arrivo sulla landing, inizio modulo e richiesta salvata. I risultati sono in **Blog → Risultati**; il percorso disponibile è nella scheda del contatto CRM. Le preferenze di analisi e marketing sono condivise fra le pagine. Prima della registrazione si osserva un browser, non il nome della persona.

Pubblicazione e controlli online completati (`29eeebcc`): 19 pagine verificate, sei scenari browser e prova endpoint/database superati. Connessione Meta valida; ricezione e deduplicazione effettive in Gestione eventi ancora da confermare. [Resoconto e verifiche](../editorial-tracking-2026-09-19/README.md).
