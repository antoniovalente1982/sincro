# Video prima del modulo su mobile

Richiesta di Antonio, 17 settembre 2026: mostrare il video prima del modulo anche da telefono.

Ordine della landing con messaggio “Aiutalo a fare il salto di categoria”: titolo e sottotitolo → pulsante “Prenota una consulenza gratuita” → video → modulo → autore e prove sociali. Il pulsante iniziale porta direttamente al modulo e la visione del video è facoltativa.

Su desktop il modulo resta a destra, il video sotto il testo a sinistra. Viene renderizzato un solo iframe VTurb. Modifica limitata al tema `salto_categoria` con consulenza diretta e video configurato; gli altri funnel mantengono l’ordine precedente.

Commit layout: `5b9b30fd`. Correzione del salto diretto: `aaf2ea1b`. Entrambe le compilazioni di produzione e TypeScript completate con successo; diff verificati. La modifica preesistente di `app/api/settings/route.ts` è rimasta fuori dai commit.

Pubblicazione finale confermata dal controllo Vercel su GitHub alle 08:15:32, ora di Roma, stato success / Deployment has completed.

Verifica sulla landing pubblica: a 390 px il video precede il modulo (video da y=332 a y=530, modulo da y=550); a 320 px video, modulo e pulsante rientrano nella larghezza disponibile. A 1440 px il modulo resta nella colonna destra e il video nella sinistra. Un solo iframe presente. Clic diretto nel browser sul pulsante iniziale: modulo portato a y=57 e primo campo a y=169, con pulsante di invio visibile. Visione del video facoltativa; nessun invio di contatti effettuato. Dimensioni di prova ripristinate al termine.

La scelta è un’ipotesi di percorso: il video dà più contesto prima della richiesta dei contatti, mentre il pulsante permette di prenotare subito. Non ci sono ancora dati che dimostrino un miglioramento del tasso di conversione dopo questa modifica. Riferimento consultato: [Wistia, video nelle landing page](https://wistia.com/blog/how-to-use-video-on-landing-pages); i dati di altre pagine non provano un effetto su questa campagna.

Annunci, budget e testi dell’offerta non sono stati modificati in questo intervento. La data di attivazione del tema nei settings rimane quella del precedente allineamento; questa revisione del layout è identificata dal commit e da questo registro.
