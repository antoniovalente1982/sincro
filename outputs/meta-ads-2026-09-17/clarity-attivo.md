# Clarity attivo sulla landing Metodo Sincro

- Progetto: **Metodo Sincro — Landing consulenza** (`yjm4a7mui9`). Creato tramite l'accesso Google già disponibile nell'account di Antonio.
- Landing: https://landing.metodosincro.com/f/salto-di-qualita
- Attivazione: **17 settembre 2026, 09:36:45 Europe/Rome** (07:36:45 UTC).
- Pannello registrazioni verificato: https://clarity.microsoft.com/projects/view/yjm4a7mui9/impressions/trackingCode?date=Last%203%20days
- Codice applicativo già pubblicato, commit `425ca85072ef04fc34af50a1054b86fbda787235`; deployment Vercel verificato riuscito.

## Verifica effettuata

Visita di prova da Chrome con viewport 390×844: nessun overflow orizzontale; nessuno script Clarity prima del consenso. Dopo l'accettazione, caricati il tag del progetto corretto e lo SDK Clarity 0.8.69.

Il pannello Clarity ha mostrato **1 utente online** e la registrazione della landing. Aperto il replay e verificato il clic su “Prenota una consulenza gratuita” al secondo 20. Modulo e sezione delle difficoltà selezionabili sono effettivamente oscurati nel replay.

La visita è un **collaudo**, non un nuovo lead o un risultato della campagna. Nessun modulo è stato inviato. Il browser ha mantenuto lo user agent desktop, quindi Clarity classifica questa sessione come PC anche se il viewport di prova era mobile. La scheda della visita di prova è stata chiusa; il pannello Clarity è rimasto aperto.

Dashboard aggregata, mappe di calore e indicizzazione degli Smart events possono richiedere elaborazione: la schermata di installazione indica fino a 2 ore per la comparsa dei dati. La ricezione della registrazione e del clic è stata verificata direttamente; non è ancora stato verificato un lead completo in Clarity.

L'attivazione ha modificato solo `clarity_project_id`, `clarity_started_at` e il timestamp di aggiornamento del funnel. Le altre impostazioni, incluso il nuovo video VTurb, sono state conservate e confrontate dopo la scrittura. Backup locale `settings-before-clarity-2026-09-17T07-36-45.973Z.json` e rilettura `settings-after-clarity.json` nella stessa cartella.
