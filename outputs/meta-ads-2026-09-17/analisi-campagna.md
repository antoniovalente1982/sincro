# Analisi campagna Metodo Sincro — 17 settembre 2026

Campagna: **MS | LEAD WEB | Genitori 40-60 | Nord+Lazio | 16.09.2026** (`120251721514160047`). Snapshot API: **17 settembre, ore 07:11 italiane**, periodo Meta 16–17 settembre. Il primo controllo nell'interfaccia mostrava 68,23 €; durante l'analisi la spesa è salita a 70,95 €. Le cifre qui sotto si riferiscono all'ultimo snapshot salvato, non a un monitoraggio continuo.

**Diagnosi:** il traffico raggiunge la pagina, ma non produce richieste salvate. La landing presenta ostacoli concreti su messaggio, accesso mobile e misurazione. È una priorità d'intervento; non abbiamo prove sufficienti per attribuirle da sola lo zero o dichiarare fallito il pubblico dopo circa 15 ore dalla creazione della campagna.

## Numeri verificati

| Indicatore | Valore |
|---|---:|
| Spesa | 70,95 € |
| Impression | 11.279 |
| Clic sul link | 94 |
| Costo per clic sul link | 0,75 € |
| CTR link | 0,83% |
| CPM | 6,29 € |
| Visualizzazioni landing attribuite da Meta | 61 |
| Costo per visualizzazione landing | 1,16 € |
| Lead attribuiti da Meta | 0 |
| Richieste salvate nel funnel dal 16 settembre | 0 |

Il database è stato interrogato dalla mezzanotte italiana del 16 settembre fino allo snapshot. La tabella `funnel_submissions` non contiene richieste del funnel `salto-di-qualita` in questo intervallo. Questo esclude che lo zero sia soltanto un problema di visualizzazione del risultato in Ads Manager; non dimostra ancora che un invio tentato da un utente non possa fallire prima del salvataggio.

La configurazione è coerente con l'acquisizione contatti: obiettivo Contatti, ottimizzazione conversioni sul sito, evento Lead, pixel `311586900940615`, genitori 40–60 e nove regioni Nord+Lazio. Non emerge una campagna impostata per comprare semplicemente clic. Budget corrente 100 €/giorno, stato ACTIVE. Le caratteristiche suggerite del pubblico non dimostrano la qualificazione commerciale dei visitatori.

## Dove intervenire

**1. Coerenza annuncio–landing e credibilità della promessa.** I quattro annunci presentano preparazione mentale, continuità, salto di categoria e preparazione alla partita. L'apertura predefinita della pagina promette un moltiplicatore delle probabilità di diventare professionista. Nel materiale aziendale consultato non è documentata una dimostrazione di quel moltiplicatore. Seguono promesse su primi risultati in 10 giorni, soluzione in 90 giorni e garanzia senza condizioni complete vicino al messaggio. È plausibile che una famiglia interessata all'argomento del video trovi questa apertura meno credibile o poco pertinente. È un'ipotesi commerciale motivata, non una causalità misurata.

Priorità: conservare l'ambizione del salto di qualità e collegarla ad abilità allenabili e a un primo confronto concreto. Esplicitare vicino alla richiesta cosa accade nella chiamata e che l'eventuale percorso successivo è individuale e a pagamento. Usare solo tempi e condizioni effettivamente supportati. V03 assorbe la maggior parte del traffico: la continuità fra il suo tema e l'apertura della landing è particolarmente importante.

**2. Accesso al contatto da telefono.** Verifica live a 390×844: nella variante A non sono visibili nella prima schermata né i campi né il pulsante di invio; il video e diversi blocchi di prova precedono il modulo. L'azione nell'intestazione desktop non compare nello screenshot mobile. La variante B presenta subito la prima domanda e il pulsante Continua, ma introduce tre passaggi. Ha un accesso iniziale più evidente, non una superiorità di conversione dimostrata.

Priorità: rendere immediatamente visibili il beneficio del primo colloquio e un'azione verso il modulo, con video facoltativo. Evitare di scegliere B come “vincitrice” sulla base di poche decine di visite. Il test attuale cambia insieme posizione, ordine e struttura del modulo.

Il pannello del player “Hai già iniziato a guardare questo video” è stato osservato su questo browser, che aveva visite pregresse: non viene attribuito a tutti i nuovi visitatori.

**3. Divario fra clic e visite registrate.** Meta registra 61 visualizzazioni su 94 clic, circa il 65%. Il divario del 35% richiede attenzione, ma non equivale a 33 persone certamente perse per lentezza: sono conteggi di eventi, con ritorni, attribuzione e misurazione differenti.

Nel database ci sono 101 pageview con l'UTM della campagna e 92 identificativi visitatore distinti. Non sono 92 potenziali clienti validati: compaiono una raffica iniziale di visite con nomi annunci codificati e due visite con `{{ad.name}}` non risolto, compatibili con anteprime o test ma non classificate definitivamente. La sola esclusione dei bot riconoscibili dallo user-agent non ripulisce tutti questi casi. Non uso quindi il totale del gestionale come denominatore affidabile del test A/B.

Il report tecnico del **16 settembre** misurava LCP mobile 3,9 s, performance 70/100 e TBT 460 ms. È una simulazione precedente, non una nuova misura del 17 settembre. Suggerisce di alleggerire player, font e JavaScript. Il riferimento per LCP buono è ≤2,5 s al 75° percentile delle visite reali ([Google web.dev](https://web.dev/articles/defining-core-web-vitals-thresholds)).

**4. Tracciamento e invio da verificare fino in fondo.** I log dell'organizzazione mostrano 117 PageView, 103 ViewContent e 4 StartForm accettati dal provider nel periodo. Non contengono attribuzione sufficiente per assegnare tutti questi eventi alla nuova campagna: non è corretto dire che solo quattro suoi visitatori hanno iniziato il modulo. Compare anche un Lead accettato prima della creazione della campagna, che non va conteggiato per questa iniziativa.

Nel codice locale il client invia l'indirizzo completo della landing, mentre il server antepone di nuovo `https://` al valore. È un difetto concreto nella costruzione dell'URL degli eventi, non la prova che abbia causato lo zero: non risultano richieste di questo funnel da trasformare in Lead. Inoltre i passaggi, gli errori e gli abbandoni del modulo non hanno misure locali sufficienti per individuare il punto preciso di uscita.

Priorità tecnica: test controllato dell'intera catena modulo → salvataggio → lead CRM → evento Meta, correggere la costruzione dell'URL e registrare variante, annuncio, passaggi ed errori senza duplicare eventi. Un eventuale test deve essere riconoscibile ed escluso dal lavoro commerciale e dalle conversioni reali. Durante questo audit non sono stati inviati contatti fittizi né attivate notifiche ai venditori.

## Le quattro inserzioni

| Inserzione | Spesa | Clic link | CTR link | CPC link | Visite Meta | Lead |
|---|---:|---:|---:|---:|---:|---:|
| V01 — 3 chiavi mentali | 8,84 € | 7 | 0,46% | 1,26 € | 3 | 0 |
| V02 — Talento e continuità | 3,72 € | 4 | 0,96% | 0,93 € | 2 | 0 |
| V03 — Salto di categoria | 46,19 € | 68 | 0,89% | 0,68 € | 46 | 0 |
| V04 — Preparazione alla partita | 12,20 € | 15 | 0,88% | 0,81 € | 10 | 0 |

V03 assorbe circa il 65% della spesa e porta il maggior volume di visite; è il miglior segnale sul traffico, non una creatività vincente sui lead. V01 è il segnale relativamente più debole sul clic, ma ha solo sette clic. V02 ha avuto un'esposizione troppo ridotta per una valutazione commerciale. Non eliminerei V02 né dichiarerei V03 vincitrice sulla base di questi dati.

I video originali durano circa 78–96 secondi e sono orizzontali. In totale Meta registra 2.140 visualizzazioni da almeno 3 secondi e 83 completamenti: circa il 3,9% dei primi arriva al completamento, rapporto descrittivo fra eventi. Questo giustifica il test di una versione breve con proposta e azione anticipate, senza presumere che la durata spieghi da sola l'assenza di contatti.

Facebook Reels registra circa 20,34 € e 25 visite, il feed Facebook 22,49 € e 18 visite; Instagram Reels circa 12,21 € e 5 visite. Sono differenze di costo della visita, non di qualità del lead. Audience Network assorbe circa un centesimo: non spiega materialmente la spesa senza risultati. Non ci sono elementi sufficienti per tagliare un posizionamento in base al costo cliente.

## Interpretazione del campione e decisione proposta

Settanta euro non costituiscono da soli una soglia universale di fallimento. Come esempio aritmetico, con 60 visitatori indipendenti e un tasso reale ipotetico del 2%, la probabilità di zero contatti è circa il 30%. Non è una stima del tasso reale di questa campagna: le 61 visualizzazioni Meta non sono necessariamente visitatori unici indipendenti. Il precedente 2% del gestionale proveniva inoltre da traffico misto.

La spesa ha comprato un campione ancora piccolo, nel quale non si è verificata una conversione. Le debolezze osservate meritano un intervento adesso, senza aspettare un campione enorme per correggere chiarezza e accessibilità.

Ordine operativo consigliato:

1. Verificare l'invio completo e la misurazione; risolvere i difetti confermati.
2. Allineare la promessa alla preparazione mentale e al tema del video, rendendo chiara la chiamata gratuita e il percorso successivo a pagamento.
3. Portare l'azione nella prima schermata mobile, alleggerire il caricamento e distinguere le visite tecniche.
4. Misurare una revisione identificabile della pagina, mantenendo una base di confronto e senza suddividere il budget in numerosi nuovi test.
5. Valutare i risultati su richieste valide, famiglie qualificate, appuntamenti e contratti. Definire un limite di spesa per il test in base al costo di acquisizione sostenibile: i dati disponibili non giustificano una soglia economica definitiva.

**Non aumenterei ora il budget.** La campagna risulta ancora attiva a 100 €/giorno. Questo audit non ha modificato budget, pubblicazione, annunci, targeting, landing o database.

L'interfaccia mostrava anche una campagna distinta, “Nuova Campagna Settembre 2026”, attiva, con 151,51 € e quattro lead nel periodo 1–17 settembre al primo controllo. Questi numeri non vanno sommati o trasferiti alla nuova campagna; non dimostrano che il suo stesso percorso di acquisizione funzioni.

## Fonti e limiti

- [Snapshot API e aggregati database](./dati-verificati.json); [script di sola lettura](./read-audit.mjs). Nessun recapito personale incluso nel report.
- [Configurazione e testi del 16 settembre](../meta-ads-2026-09-16/campagna.md).
- [Audit landing e PageSpeed del 16 settembre](../meta-ads-2026-09-16/analisi-landing-margine.md).
- Landing verificata live nelle anteprime A e B: https://landing.metodosincro.com/f/salto-di-qualita.
- AV Brain consultato: [[percorso-mental-coaching]], [[casi-studio-recensioni]], indici Metodo Sincro e Comunicazione; mandato acquisizione del 5 settembre con aggiornamento del target del 7 settembre.
- Un primo tentativo browser ha restituito errore DNS. Il controllo successivo ha dato DNS valido e HTTP 200 e il browser ha poi caricato entrambe le varianti. Non è dimostrato un disservizio generalizzato né il suo contributo ai risultati.
- Mancano un test completo dell'invio durante questo audit, l'attribuzione dei singoli passaggi del modulo e una base verificata di costo per cliente/qualificazione. Le cause commerciali restano ipotesi da validare.
