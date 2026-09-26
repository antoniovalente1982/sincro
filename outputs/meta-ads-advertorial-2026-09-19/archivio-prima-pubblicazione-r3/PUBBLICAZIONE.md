# Pubblicazione Meta Ads — 19 settembre 2026

**Campagna e nove inserzioni pubblicate e attivate il 19/09/2026 alle 12:03 (Europe/Rome).** La prima rilettura successiva all’attivazione riporta campagna ACTIVE, gruppo ACTIVE, nove annunci con status ACTIVE ed effective_status IN_PROCESS. Non equivale a nove annunci già in erogazione. Vedi la [ricevuta](PUBLICATION_RECEIPT.json) e [apri Gestione inserzioni](https://adsmanager.facebook.com/adsmanager/manage/ads?act=511099830249139&business_id=1224962114308041&selected_campaign_ids=120251780591420047&selected_adset_ids=120251780591590047).

## Impostazioni effettive

- Campagna: `120251780591420047` — MS | LEAD WEB | IT 38+ | 3 Advertorial | Test 01.
- Gruppo: `120251780591590047` — un solo gruppo, nove annunci, tre per advertorial.
- Obiettivo Contatti; conversione sul sito; ottimizzazione Lead sul pixel `311586900940615`.
- Italia intera, minimo 38 come controllo, massimo 65+; italiano, tutti i generi. Segnali genitori 13–17 e 18–26; la qualifica di genitore non è garantita dal targeting Meta.
- Facebook Feed e Instagram Feed, con identità Antonio Valente e `antoniovalente_mentalcoach`. Il primo lancio usa i posizionamenti dei master disponibili; Stories e Reels non inclusi.
- Budget medio **100 €/giorno complessivi**, con possibili picchi di 175 €/giorno e riferimento settimanale di 700 €. La precisazione di Antonio autorizza erogazione continuativa. [Ultima ricevuta API prima/dopo](CONTINUOUS_UPDATE_2026-09-19.json): budget salvato 10000 centesimi, campagna e nove annunci ACTIVE al controllo delle 12:32 Europe/Rome. Le ricevute precedenti conservano le impostazioni storiche superate.
- **Nessuna data di fine e nessun limite cumulativo di campagna**: rimossi e pubblicati il 19 settembre su richiesta di Antonio. La campagna prosegue al budget medio concordato fino a una successiva modifica o pausa; non occorre rinnovarla ogni cinque giorni.
- Esclusione pubblico Lead degli ultimi 30 giorni, pixel coerente. Meta lo dichiara utilizzabile ma non aggiornato per inattività: non si presume copertura immediata di tutti i registrati.
- La precedente campagna del 16 settembre resta PAUSED. Nessuna vecchia campagna riattivata.

## Ricezione e attribuzione

I tre percorsi sono stati seguiti nel browser: il pulsante conserva UTM e ID annuncio e apre la landing con `entry` e titolo coerenti. Verificati anche 18 caricamenti HTTP usando nomi finali delle inserzioni e ID Meta. I nomi con `T:` non sostituiscono la personalizzazione dell’articolo.

L’evento Lead isolato con `test_event_code` è stato accettato dalla CAPI ed è visibile in Testa gli eventi. Nessun contatto fittizio è stato inserito nel CRM e nessuna notifica commerciale è stata inviata. La raccolta live di articolo, CTA, arrivo landing e avvio modulo è registrata; le risposte server Meta indicano `events_received: 1`.

Gli eventi browser e server osservati condividono nome e ID: verificato il criterio di deduplicazione. Il tasso aggregato effettivo e il primo Lead reale del nuovo percorso restano da osservare con dati di produzione; non viene dichiarata una prova live del salvataggio di un nuovo contatto. Salvataggio, retry e ID Lead sono coperti dai test del rilascio già documentati.

## Creatività

Nove immagini, nove testi, nove nomi distinti. Riletti dall’API: file/hash, copy completo, titoli, descrizioni, destinazioni, UTM, identità e pixel coincidono con il pacchetto preparato. Nessuna funzione creativa risulta OPT_IN. Generate 18 anteprime Meta; controllo visivo rappresentativo di foto e grafiche su Facebook/Instagram, senza tagli ai titoli osservati. Le nove immagini originali erano già state controllate visivamente.

## Controlli successivi

Valutare pubblicazione effettiva, richieste valide nel gestionale e qualità commerciale prima di cambiare budget. La prima query Insights non restituisce ancora righe: nessun CPL o risultato può essere calcolato. La soglia diagnostica proposta di 100 € senza lead richiede un controllo successivo: non è stata configurata come regola automatica. Sono salvati il budget medio di 100 €/giorno e la programmazione continuativa, senza limite cumulativo di campagna né data di fine.

## Annunci

| Variante | ID Meta |
| --- | --- |
| A01-V1 | `120251780634110047` |
| A01-V2 | `120251780635230047` |
| A01-V3 | `120251780635790047` |
| A02-V1 | `120251780637630047` |
| A02-V2 | `120251780638310047` |
| A02-V3 | `120251780638860047` |
| A03-V1 | `120251780639490047` |
| A03-V2 | `120251780640320047` |
| A03-V3 | `120251780641200047` |

[Verifica pre-lancio](LAUNCH_VERIFICATION.json) · [Ricevuta pubblicazione](PUBLICATION_RECEIPT.json) · [Anteprime Meta](META_PREVIEWS.json) · [Test Lead CAPI](LEAD_CAPI_TEST.json) · [Galleria locale](GALLERIA.html)
