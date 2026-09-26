# FUNNEL ADVERTORIAL — colonne Meta

Vista salvata e selezionata nell’account Antonio Valente Mental Coach Calciatori il 19 settembre 2026. Preset `10234383868519901`, pixel `311586900940615`.

[Apri la vista](https://adsmanager.facebook.com/adsmanager/manage/ads?act=511099830249139&business_id=1224962114308041&column_preset=10234383868519901&selected_campaign_ids=120251780591420047&selected_adset_ids=120251780591590047).

Per richiamarla: **Colonne → FUNNEL ADVERTORIAL**. Sono state verificate 39 colonne selezionate, oltre al comando No/Sì. Le metriche calcolate hanno visibilità “Solo tu” nel profilo Meta corrente.

## Ordine e significato

Prima: stato, spesa, budget, copertura, impression, frequenza, CPM, clic sul link, CPC, CTR e visualizzazioni della destinazione dell’annuncio con costo. Per gli annunci correnti la prima destinazione è l’articolo: la colonna generica di visualizzazioni non identifica il successivo arrivo alla landing commerciale.

Seguono sette fasi, ciascuna con **conteggio e costo**:

| Fase | Conversione Meta | Evento originario |
| --- | --- | --- |
| FA 01 - Visite advertorial | `1058561253611317` | `PageView` |
| FA 02 - Letture coinvolte | `2321604448628374` | `AdvertorialEngaged` |
| FA 03 - Clic verso landing | `1638734644277771` | `AdvertorialCTAClick` |
| FA 04 - Visite landing | `1549761069805437` | `PageView` |
| FA 05 - Landing coinvolta | `1071451772258575` | `ViewContent` |
| FA 06 - Moduli iniziati | `1801912774276966` | `StartForm` |
| FA 07 - Lead landing | `2366913450713482` | `Lead` |

- FA 01: apertura di un articolo pubblico sotto `landing.metodosincro.com/blog/`.
- FA 02: almeno 30 secondi visibili e 50% dell’articolo; indica coinvolgimento, non lettura completa.
- FA 03: clic sulla CTA dell’articolo; distinto dall’arrivo effettivo.
- FA 04: caricamento della landing `/f/salto-di-qualita`, incluse le varianti editoriali.
- FA 05: `ViewContent` della landing, attualmente emesso dal tracker dopo circa 3 secondi; distinto dalla semplice visita.
- FA 06: prima interazione con il modulo.
- FA 07: evento `Lead` dopo richiesta salvata sulla landing; non una visita alla pagina di ringraziamento.

Le regole classificano gli eventi esistenti: non inviano eventi aggiuntivi e non modificano l’ottimizzazione della campagna. Per FA 01–03 sono inclusi anche i futuri articoli `/blog/`; una nuova landing con URL diverso da `/f/salto-di-qualita` richiede aggiornamento o nuove conversioni appropriate. L’advertorial storico `/f/pochi-minuti` non è incluso nelle regole `/blog/`.

## Percentuali

| Colonna | Formula, formato percentuale |
| --- | --- |
| FA % Lettura advertorial | FA 02 / FA 01 |
| FA % Clic CTA articolo | FA 03 / FA 01 |
| FA % Arrivo dopo CTA | FA 04 / FA 03 |
| FA % Advertorial → Landing | FA 04 / FA 01 |
| FA % Landing → Modulo | FA 06 / FA 04 |
| FA % Modulo → Lead | FA 07 / FA 06 |
| FA % Landing → Lead | FA 07 / FA 04 |
| FA % Advertorial → Lead | FA 07 / FA 01 |

Infine: Risultati, Costo per risultato e Impostazione di attribuzione. Nella campagna corrente il risultato ottimizzato è il Lead sul sito. Le metriche native possono coprire un ambito diverso dalle conversioni FA filtrate per URL; servono anche da riferimento allo storico.

## Come leggere i dati

**Ogni costo è spesa pubblicitaria / eventi della fase**, nel periodo e nella finestra di attribuzione Meta. I costi non sono incrementali e non vanno sommati.

I conteggi sono eventi attribuiti, non persone uniche; le percentuali non ricostruiscono da sole una coorte sequenziale. Visite ripetute, attribuzione, consenso e ritardi possono produrre rapporti non intuitivi o superiori al 100%. Per il percorso osservato e il collegamento al contatto usare anche Blog → Risultati e CRM.

Le conversioni personalizzate sono state create tra le 13:57 e le 14:00 circa del 19 settembre. All’atto della creazione non risultava un `last_fired_time`; non è stata dimostrata la retroattività dei conteggi. «—» non va trasformato automaticamente in zero. Analizzare preferibilmente un periodo interamente successivo alla configurazione, lasciando il tempo di elaborazione a Meta. Nessun traffico o Lead sintetico è stato inviato per riempire le colonne.

## Prove e manutenzione

- `FUNNEL_ADVERTORIAL_RECEIPT.json`: identificativi e verifiche UI.
- `FUNNEL_COLUMNS_CUSTOM_CONVERSIONS_BEFORE.json`: nessuna conversione personalizzata preesistente nell’account al controllo iniziale.
- `FUNNEL_COLUMNS_CUSTOM_CONVERSIONS_AFTER.json`: sette regole rilette con pixel e categorie.
- `FUNNEL_COLUMNS_CUSTOM_CONVERSIONS_LEDGER.json` e file `*_01.json`: ricevute di creazione.
- Formule controllate nell’editor prima del salvataggio; nome del preset, ordine delle colonne e otto metriche selezionate riletti nella tabella finale.

La configurazione riguarda il report. Budget, pubblico, annunci e stato di erogazione non sono stati modificati durante questa attività.
