# Dentro la partita — un solo template advertorial

Decisione di Antonio, 18 settembre 2026: il riferimento approvato è la schermata di `/f/pochi-minuti/anteprima`. Tutte le pagine devono essere advertorial; Blog è la sezione gestionale. Il link pubblico generale deve aprire direttamente un advertorial.

## Implementazione

1. Estrarre la cornice del modello V3 (testata, data, titolo, firma, immagine, autore laterale, footer) e condividerla fra pagina pochi-minuti e pagine `/blog/[slug]`; usare gli stessi CSS e font del riferimento. Conservare l’indicazione Metodo Sincro e la natura commerciale.
2. Rendere i nuovi contenuti pagine advertorial con apertura narrativa, sezioni, CTA intermedia e finale verso il funnel esistente. Anteprima editor uguale alla pagina pubblica. Nessuna nuova architettura del database, nessuna perdita delle bozze.
3. Sostituire l’homepage di rivista con redirect `/blog` verso pochi-minuti quando attivo, altrimenti primo advertorial attivo; preservare i parametri di campagna ammessi. Sitemap solo URL canonici delle pagine, nessun redirect/bozza.
4. Aggiornare il linguaggio del gestionale: Blog / raccolta advertorial, nuovo advertorial, piano advertorial. Il piano contiene 12 brief, non pagine già scritte.
5. Verificare routing, CTA, privacy bozze e template condiviso; build e lint. Confronto browser desktop/mobile con il riferimento scelto.
6. Rilasciare solo questi cambiamenti e la V3 richiesta, preservando la modifica preesistente staged a impostazioni. Verificare i link pubblici e aggiornare STATO/PRODUCT/DESIGN.

## Limiti

Nessuna pubblicazione di nuove bozze né creazione automatica di 12 testi, nessun nuovo dominio o pixel. Il riferimento visuale scelto prevale sulla precedente direzione grafica del Blog. L’indicizzazione non è garantita dalla sola impaginazione.
