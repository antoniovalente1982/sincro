# Ripristino richiesta consulenza — 17 settembre 2026

Richiesta di Antonio: rendere nuovamente esplicita la prenotazione della consulenza gratuita, sostituendo il questionario iniziale.

Modifica attivata sul funnel `salto-di-qualita` alle **07:29:33 italiane**:

- Modulo diretto con nome e cognome, telefono, email ed età facoltativa.
- Titolo e pulsanti: **Prenota una consulenza gratuita**.
- Spiegazione: **Lascia i tuoi contatti: ti richiamiamo noi.**
- Modulo prima del video su mobile, sulla destra su desktop.
- Test A/B disattivato, variante fissa A; nessuna proclamazione di vincitrice statistica.
- Impostazione limitata al singolo funnel, altri funnel invariati.

Pubblicazione GitHub/Vercel: commit `45a7a651`, con adattamento schermi piccoli `9723b834`. Compilazione di produzione e TypeScript superati. La scheda pubblica precedentemente in variante B è stata ricaricata e mostra il modulo diretto. Verificata visivamente la CTA nella prima schermata a 390×844 e il modulo a destra su desktop. Non sono stati inviati lead fittizi: la verifica non certifica l'intera catena di invio, CRM e notifiche.

Verificato anche il layout a 320 pixel dopo l'ultimo deploy: griglia e modulo di 282 pixel entro lo spazio disponibile, senza tagli laterali della scheda. Ripristinata la visualizzazione desktop alla fine del controllo.

Impostazioni precedenti e successive conservate nei file `settings-before-direct-consultation.json` e `settings-after-direct-consultation.json`. La data di revisione è registrata anche nelle impostazioni del funnel per distinguere il periodo successivo alla modifica.

Annunci e budget non modificati. Il ripristino rende esplicita l'azione, ma non dimostra da solo la causa dei lead mancanti né garantisce un aumento delle conversioni.
