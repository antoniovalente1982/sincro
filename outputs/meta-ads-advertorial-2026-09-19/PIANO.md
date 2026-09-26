# Piano operativo — R3 Slippery Leadin

Stato: pubblicata, verifica 19/09/2026 alle 13:28. [Ricevuta](LEADIN_R3_RECEIPT.json). Il nome storico “Test 01” non indica una data di fine.

## Obiettivo e budget

Acquisire lead che completano la registrazione sulla landing, attraversando annuncio → advertorial → landing personalizzata. Campagna OUTCOME_LEADS, sito web, OFFSITE_CONVERSIONS, evento LEAD, pixel `311586900940615`.

Budget medio **100 €/giorno per l’intera campagna**. Campagna continuativa, senza data di fine né tetto cumulativo. Le finestre di analisi non sono scadenze della campagna e non autorizzano aumenti del budget.

## Pubblico e posizionamenti

Italia, minimo 38 anni, 65+ come massimo UI, tutti i generi, italiano; Advantage+ Audience disattivato. Segnali genitori con figli 13–17 e 18–26 anni, senza promessa di raggiungere esclusivamente genitori. Facebook Feed e Instagram Feed.

L’esclusione dei lead recenti è stata rimossa nell’account durante il lavoro, alle 13:20 del 19 settembre, come documentato nello storico Meta. Questa revisione dei copy conserva la configurazione corrente e non interviene sul pubblico.

## Storie, aperture e destinazioni

| Gruppo | Fonte narrativa | Articolo |
| --- | --- | --- |
| A01 | Elena: difficoltà nel dialogo intorno alla partita e cambiamento osservato | cosa-dire-dopo-brutta-partita |
| A02 | Vincenzo: padre allenatore, paura dell’errore e pochi minuti per dimostrare | fiducia-dopo-errore-calcio |
| A03 | Daniel: poco impiego, fiducia e ritorno al piacere di giocare | mio-figlio-gioca-poco |

Tre aperture di 11–14 parole per gruppo. Si entra nel passaggio di maggior intensità o nel cambiamento documentato, poi si sviluppa il racconto. Nessun episodio aggiunto come fatto reale. Consenso all’uso delle tre testimonianze confermato da Antonio. Le foto sono illustrazioni AI dichiarate, non foto dei recensenti.

Ogni articolo accompagna alla landing `/f/salto-di-qualita?entry=blog-<slug>`. L’annuncio promette l’approfondimento effettivamente presente, non una biografia integrale del recensente nella destinazione.

## Disegno del confronto

Dentro ogni gruppo cambiano solo le aperture. Corpo, headline, descrizione, visual, CTA e URL restano identici. Le trasformazioni automatiche del copy e delle immagini risultano disattivate nella rilettura dei creativi. Meta può distribuire quantità diverse di traffico: scarsa distribuzione non dimostra che una variante sia perdente.

La revisione rispetto a R1 cambia anche corpo, headline e abbinamento del visual. Non è un confronto causale del solo incipit rispetto a R1. Nessuna delle tre storie viene chiamata vincente in anticipo.

## Misurazione

- KPI principale: costo per Lead registrato; collegare poi qualità del contatto, appuntamenti e vendite.
- Passaggi diagnostici: visita advertorial, clic verso landing, visita landing, registrazione riuscita. Preservare ID annuncio, UTM e provenienza articolo.
- UTM fissi: `utm_source=facebook&utm_medium=paid&utm_campaign={{campaign.name}}&utm_term={{adset.name}}&utm_content={{ad.name}}&fbadid={{ad.id}}`.
- Nomi con tag `T:` validi e verificati nel Funnel Routing Engine. L’entry dell’articolo determina il contenuto pertinente della landing.
- Il registro della pubblicazione conserva primo e ultimo istante della sostituzione. Gli stessi ID comprendono lo storico R1: escluderlo dall’analisi R3. Per report giornalieri puliti, partire dal 20 settembre; la porzione del 19 richiede separazione temporale.
- Valutare spesa, esposizione e conversioni prima di intervenire. Nessuna promessa di CPL minimo o 5× ROAS; finestre di osservazione senza spegnimento automatico.

## Verifiche completate

Nove creativi riletti campo per campo, 18 anteprime Meta generate; controllo UI rappresentativo Facebook e Instagram. Tutti i nove annunci sono impostati ACTIVE. Budget, continuità, pubblico corrente, pixel, tracking specs e destinazioni riletti dopo l’applicazione. Stati effettivi: 9 ACTIVE.

Verifiche precedenti: ricezione CAPI di test e coerenza event ID browser/server; tre percorsi reali con parametri. Questa modifica non aggiunge un test Lead fittizio né dimostra un tasso aggregato di deduplicazione o risultati commerciali già ottenuti.

## Fonti e registri

[Testi](CREATIVITA.md), [autorizzazione](LEADIN_R3_AUTHORIZATION.json), [stato prima](LEADIN_R3_BEFORE.json), [registro modifiche](LEADIN_R3_LEDGER.json), [ricevuta dopo](LEADIN_R3_RECEIPT.json). Riferimento creativo persistente: `AV Brain/wiki/comunicazione/meta-ads-procedura.md` e chiarimento Slippery Leadin del 19 settembre 2026.
