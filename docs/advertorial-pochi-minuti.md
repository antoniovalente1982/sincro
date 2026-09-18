# Advertorial — Dentro la partita

Revisione V3 del 18 settembre 2026 della pagina `/f/pochi-minuti`, scelta da Antonio come modello unico per tutte le pagine advertorial. Stato del rilascio corrente: [Blog — STATO](../outputs/blog-dentro-la-partita-2026-09-18/STATO.md). Il rilascio precedente del 17 settembre rimane documentato in [PUBBLICAZIONE.md](../outputs/ricerca-pain-genitori-2026-09-17/PUBBLICAZIONE.md).

- [Analisi e scelte](../outputs/revisione-advertorial-2026-09-18/ANALISI_E_SCELTE.md)
- [Testo completo V3](../outputs/revisione-advertorial-2026-09-18/ADVERTORIAL_V3.md)
- [Proposta Mappa Sincro e processo di consegna](../outputs/revisione-advertorial-2026-09-18/PROPOSTA_MAPPA_SINCRO.md)
- [Stato e rilascio](../outputs/revisione-advertorial-2026-09-18/STATO_E_RILASCIO.md)
- [Documentazione precedente archiviata](../outputs/revisione-advertorial-2026-09-18/DOCUMENTAZIONE_V1_ARCHIVIO.md)

## Scopo e direzione

Target di questo articolo: genitori di calciatori di 16–18 anni. Percorso: comprensione del problema → spiegazione e dimostrazione → valutazione di un percorso individuale → richiesta di consulenza gratuita.

«Dentro la partita» è una rubrica del brand, dichiarata come contenuto pubblicitario di Metodo Sincro. Titolo serif, singola colonna di lettura, immagini dentro l’articolo, figura del fondatore, diagramma del sentirsi sotto esame ed esempio illustrativo della risposta all’errore. Nessun media indipendente, intervista, cliente o risultato fittizio.

Il dato Trustpilot (4,9/5, 361 recensioni) è accompagnato dal link originale e dalla data di rilevazione, 18 settembre 2026. Non viene interpretato come una misura di efficacia e le recensioni non sono definite tutte «verificate».

## File e contenuti

- `Advertorial.tsx`: renderer server, struttura editoriale e due CTA; nessun nuovo modulo.
- `content.json`: titolo, sottotitolo, introduzione, sezioni, conclusione, FAQ, diagramma, esempio comparato, dato recensioni e condizioni.
- `advertorial.module.css`: stili circoscritti alla pagina.
- `page.tsx`: lettura del funnel attivo, metadati, parametri e rendering della pagina pubblica.
- `AdvertorialTracking.tsx`: componente esistente di tracciamento; invariato.
- `anteprima/page.tsx`: anteprima esclusivamente development, indipendente dal database, senza componente di tracking dell’articolo; 404 in produzione, noindex.

Il corpo usa paragrafi, citazione editoriale (`pullquote`), diagramma, dimostrazione, prova, invito intermedio e sei FAQ. I blocchi `image` contengono `src`, `alt` e `caption`. Due nuove immagini mostrano azione in campo e sessione online; sono scene AI dichiarate, non prove di risultati o clienti reali. L’enfasi nei paragrafi si scrive con `**testo**`; React effettua l’escaping dei contenuti. ID delle sezioni usati per le ancore.

L’offerta «Mappa Sincro» è una proposta separata con modello HTML compilabile. Prima di sostituire la consulenza nelle CTA e nel modulo di destinazione bisogna organizzare chi conduce il confronto e consegna la scheda. Il codice attuale non promette la nuova consegna.

## Impostazioni del gestionale

Il record `funnels` con slug `pochi-minuti` deve essere `active` per la pagina pubblica. `?ab=A` e `?ab=B` disattivano il tracciamento delle visite ma non superano il requisito di stato attivo.

Le impostazioni del record hanno precedenza sui valori di `content.json`:

| Campo | Uso |
| --- | --- |
| `settings.headline` | Titolo della pagina e metadati |
| `settings.subheadline` | Sottotitolo e prima scelta per la descrizione SEO |
| `settings.cta_text` | Entrambi i pulsanti |
| `description` | Seconda scelta per la descrizione SEO |

I valori editoriali sono preparati in [IMPOSTAZIONI_FUNNEL_PROPOSTE.json](../outputs/revisione-advertorial-2026-09-18/IMPOSTAZIONI_FUNNEL_PROPOSTE.json), dopo aver riletto lo stato corrente. Applicare `settings_patch` conservando tutte le altre impostazioni. Il corpo richiede un rilascio dell’applicazione. La revisione non aggiorna automaticamente il database.

## Destinazione e tracciamento

`lib/advertorial.ts` costruisce il link a `/f/salto-di-qualita#ms-form`. Mantiene soltanto `utm_source`, `utm_medium`, `utm_campaign`, `utm_content`, `utm_term`, `fbclid`, `fbadid`; aggiunge `entry=advertorial-pochi-minuti`. I parametri arbitrari e i dati di contatto non vengono propagati.

In anteprima aggiunge `ab=A` alla destinazione. La route locale di anteprima usa il dominio pubblico per consentire la verifica del modulo senza dipendere dal database locale.

Le visite pubbliche restano attribuite al funnel dell’articolo. I lead rimangono sul funnel di consulenza: `entry` non costituisce da solo un’implementazione di reportistica delle conversioni dell’advertorial. Nessun nuovo evento, test A/B o budget è stato attivato.

## Sistema visivo e accessibilità

Carta `#fffefb`, testo `#20231f`, secondario `#5c625a`, divisori `#d9dbd4`, accento `#92501f`, CTA `#254432`. Titoli Source Serif 4; testata Barlow Condensed Bold; corpo Georgia; interfaccia Arial. Font self-hosted e `font-display: swap`.

Desktop: larghezza massima 1120 px, colonna articolo fino a 760 px e colonna autore 240 px. Sotto 900 px, articolo in colonna unica; identità del fondatore sempre nella byline. Mobile: margini 20 px, corpo 18 px, diagramma e confronto in verticale, pulsanti larghi quanto il contenitore. Nessun elemento fisso invade la lettura.

Skip link, focus visibile, gerarchia h1/h2/h3, figure con didascalie, testi alternativi, pulsanti di almeno 56 px; icone decorative escluse dall’albero accessibile. CTA con contrasto verificato circa 10,76:1. Movimento limitato all’hover, disattivato con `prefers-reduced-motion`.

## Asset

Le due scene con calciatori di circa 17 anni rimangono quelle generate il 17 settembre; ogni didascalia ne dichiara la natura illustrativa AI. Ritratto di Antonio: `public/images/team/antonio-valente.jpg`, già nel progetto.

Source Serif 4: [Google Fonts](https://github.com/google/fonts/tree/main/ofl/sourceserif4), convertito in WOFF2 con subset latino e punteggiatura (132.540 byte), licenza OFL conservata. Barlow e relativa OFL già presenti. Nessun nuovo download di font da terzi durante la visita.

## Verifiche della revisione

Build finale di produzione, ESLint mirato, tre test esistenti del link e `git diff --check` superati. Anteprima verificata a 1365×900 e 390×844: immagini caricate, nessun overflow orizzontale, collegamenti corretti. Clic reale sulla CTA: modulo di destinazione aperto con tre campi di testo, senza invio.

Revisione indipendente finale: **ship per la revisione locale**, nessun rilievo materiale aperto. Anteprima verificata 404 anche con server di produzione locale. Le verifiche non certificano pubblicazione, ricezione dei lead, consegna degli eventi a Meta o miglioramento delle conversioni.
