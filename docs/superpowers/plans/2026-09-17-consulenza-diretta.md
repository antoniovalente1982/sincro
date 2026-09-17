# Ripristino consulenza diretta — piano

**Obiettivo:** applicare la richiesta di Antonio del 17 settembre: sostituire il questionario iniziale con il modulo contatti e «Prenota una consulenza gratuita» sulla landing Salto di Qualità.

**Soluzione:** impostazione `direct_consultation_form` del singolo funnel; modulo classico, CTA esplicita, testo di richiamata, posizione subito sotto il titolo su mobile. Test A/B disattivato, senza dichiarare una vincitrice. Gli altri funnel conservano il comportamento corrente.

**Stack:** Next.js/React, CSS, impostazioni Supabase esistenti.

- [ ] Aggiornare `app/f/[slug]/MetodoSincroLandingV2.tsx`: leggere l'impostazione, selezionare il modulo diretto, riutilizzare la disposizione mobile della B, allineare CTA e testo.
- [ ] Aggiornare `app/f/[slug]/landing-steps.css`: disporre le prove dopo i campi e consentire il testo completo sui pulsanti.
- [ ] Verificare compilazione e resa mobile/desktop; nessun invio di lead fittizi nel sistema commerciale.
- [ ] Pubblicare soltanto i file della modifica; preservare il cambiamento già in staging a `app/api/settings/route.ts`.
- [ ] Salvare le impostazioni precedenti del funnel e aggiornare soltanto `direct_consultation_form`, `ab_test_active`, `ab_variant`, `cta_text` e data di revisione, con controllo di concorrenza.
- [ ] Verificare sulla landing live il modulo diretto e il pulsante completo; registrare data e verifica senza promettere risultati commerciali.
