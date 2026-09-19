# Percorso advertorial → landing → lead

Data: 19 settembre 2026. Stato: implementazione autorizzata, pubblicata e verificata online; migrazione applicata. Stato della pubblicazione e limiti della verifica Meta nel [resoconto operativo](../../../outputs/editorial-tracking-2026-09-19/README.md).

## Risultato richiesto

Antonio vuole distinguere chi visita gli advertorial, chi passa alla landing e chi lascia i contatti. Il risultato comprende due viste: eventi distinti in Meta e un report nel gestionale, con la provenienza nella scheda del lead.

Prima della registrazione conosciamo un identificativo del browser, non il nome della persona. Dopo l'invio possiamo collegare quel percorso al contatto, se l'identificativo è disponibile. Dispositivi diversi, navigazione privata, preferenze di tracciamento e blocchi del browser possono interrompere il collegamento. Nessun riconoscimento mediante impronte digitali del dispositivo.

## Stato iniziale verificato nel progetto

- `app/blog/[slug]/page.tsx` e `app/blog/BlogViews.tsx`: gli articoli pubblici non montano un componente di tracking. Anche i layout condivisi non lo aggiungono.
- `app/f/pochi-minuti/AdvertorialTracking.tsx`: usa il tracciamento delle landing. Nel codice servito online controllato in questa conversazione `pixelId` risulta assente, quindi il componente non inizializza il pixel browser.
- `/f/salto-di-qualita`: il codice online include il pixel `311586900940615`. La ricezione degli eventi in Gestione eventi Meta non è stata verificata.
- `lib/useMetaTracking.ts`: conserva `_sincro_vid`, UTM e identificativi Meta; invia `PageView` e `ViewContent`. Quest'ultimo usa attualmente `content_name: landing` per tutte le pagine che richiamano l'hook. L'invio browser di PageView dipende dalla presenza immediata di `fbq`: va verificato anche il caricamento ritardato del pixel.
- `lib/blog.ts`: i pulsanti degli articoli conservano i parametri della campagna e aggiungono `entry=blog-<slug>`.
- `MetodoSincroLandingV2.tsx`: il modulo invia `visitor_id` ed `extra_data.editorial_entry`.
- `app/api/submit/route.ts`: salva `editorial_entry` nella richiesta e `first_editorial_entry` / `last_editorial_entry` nel lead. Questi ultimi descrivono la provenienza delle richieste, non una cronologia completa di lettura. Il visitatore è salvato alla creazione del lead, ma il ramo di aggiornamento di un lead esistente non aggiunge il nuovo browser.
- Il Blog del gestionale mostra contenuti e piano editoriale; non presenta il percorso di conversione.
- Gli articoli sono nella tabella `blog_posts`, distinta da `funnels`. L'ID dell'articolo non va passato come ID di un funnel.
- Il consenso implementato in `LandingBehaviorAnalytics` riguarda Clarity, non autorizza automaticamente Meta.
- Il server premette `https://` a `landing_url`, mentre la landing V2 invia già un URL completo: la normalizzazione della provenienza deve correggere anche questo caso.

## Alternative

1. **Pixel, eventi e report nel gestionale — consigliata.** Copre sia il confronto fra articoli sia il collegamento al contatto registrato. Richiede raccolta e report coerenti, oltre all'installazione del pixel.
2. **Solo pixel sugli advertorial.** Intervento limitato: aggiunge segnali a Meta, ma non completa il percorso consultabile nel CRM.
3. **Piattaforma analytics aggiuntiva.** Può offrire analisi del percorso; introduce un altro strumento, configurazione e possibili costi. Per questa esigenza la base del gestionale è già riutilizzabile.

## Configurazione implementata

Usare lo stesso pixel della landing per gli advertorial e per la landing di destinazione, risolvendo la configurazione sul server per l'organizzazione corretta. Il browser riceve soltanto l'ID pubblico del pixel; i token restano sul server. Un'incongruenza fra pixel della landing e connessione CAPI deve essere segnalata prima della pubblicazione.

### Passaggi da misurare

| Passaggio | Quando si registra | Dato disponibile nel gestionale | Evento Meta |
| --- | --- | --- | --- |
| Visita all'advertorial | Apertura pubblica della pagina | Articolo, visitatore, data, campagna | PageView con tipo pagina advertorial |
| Coinvolgimento nell'articolo | Almeno 30 secondi di pagina visibile e almeno 50% dell'articolo raggiunto | Segnale di coinvolgimento, non prova di lettura completa | AdvertorialEngaged, personalizzato |
| Clic verso la landing | Attivazione di un pulsante verso la consulenza | Articolo e posizione del pulsante | AdvertorialCTAClick, personalizzato |
| Arrivo sulla landing | Caricamento effettivo della pagina destinazione | Landing, articolo di provenienza e visitatore | PageView con tipo pagina landing |
| Inizio modulo | Primo ingresso in un campo | Modulo iniziato | StartForm, già usato dal progetto |
| Richiesta registrata | Il server ha salvato la richiesta | Richiesta, contatto collegato e provenienza | Lead, usando il percorso esistente |

Il clic e l'arrivo restano due fatti diversi. L'apertura dell'articolo e l'inizio modulo non contano come Lead. Conservare l'attuale ViewContent delle landing; sugli articoli attribuire metadati editoriali corretti ed evitare che il segnale di 3 secondi venga chiamato "lettura completata".

Eventi browser e server per la stessa azione condividono nome ed event ID. Non aggiungere un secondo Lead al flusso esistente. L'ID evento deve rendere innocui anche retry e rimontaggi dei componenti.

### Identità e attribuzione

- Riutilizzare il visitatore del progetto sul medesimo dominio; aggiungere un identificativo di sessione con scadenza dopo 30 minuti di inattività per distinguere le visite.
- Conservare gli eventi del percorso con data, tipo di pagina, articolo, landing, campagna e identificativi tecnici. Non inserire i dati digitati nel modulo nei normali eventi di navigazione.
- Registrare sul server il collegamento fra richiesta accettata e visitatore. Collegare una nuova visita anche a un contatto CRM già esistente, senza creare un doppione o cancellare la provenienza precedente.
- Il parametro `entry` identifica la provenienza dichiarata del link; non prova da solo che sia stata osservata una visita all'articolo. Il report distingue i due casi.
- Attribuzione principale: articolo indicato dal collegamento verso la landing. Per un ritorno diretto senza `entry`, utilizzare l'ultimo articolo effettivamente osservato entro 30 giorni nello stesso browser, indicandolo come attribuzione da visita precedente. Un valore presente ma non valido non deve causare un'attribuzione silenziosa a un altro articolo.
- L'articolo deve essere verificato nell'organizzazione corretta. Non fidarsi di un semplice slug o di un organization ID arbitrario inviato dal client.
- Per chi visita più articoli mostrare la cronologia disponibile. Il conteggio dei lead attribuiti assegna ciascuna richiesta a un solo articolo; gli altri articoli eventualmente visti sono assistenze, separate dal totale principale.
- Il report parte dall'attivazione. Le vecchie richieste con `editorial_entry` possono essere elencate come storico della provenienza, ma non consentono di ricostruire le visite mancanti.

### Report nel gestionale

Nuova scheda Risultati nel Blog, con filtro per data e articolo. Per ciascun articolo:

1. Visitatori unici osservati e visite totali, separati.
2. Visitatori coinvolti secondo la soglia definita.
3. Visitatori che cliccano verso la landing.
4. Visitatori che arrivano effettivamente sulla landing dopo l'articolo.
5. Visitatori che iniziano il modulo.
6. Richieste registrate e contatti CRM unici, separati per non gonfiare i risultati con reinvii.
7. Percentuale articolo → landing e articolo → richiesta, con denominatore esplicito.

Le percentuali del percorso si basano sugli stessi visitatori osservati: una visita all'articolo nel periodo selezionato avvia la coorte; si considerano i passaggi successivi entro 30 giorni, fino alla data corrente. Una coorte recente è indicata come ancora in maturazione. I lead con sola provenienza dichiarata o con visita precedente al periodo compaiono in un conteggio distinto, non nel numeratore della percentuale di quella coorte.

Totali generali deduplicati per visitatore; non sommare semplicemente i visitatori di più articoli. Una persona che legge due articoli può comparire nelle due righe ma una sola volta nel totale generale. Visitatori significa browser osservati, non persone fisiche certe.

Scheda contatto: articolo di provenienza, campagna disponibile, visite e passaggi osservati collegati alla richiesta. Accesso ai dati identificativi limitato ai ruoli già autorizzati al CRM.

### Raccolta e accesso

Introdurre un registro degli eventi editoriali distinto dalle statistiche funnel esistenti, per evitare di trattare `blog_posts.id` come `funnel_id`. Relazioni esplicite per articolo, funnel, richiesta e lead; vincolo univoco per organizzazione ed event ID.

Un endpoint pubblico valida soltanto i passaggi ammessi e risolve pagine e organizzazione sul server. Esclude bot e anteprime; limita frequenza e dimensione dei dati. La registrazione della conversione interna proviene dal server che salva la richiesta, non da un evento Lead arbitrario del browser. Lettura del report attraverso gli stessi controlli di organizzazione e ruolo del gestionale. Nessuna lista di contatti esposta pubblicamente.

La scelta sul tracciamento deve essere condivisa fra articolo e landing, con categorie analisi e marketing distinte; non equiparare l'accettazione Clarity al consenso marketing. Rifiuto o revoca impediscono gli invii pertinenti anche lato server, lasciando utilizzabile il modulo. La richiesta e la sua provenienza diretta rimangono dati operativi della richiesta; in assenza di tracciamento non si inventa una cronologia del visitatore. Testi e informative devono descrivere la configurazione effettivamente attivata.

Errori di analytics non bloccano la navigazione o il modulo. Gestire storage indisponibile, pixel lento o bloccato, navigazione verso la landing prima della risposta e mancata ricezione CAPI. I dati salvati localmente e la ricezione Meta sono esiti distinti, visibili nella diagnostica.

## Verifica prima di dichiarare il risultato operativo

- Articolo nuovo e Pochi minuti: configurazione pixel risolta, visita distinta dalla landing e identità coerente.
- Articolo → clic → landing → invio: percorso attribuito e un solo Lead per azione tra browser e server.
- Doppio clic, refresh e retry: nessuna conversione duplicata; visite e visitatori distinti.
- Due articoli nello stesso browser, visita diretta alla landing e ritorno successivo: applicazione delle regole di attribuzione senza falsi passaggi.
- Lead già esistente: nuova richiesta collegata allo stesso contatto, con il percorso del nuovo browser quando disponibile.
- Storage bloccato, scelta di rifiuto, revoca e caricamento lento del pixel: pagina e form funzionanti, nessun invio contrario alla scelta.
- Anteprime e bot: esclusi; query e identificativi estranei all'organizzazione: respinti.
- Report: coorti coerenti, reinvii distinti dai nuovi contatti, nessuna stima presentata come dato osservato.
- Verifica locale con invii Meta simulati; conferma di ricezione e deduplicazione nell'ambiente di test Meta prima di dichiarare verificata l'integrazione. Nessun lead fittizio nelle automazioni commerciali di produzione.

## Confini del rilascio

Implementazione: tracker degli articoli, collegamento del percorso sulla landing e sulla richiesta, report Blog e provenienza nel CRM, con test e documentazione. Nessuna nuova campagna o spesa pubblicitaria inclusa. I dati preparano eventuali segmenti di remarketing (articolo senza landing; landing senza richiesta; registrati da escludere), la cui configurazione effettiva in Meta va verificata separatamente.

## Fonti e limiti della verifica

Analisi dei file citati e confronto HTML/script pubblici effettuato nella conversazione del 19 settembre 2026. AV Brain è stato consultato per l'ecosistema digitale; non contiene lo stato tecnico aggiornato di questi tracker.

Le pagine ufficiali Meta sulla deduplicazione e sul conversion tracking hanno restituito HTTP 429 durante la ricerca; non sono state usate per dichiarare verificati i dettagli correnti della piattaforma. La convalida tecnica finale richiede documentazione accessibile e verifica in Gestione eventi.

## Articoli futuri

Il template pubblico condiviso applica automaticamente il tracker a ogni articolo pubblicato. Le CTA conservano campagna e `entry=blog-<slug>` e aprono la landing personalizzata dai dati editoriali. Il pixel pubblico viene risolto dalla connessione Meta attiva dell’organizzazione, verificandone la coerenza con la landing. Non occorre aggiungere snippet o nuovi slug nel codice per ogni articolo. Le anteprime restano escluse.
