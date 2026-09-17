# Analisi comportamento — landing Metodo Sincro

Microsoft Clarity è configurabile per funnel nel gestionale: **Funnel → Modifica → Microsoft Clarity**. Inserire l'ID del progetto, senza script. La scheda Analytics del funnel mostra poi il collegamento a registrazioni e mappe di calore. Svuotare il campo disattiva il recorder nelle nuove visite.

L'integrazione riguarda il template `metodo_sincro`, da abilitare su landing rivolte a genitori maggiorenni. Le anteprime `?ab=A` e `?ab=B` non attivano Clarity. Nessun progetto è preimpostato nel codice: senza ID valido non viene caricato alcuno script e non viene mostrato il banner.

## Cosa guardare

Filtrare prima la landing `/f/salto-di-qualita`, il dispositivo Mobile e le date successive all'attivazione. In Clarity usare gli Smart events per costruire il percorso `form_visible → form_started → form_submit_started → form_submit_success` e aprire le registrazioni dei visitatori che si fermano tra due passaggi.

| Eventi | Cosa indicano |
| --- | --- |
| `consultation_cta_clicked` | Clic su un invito a raggiungere il modulo |
| `video_visible` | Video entrato nello schermo; non equivale a riproduzione |
| `form_visible` | Almeno il 15% del contenitore del modulo è visibile |
| `form_started` | Primo focus su nome, telefono o email |
| `form_name_focused`, `form_phone_focused`, `form_email_focused` | Campo raggiunto, senza contenuto |
| `form_submit_attempt` | Clic sul pulsante di invio, prima della validazione |
| `form_invalid_name`, `form_invalid_phone`, `form_invalid_email` | Campo che blocca l'invio, senza valore |
| `form_submit_started` | Validazione superata; inizio tentativo di invio |
| `form_submit_success` | Il server ha risposto con esito HTTP positivo |
| `form_submit_error` | Errore durante l'invio; nessun messaggio del server trasmesso a Clarity |
| `scroll_25`, `scroll_50`, `scroll_75`, `scroll_90` | Percentuale di pagina raggiunta dal bordo inferiore dello schermo |

Gli eventi di visibilità, scroll e focus sono emessi una volta per montaggio della pagina. Clic e tentativi di invio vengono contati ogni volta. Non viene inviato un evento “abbandono”: si individuano sessioni con un passaggio iniziato e senza il successivo.

## Consenso e limiti

- Lo script viene inserito solo dopo l'accettazione dell'analisi Clarity. Consenso analitico concesso, consenso pubblicitario Clarity negato (`consentv2`).
- La scelta, datata e distinta per progetto, viene ricordata per 180 giorni. “Preferenze analisi delle visite” nel fondo della pagina consente di cambiarla. La revoca nega il consenso e arresta il recorder, senza ricaricare il modulo. La scelta si propaga alle altre schede dello stesso sito.
- L'intero modulo e il contenuto della conferma hanno `data-clarity-mask="true"`. Non vengono inviati nomi, contatti, età, risposte, identificativi CRM o messaggi d'errore come eventi o identificatori Clarity.
- Questo controllo riguarda Clarity. Non sostituisce la gestione degli strumenti Meta/VTurb già esistenti né un'informativa completa su tutti i trattamenti del sito.
- Chi rifiuta, usa un blocco del tracciamento o visita prima dell'attivazione non sarà rappresentato nelle registrazioni. I conteggi Clarity non coincidono quindi con tutte le visite del CRM.
- Il player VTurb è in un iframe di un altro dominio. Per avvii e ritenzione del video usare VTurb: Clarity misura la visibilità del riquadro, non il momento guardato.
- Un errore del recorder non deve bloccare una richiesta di consulenza. Nessun evento diagnostico viene inviato alla CAPI Meta.

## Verifica

`node --import tsx --test lib/landing-behavior.test.ts` controlla ID, scadenza, blocco prima del consenso e in anteprima, whitelist eventi, revoca e riattivazione senza duplicare lo script. `npm run build` verifica compilazione e TypeScript.

Prova manuale locale con SDK simulato a 320×740: banner senza overflow, pulsanti di 44 px, nessun caricamento prima dell'accettazione; focus e tentativo di invio emettono solo nomi di eventi; dopo revoca un nuovo clic non emette eventi. La verifica con registrazioni reali nel progetto Clarity va completata dopo aver collegato un ID effettivo.

Fonti Microsoft: [API](https://learn.microsoft.com/en-us/clarity/setup-and-installation/clarity-api), [consenso V2](https://learn.microsoft.com/en-us/clarity/setup-and-installation/clarity-consent-api-v2), [mascheramento](https://learn.microsoft.com/en-us/clarity/setup-and-installation/clarity-masking), [avvio e arresto SDK](https://github.com/microsoft/clarity/blob/master/packages/clarity-js/src/clarity.ts).
