---
name: Advertorial — Pochi minuti
description: Documentazione della pagina editoriale Metodo Sincro e del collegamento alla consulenza esistente.
colors:
  ink: "#19241e"
  muted: "#526057"
  gold: "#c7a24d"
  rule: "#d6ddd7"
  paper: "#fff"
  consultation: "#eff3ef"
typography:
  display:
    fontFamily: "Sincro Editorial, sans-serif"
    fontSize: "clamp(42px, 5vw, 68px)"
    fontWeight: 700
    lineHeight: 1.03
  headline:
    fontFamily: "Sincro Editorial, sans-serif"
    fontSize: "34px"
    fontWeight: 700
    lineHeight: 1.18
  body:
    fontFamily: "Georgia, Times New Roman, serif"
    fontSize: "20px"
    lineHeight: 1.78
  interface:
    fontFamily: "Arial, Helvetica, sans-serif"
rounded:
  button: "4px"
components:
  button-primary:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.paper}"
    rounded: "{rounded.button}"
    padding: "16px 22px"
---

# Advertorial — Pochi minuti

Documentazione dell’estensione del 17 settembre 2026. I valori descrivono questa pagina; non definiscono un nuovo sistema grafico per tutto il gestionale.

## Overview

La pagina `/f/pochi-minuti` presenta l’approfondimento per i genitori e porta al modulo di consulenza già esistente. La direzione è quella di un articolo del brand: lettura su fondo bianco, titolo compatto, testo ampio e conclusione commerciale. Sono visibili l’attribuzione a Metodo Sincro, la natura promozionale e la distinzione tra consulenza gratuita e percorso a pagamento.

Il brief e le evidenze della revisione sono in [BRIEF.md](../outputs/ricerca-pain-genitori-2026-09-17/review/BRIEF.md). L’implementazione è circoscritta a [app/f/pochi-minuti](../app/f/pochi-minuti/), al generatore del link e al font locale. Questa documentazione non certifica che il rilascio in produzione sia completato.

## Colors

I colori della frontmatter corrispondono al CSS della pagina. L’inchiostro verde scuro serve per testo, CTA e footer; il tono attenuato per metadati e indice; l’oro segna il bordo superiore della conclusione. Il fondo chiaro della consulenza la distingue dal corpo dell’articolo. I divisori restano sottili e neutri.

## Typography

Titoli in Barlow Condensed Bold, registrato localmente come `Sincro Editorial`; corpo in Georgia; navigazione, metadati e pulsanti in Arial. I valori base sono riportati nella frontmatter.

Sotto 1000 px il corpo passa a 19 px. Fino a 760 px il titolo usa `clamp(40px, 9.5vw, 58px)`, i titoli delle sezioni 31 px e il corpo 19 px con interlinea 1,72. La conclusione ha un titolo di 38 px su desktop e 34 px su mobile. La gerarchia conserva la priorità della lettura rispetto agli elementi di interfaccia.

## Layout

Il contenitore desktop ha larghezza massima di 1224 px e margini interni laterali di 40 px. La prima sezione usa due colonne, testo e immagine, in proporzione 1,28:1. Il corpo affianca un indice di 220 px a una colonna di lettura larga al massimo 720 px, separati da 76 px. L’indice rimane visibile durante lo scorrimento, a 32 px dal bordo superiore.

Fino a 1000 px si riducono indice e spazi tra le colonne. Fino a 760 px la pagina diventa una sola colonna con margini laterali di 22 px; l’indice scompare, la CTA occupa tutta la larghezza e il footer si dispone in verticale. L’immagine passa da rapporto 4:5 a 4:3, con ritaglio tramite `object-fit: cover`.

## Elevation & Depth

La pagina non usa ombre. La struttura è affidata a spazi, divisori, contrasto tipografico e fondo distinto della conclusione. Il solo movimento specifico è la transizione del colore della CTA (0,2 secondi), disattivata con `prefers-reduced-motion`.

## Shapes

Immagine, sezioni e conclusione hanno bordi rettangolari. La CTA ha gli angoli leggermente arrotondati definiti nella frontmatter e altezza minima di 56 px. Le citazioni in evidenza usano divisori sopra e sotto, senza contenitori decorativi.

## Components

- **Navigazione:** marchio testuale verso l’inizio, collegamento “Parliamone” alla conclusione, collegamento all’articolo e indice desktop con ancore alle sezioni.
- **Accessibilità della lettura:** collegamento “Vai all’articolo” visibile al focus; struttura `main`/`article`, titoli gerarchici, testo alternativo e didascalia dell’immagine. Il focus dei link ha contorno di 3 px (`#916714`) con offset di 5 px.
- **CTA:** collegamento alla consulenza, sfondo scuro e testo bianco; al passaggio del puntatore lo sfondo diventa `#2e4836`. Il testo proviene dalle impostazioni Funnel.
- **Conclusione:** contenitore chiaro, bordo superiore oro di 3 px, CTA e condizioni essenziali. La pagina non contiene un nuovo modulo di raccolta contatti.

## Do's and Don'ts

- Conservare la disclosure promozionale e la didascalia “Immagine illustrativa”.
- Mantenere leggibilità, gerarchia e margini delle due viste; verificare eventuali titoli più lunghi anche su mobile.
- Non descrivere l’immagine come un cliente o una testimonianza verificata.
- Non trasformare queste scelte locali in regole globali per gli altri funnel.

## Gestione del contenuto e disponibilità

La route legge il record `funnels` con slug `pochi-minuti` e **status `active`**. Se il record attivo non è disponibile, risponde con pagina non trovata. Anche il parametro di anteprima non supera questo requisito: la modalità anteprima riguarda il tracciamento, non la pubblicazione di una bozza.

Nel gestionale, sezione Funnel, il record previsto è **Advertorial — Pochi minuti**. I campi già presenti permettono di modificare:

| Contenuto | Campo | Valore in assenza di personalizzazione |
| --- | --- | --- |
| Titolo | `settings.headline` | `content.json → headline` |
| Sottotitolo | `settings.subheadline` | `content.json → subheadline` |
| Testo CTA | `settings.cta_text` | “Richiedi una consulenza gratuita” |

Il corpo, l’indice e la conclusione sono in [content.json](../app/f/pochi-minuti/content.json): una modifica richiede aggiornamento del file e rilascio dell’applicazione. Il renderer supporta paragrafi, elenchi ed enfasi delimitata da `**`; i titoli delle sezioni hanno ID usati dalle ancore. La data, l’attribuzione, la disclosure, le condizioni e il footer sono nel componente [Advertorial.tsx](../app/f/pochi-minuti/Advertorial.tsx).

I metadati usano il titolo personalizzato e, per la descrizione, `funnel.description` oppure il sottotitolo del JSON. La descrizione SEO non segue automaticamente `settings.subheadline`. Il canonical configurato è `https://landing.metodosincro.com/f/pochi-minuti`.

## Destinazione, attribuzione e anteprima

[advertorialConsultationHref](../lib/advertorial.ts) produce un link a `/f/salto-di-qualita#ms-form`. Copia dalla query solo `utm_source`, `utm_medium`, `utm_campaign`, `utm_content`, `utm_term`, `fbclid` e `fbadid`; aggiunge `entry=advertorial-pochi-minuti`. I parametri arbitrari, inclusi email, telefono e destinazioni alternative, non vengono propagati.

Le visite sono collegate all’ID del nuovo funnel `pochi-minuti`, tramite il sistema di tracciamento esistente. La pagina non crea una nuova procedura di invio: i contatti raccolti dal modulo restano attribuiti al funnel di consulenza di destinazione. **`entry` è un indicatore del passaggio tra le pagine; non costituisce una nuova implementazione di reportistica delle conversioni dell’advertorial.**

Aprendo l’articolo con `?ab=A` oppure `?ab=B`, il tracciamento delle visite viene disabilitato e il link di destinazione riceve `ab=A`, mantenendo l’anteprima anche sul funnel successivo. Non viene avviato il nuovo script Pixel in questa modalità. Il hook condiviso può comunque gestire UTM e identificatori locali: l’anteprima non equivale a isolamento completo dello storage del browser. Non è stata aggiunta una seconda variante del contenuto.

## Provenienza degli asset

- **Fotografia:** [public/landing-luglio/img-bench.jpg](../public/landing-luglio/img-bench.jpg), asset dell’utente già presente nel progetto e riutilizzato senza modifiche. L’origine precedente non è stata verificata. È presentato come immagine illustrativa.
- **Font dei titoli:** [public/fonts/barlow-condensed-bold.ttf](../public/fonts/barlow-condensed-bold.ttf), Barlow Condensed Bold dal [repository Google Fonts](https://raw.githubusercontent.com/google/fonts/main/ofl/barlowcondensed/BarlowCondensed-Bold.ttf). Licenza SIL Open Font License 1.1 conservata in [barlow-condensed-OFL.txt](../public/fonts/barlow-condensed-OFL.txt). Il font è servito localmente con `font-display: swap`.
- **Altri font:** Georgia, Times New Roman, Arial e Helvetica sono stack di sistema; non sono stati aggiunti download esterni per queste famiglie.

## Verifiche e confini

Le evidenze del brief riportano build di produzione riuscita, ESLint sui nuovi file e tre test del link superati: mantenimento attribuzione e ancora, esclusione dei parametri arbitrari, propagazione dell’anteprima. La revisione indipendente ha confrontato tutti i 50 blocchi di contenuto con la bozza e dato esito **ship**, senza rilievi materiali di impaginazione, leggibilità o CTA sulle viste desktop e mobile.

Le schermate di revisione sono state prodotte a 1365×900 e 390×844: immagine caricata e nessun overflow orizzontale rilevato. L’anteprima locale usa una fixture temporanea senza modificare il database. Il record Funnel è stato verificato inizialmente in stato Bozza.

Queste sono evidenze di implementazione e anteprima, non una misura di conversione. Al momento della stesura restano da verificare dopo il rilascio la risposta della route pubblica con record attivo, il caricamento degli asset in produzione e il collegamento effettivo al modulo. Non sono qui attestati invii reali, consegna degli eventi a Meta o incremento delle conversioni.
