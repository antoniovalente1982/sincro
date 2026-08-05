# Brief operativo — completare il lancio del 24 agosto 2026 su ActiveCampaign

**Destinatario:** agente con accesso ad ActiveCampaign (MCP o REST API v3).
**Redatto:** 4 agosto 2026. Ogni dato qui è stato verificato con chiamate reali, non ipotizzato.
**Aggiornato:** 4 agosto 2026, ore 17 — dopo un TEST DI INVIO REALE che ribalta la procedura email (vedi §0-bis).
**Repo di riferimento:** `/Users/antoniovalente/Desktop/sincro`

---

## ⚠️⚠️ NOTE OPERATIVE CRITICHE — strategia community e giorno del webinar (agg. 5/8)

**Decisione del 5/8 (Antonio): link Zoom e replay NON stanno in nessuna email. Vivono SOLO nel gruppo WhatsApp** → `https://chat.whatsapp.com/K3ofUeUjEuOGCXk6yD1BBI`. Tutte le email R e P sono già state riscritte di conseguenza (bottoni → gruppo). Obiettivo: chiunque si registra deve entrare subito nella community.

**Il funnel si regge su TRE MESSAGGI MANUALI di Antonio nel gruppo WhatsApp. Se saltano, i registrati restano senza link:**

1. **Domenica 23 agosto, sera** → mandare il link Zoom nel gruppo (R1/R2 lo promettono)
2. **Lunedì 24 agosto, ore 20:45** → rimandare il link Zoom nel gruppo (R3/R4 dicono "è appena arrivato lì")
3. **Martedì 25 agosto** → mandare il replay nel gruppo (P2/P4 dicono "la registrazione è nel gruppo"; P2 promette che sparisce giovedì sera, P4 "stasera a mezzanotte" — rispettare quelle scadenze)

In più: R1 promette 3 messaggi di valore nel gruppo prima del webinar (mercoledì, venerdì, domenica sera).

**I tre link — ruoli distinti, non confonderli:**

| Link | Ruolo | Dove sta |
|---|---|---|
| `https://landing.metodosincro.com/webinar-agosto/#register` | **Registrazione al webinar** — genera il tag `lancio26-registrato` (via gestionale) | Email W1–W4. NON toccare, resta attivo |
| `https://chat.whatsapp.com/K3ofUeUjEuOGCXk6yD1BBI` | Community iscritti | Email R1, R1bis, R2, R3, R4, P2, P4 |
| Link Zoom + replay | Accesso diretta / registrazione | SOLO messaggi manuali nel gruppo WhatsApp |

**Placeholder nelle email: NESSUNO.** `[LINK PAGINA CANDIDATURA]` sostituito il 5/8 con `https://landing.metodosincro.com/candidatura` in tutte e 8 le campagne P (verificato via get_campaign_links). B1/B2 puntano a `/resto` (live) e a `%UNSUBSCRIBELINK%`.

**Stato build (5/8 pomeriggio) — TUTTE E 6 LE AUTOMAZIONI ATTIVE (status 1 verificato via API):**

- **6 · Lancio26 - Risveglio Caldi e Tiepidi** (rinominata): trigger caldo OR tiepido → A1 → attendi 1g → attendi fino 9AM (fuso contatto) → A2 → attendi 3g → A3 → attendi 1g → If "ha aperto qualsiasi email negli ultimi 30 giorni" → SÌ: tag engaged+invitabile · NO: tag sospeso. La coda mancante è stata AGGIUNTA il 5/8: è quella che innesca la W.
- **7 · A1 - Risveglio Freddi**: trigger freddo → B1 ("Tuo figlio gioca ancora?") → 4g → B2 ("Chiudo") → attendi 1g → If "ha cliccato un link (30gg)" → SÌ: tag riattivato+invitabile · NO: tag sospeso. Coda aggiunta il 5/8. Divergenza minore accettata: B2 arriva anche a chi ha aperto (ma non cliccato) B1 — il filtro "solo se non ha aperto" non è stato inserito per non rischiare la catena; impatto: copy leggermente incoerente per gli apritori-non-cliccatori.
- **8 W-Invito · 9 R-Promemoria (camp. 23/25/27/29/31) · 10 P-Presenti (33/35/37/39) · 11 P-Assenti (41/43/45/49)**: invariate, attivate il 5/8.

Orfani innocui: camp. 14 e 47 (bozze da copie fallite, non collegate a blocchi sul canvas).

**Segmentazione → LOTTI NEUTRI (decisione 5/8).** L'account non ha mai inviato → i filtri "ha aperto/cliccato" di §4 restituiscono zero: caldi/tiepidi per engagement NON esistono. Si usa la rampa con lotti neutri in ordine di lista: `scripts/lancio_prepara_lotti.py` (committato) crea e applica i tag `lancio26-lotto2`…`lotto6` (1000/2000/2000/2500/resto), escludendo i 500 del lotto1. Eseguirlo dal Mac (`export $(grep -E '^ACTIVECAMPAIGN' .env.local | xargs) && python3 scripts/lancio_prepara_lotti.py`, ~30-40 min, riprendibile). Ogni sera: Contatti → cerca tag lottoN → seleziona tutti → aggiungi tag `lancio26-caldo` (il grilletto). La sera 6 (freddi) usa invece il tag `lancio26-freddo` → flusso B.

**Restano SOLO azioni di Antonio:** 1) piano a pagamento (bloccante), 2) messaggio al supporto AC (testo pronto), 3) stasera tag caldo ai 500 del lotto1, 4) test di invio delle email su telefono, 5) i tag serali della rampa con regola di stop (>30% procedi · 15-30% dimezza · <15% fermati), 6) i messaggi manuali WhatsApp da calendario.

---

## 0-bis. ⚠️ CORREZIONE DEFINITIVA sulla scrittura delle email — provata con invio reale

Il §0 qui sotto affermava che l'HTML si scrive via `PUT /messages/{id}` e che quindi "non va ricostruito nell'editor". **La scrittura via API funziona davvero (write + rilettura ok), MA NON È QUELLO CHE PARTE.** Test di invio reale del 4/8 ore 16:40 su msg 18 (campo html corretto e verificato via API): l'email è arrivata in casella col **template di default** ("Progetta qui la tua email!"). Conclusione, valida per tutte le email create con l'editor visuale (ed_version 3):

- **L'invio rigenera il corpo dai BLOCCHI dell'editor visuale**, non dal campo `html` del messaggio. Il campo `html` scritto via API è un binario morto: leggibile, riscrivibile, ignorato dal sender.
- Inoltre, ogni "Salva ed esci" dall'editor **sovrascrive** il campo `html` col contenuto dei blocchi (è quello che ha resettato msg 19 la mattina del 4/8).
- Oggetto e preheader invece arrivano dal record messaggio e si impostano correttamente via API — quelli restano pilotabili.

**PROCEDURA CORRETTA per il corpo (unica che funziona):** nell'editor visuale, eliminare tutti i blocchi di default, trascinare un unico elemento **HTML** (`<>`, pannello Elementi) e incollarci il frammento pronto. I 19 frammenti già pronti per l'incolla (senza doctype/head, solo body) sono in **`docs/lancio-agosto-2026/email-html-editor/*.html`** — un file per chiave (A1…P5). Un minuto a email. Dopo l'incolla: test di invio a sé stessi, sempre.

Nota: il footer di ActiveCampaign (indirizzo Sincro Group + disiscrizione) viene aggiunto in coda automaticamente — verificato nel test. Se dopo l'incolla il footer risulta doppio, togliere quello del frammento.

`scripts/ac_write_emails.py --write` resta utile SOLO per oggetto e preheader; `scripts/ac_inspect.py` resta valido per mappare automazioni → slot → messageid e trovare i corpi ancora al template.

---

## 0. Leggi prima questo, o perdi due ore

Ci sono tre affermazioni che girano nei documenti precedenti e che sono **false**. Sono state testate.

**❌→⚠️ "L'HTML delle email non si può scrivere via API."** [SUPERATO — vedi §0-bis: la scrittura funziona ma il sender la ignora; il corpo va incollato nell'editor come elemento HTML.]
`PUT /api/3/messages/{id}` con `{"message": {"html": "...", "subject": "...", "preheader_text": "..."}}` funziona: scrittura verificata con rilettura. La sessione che ha diffuso questo errore usava `campaign/message`, che aggiorna solo i metadati e **ignora il campo `html` restituendo comunque HTTP 200**. Se usi l'endpoint sbagliato non ricevi nessun errore, semplicemente non succede niente. Usa `messages` — ma solo per oggetto/preheader, per il corpo vedi §0-bis.

**❌ "Il webinar è a settembre."** Falso. È **lunedì 24 agosto 2026, ore 21:00**, su Zoom. La lista in ActiveCampaign si chiamava "Registrati Webinar - Settembre 2026" ed è già stata rinominata.

**❌ "Esiste un prodotto d'ingresso a 197€."** Falso, ritirato. Vedi §6.

E una che invece è **vera e confermata**:

**✅ Le automazioni NON si creano via API.** `POST /api/3/automations` risponde **405 Method Not Allowed**. Non esiste workaround. Lo scheletro di ogni automazione va costruito a mano nell'editor visuale. Tutto il resto (messaggi, tag, liste, contatti) è pilotabile via API.

**Regola di lavoro:** dopo ogni scrittura, rileggi e verifica il contenuto. Non fidarti dell'HTTP 200 — su questo account restituisce 200 anche quando ignora quello che hai scritto.

---

## 1. Stato verificato dell'account

Account `valenteantonio17118` · base URL `https://valenteantonio17118.api-us1.com/api/3`

⚠️ **L'account è in trial con pochi giorni residui.** A 12.440 contatti non si invia niente finché non si passa al piano a pagamento. Verificare prima di qualunque attivazione.

### Liste
| id | nome | contatti |
|---|---|---|
| 5 | Lista Importata 30/07/2026 | 12.440 |
| 6 | Lancio26 - Aperti | 0 |
| 7 | Lancio26 - Cliccati | 0 |
| 8 | Lancio26 - Dormienti | 0 |
| 9 | Registrati Webinar - 24 Agosto 2026 | 0 |

### Tag
| id | tag | contatti |
|---|---|---|
| 169 | `lancio26-caldo` | 0 |
| 170 | `lancio26-tiepido` | 0 |
| 171 | `lancio26-freddo` | 0 |
| 172 | `lancio26-riattivato` | 0 |
| 173 | `lancio26-sospeso` | 0 |
| 174 | `lancio26-engaged` | 0 |
| 175 | `lancio26-invitabile` | 0 |
| 176 | `lancio26-registrato` | 0 |
| 177 | `lancio26-presente` | 0 |
| 178 | `lancio26-assente` | 0 |
| 179 | `lancio26-replay-visto` | 0 |
| 180 | `lancio26-cliente` | 0 |
| 181 | `lancio26-no-acquisto` | 0 |
| 182 | `lancio26-lotto1` | 500 |
| 183 | `eng-aperto` | 0 |
| 184 | `eng-click` | 0 |

**Nessun contatto è mai stato segmentato.** I tag caldo/tiepido/freddo sono tutti a zero: la segmentazione va ancora fatta (§4).

### Automazioni
| id | nome | stato | contatti entrati |
|---|---|---|---|
| 3 | Lancio26: ha aperto | attiva | 0 |
| 4 | Lancio26: ha cliccato | attiva | 0 |
| 5 | Lancio26: dormienti | attiva | 0 |
| 6 | Lancio26 – Sequenza riscaldamento | **inattiva** | 0 |

Le automazioni 3, 4, 5 non contengono email: applicano tag e iscrivono a liste in base a aperture e click. Lasciarle come sono, tornano utili per misurare la riattivazione.

**Nessuna email è mai stata inviata da questo account.**

### Messaggi email
| msg | campagna | contenuto | stato |
|---|---|---|---|
| 18 | 6 | Email A1 — "Tuo figlio ci sta già pensando" | ⚠️ html via API ok ma IGNORATO dal sender — serve incolla nell'editor (§0-bis) |
| 19 | 8 | Email A2 — "«Stai tranquillo» è la frase che gli fa più male" | ⚠️ idem — riscritta via API il 4/8 pomeriggio, ma vale solo per oggetto/preheader |
| 20 | 10 | Email A3 — "1.100 ragazzi. Nessuno di loro era «quello dotato»." | ⚠️ idem |
| 5, 6, 7 | — | orfani: oggetto nuovo innestato su corpo vecchio, non collegati a nulla | ⚠️ ignorare o eliminare |

---

## 2. Da dove arriva il copy

Tutte e 19 le email esistono già, scritte e impaginate, in:

**`scripts/ac_write_emails.py`** (nel repo)

```bash
export $(grep -E '^ACTIVECAMPAIGN' .env.local | xargs)

python3 scripts/ac_write_emails.py --list          # elenca le 19 email
python3 scripts/ac_write_emails.py --export out/   # esporta gli HTML
python3 scripts/ac_write_emails.py --write W1=31 W2=33   # scrive e verifica
```

Chiavi disponibili: `A1 A2 A3 B1 B2 W1 W2 W3 W4 R1 R1bis R2 R3 R4 P1 P2 P3 P4 P5`

Il template è già email-safe: tabelle, stili inline, preheader nascosto, `%SENDER-INFO-SINGLELINE%` e `%UNSUBSCRIBELINK%` nel footer. ~~Non ricostruire le email a blocchi nell'editor. Crea lo scheletro e poi scrivi il contenuto via API.~~ **[SUPERATO dal test di invio del 4/8 — vedi §0-bis: il corpo va incollato nell'editor come elemento HTML, dai frammenti in `email-html-editor/`; `--write` serve solo per oggetto e preheader.]**

Se non hai accesso al repo, gli HTML sono anche in `docs/lancio-agosto-2026/email-html/*.html`, e il copy sorgente con il razionale in `docs/lancio-agosto-2026/sequenza-email-completa.md`.

### Come trovare l'id del messaggio di uno slot appena creato

Dopo aver aggiunto un blocco "Invia email" in un'automazione, la catena per risalire al messaggio è:

```
GET /automations/{automation_id}/blocks
    → per ogni blocco con type="send": params.campaignid
GET /campaigns/{campaignid}/campaignMessage
    → campaignMessage.messageid
PUT /messages/{messageid}
    → {"message": {"subject": "...", "preheader_text": "...", "html": "..."}}
GET /messages/{messageid}
    → rileggi e verifica che il corpo sia cambiato
```

Attenzione: la risposta di `/blocks` ha la chiave **`automationBlocks`**, non `blocks`.

---

## 3. Le automazioni da costruire

### 3.1 — Sistemare «Sequenza riscaldamento» (automazione 6) — *le email ci sono già*

Rinominare in **`A2 · Risveglio Caldi e Tiepidi`**, poi:

1. **Trigger** — ora è basato sull'iscrizione a una lista, è sbagliato. Sostituire con:
   - Trigger 1: *Il tag viene aggiunto* → `lancio26-caldo` · esegui una volta · contatti esistenti e nuovi
   - Trigger 2 (aggiungere): *Il tag viene aggiunto* → `lancio26-tiepido` · stesse impostazioni

   Due trigger sulla stessa automazione = OR. Corretto così.

2. **Seconda attesa** — è a 2 giorni, portarla a **3 giorni** (serve a far cadere la terza email di lunedì)

3. **Aggiungere in fondo**, dopo l'ultima email: attesa **1 giorno**, poi condizione *Se/Altrimenti* → "ha aperto una qualsiasi delle 3 email"
   - ramo SÌ → aggiungi tag `lancio26-engaged` (174) **e** `lancio26-invitabile` (175)
   - ramo NO → aggiungi tag `lancio26-sospeso` (173)

4. Su ogni blocco "Attendi": impostare la finestra oraria **9:00–10:00**

5. **Non attivare ancora** — prima §4 e §7

Struttura finale:
```
[tag lancio26-caldo O lancio26-tiepido aggiunto]
  → 📧 A1 (msg 18, già scritta)
  → attendi 2 giorni (9:00-10:00)
  → 📧 A2 (msg 19, già scritta)
  → attendi 3 giorni (9:00-10:00)
  → 📧 A3 (msg 20, già scritta)
  → attendi 1 giorno
  → SE ha aperto → tag 174 + 175 · ALTRIMENTI → tag 173
```

---

### 3.2 — «A1 · Risveglio Freddi» — *nuova, 2 email*

Il modo più veloce è **duplicare** l'automazione 6 già sistemata (menu tre puntini → Duplica), poi modificare.

```
[tag lancio26-freddo (171) aggiunto]
  → 📧 B1  ← scrivere con --write B1=<msgid>
  → attendi 4 giorni
  → 📧 B2  ← scrivere con --write B2=<msgid>   [solo se non ha aperto né cliccato B1]
  → SE ha cliccato un link in B1 o B2 → tag 172 + 175 · ALTRIMENTI → tag 173
```

⚠️ B1 e B2 contengono i segnaposto `[LINK PAGINA SI]` e `[LINK PAGINA NO]`: sono due pagine di conferma **non ancora costruite**. Non attivare questa automazione finché non esistono e i link non sono stati sostituiti.

---

### 3.3 — «W · Invito Webinar» — *nuova, 4 email*

```
[tag lancio26-invitabile (175) aggiunto]
  → esci se ha il tag lancio26-registrato (176)     ← mettere in cima
  → 📧 W1   ← --write W1=<msgid>
  → attendi fino al 20 agosto, ore 9:00
  → 📧 W2
  → attendi fino al 22 agosto, ore 10:00
  → 📧 W3
  → attendi fino al 24 agosto, ore 9:00
  → 📧 W4
```

Il blocco "esci se ha il tag registrato" è essenziale: chi si è già iscritto non deve continuare a ricevere inviti a iscriversi.

---

### 3.4 — «R · Promemoria Registrati» — *nuova, 5 email · la più importante*

Questa parte da sola, senza intervento umano: il tag `lancio26-registrato` viene applicato automaticamente dal gestionale quando qualcuno si registra sulla landing (vedi §5).

```
[tag lancio26-registrato (176) aggiunto]
  → 📧 R1  (subito, nessuna attesa)   ← --write R1=<msgid>
  → attendi 1 giorno                              ← RELATIVA
  → SE ha cliccato il link del gruppo WhatsApp in R1
        → SÌ: salta
        → NO: 📧 R1bis                ← --write R1bis=<msgid>
  → attendi fino al 23 agosto, ore 20:00          ← FISSA
  → 📧 R2
  → attendi fino al 24 agosto, ore 18:00          ← FISSA
  → 📧 R3
  → attendi fino al 24 agosto, ore 20:45          ← FISSA
  → 📧 R4
```

**Attenzione al mix di attese.** La prima è relativa (1 giorno dalla registrazione), le altre tre sono a data fissa perché il webinar è un evento a data fissa e tutti devono ricevere il promemoria nello stesso momento. Sbagliare questo significa mandare "siamo live tra 15 minuti" a chi si è iscritto tre giorni dopo l'evento.

---

### 3.5 — Post-webinar — *due automazioni gemelle, 5 email in comune*

Il 25 agosto si taggano a mano i partecipanti: esportare l'elenco presenti da Zoom, importarlo applicando `lancio26-presente` (177); a tutti gli altri registrati applicare `lancio26-assente` (178).

```
[tag lancio26-presente]                    [tag lancio26-assente]
  → esci se ha tag lancio26-cliente (180)    → esci se ha tag lancio26-cliente (180)
  → 📧 P1                                     → 📧 P2
  → attendi 2 giorni                          → attendi 1 giorno
  → 📧 P3                                     → 📧 P3
  → attendi 1 giorno                          → attendi 1 giorno
  → 📧 P4                                     → 📧 P4
  → attendi 1 giorno                          → attendi 1 giorno
  → 📧 P5                                     → 📧 P5
```

Il blocco di uscita su `lancio26-cliente` non è opzionale: continuare a mandare email di vendita a chi ha appena comprato è il modo più veloce per perderlo.

---

## 4. Segmentazione — da fare prima di attivare qualsiasi cosa

I tag di segmento sono a zero. I CSV citati nei vecchi documenti non esistono più. Si rifà dentro ActiveCampaign, senza import.

**Contatti → Cerca → Ricerca avanzata**, poi selezionare tutti i risultati → *Aggiungi tag*. **Rispettare questo ordine**, perché ogni segmento esclude i precedenti:

**1. CALDI → `lancio26-caldo` (169)**
```
Lista = Lista Importata 30/07/2026
E ( Ha cliccato un link in qualsiasi campagna
    OPPURE Ha aperto una campagna negli ultimi 90 giorni )
```

**2. TIEPIDI → `lancio26-tiepido` (170)**
```
Lista = Lista Importata 30/07/2026
E Tag ≠ lancio26-caldo
E Ha aperto una campagna negli ultimi 180 giorni
```

**3. FREDDI → `lancio26-freddo` (171)**
```
Lista = Lista Importata 30/07/2026
E Tag ≠ lancio26-caldo
E Tag ≠ lancio26-tiepido
```

⚠️ **Se l'account non ha storico di aperture** — probabile, visto che non ha mai inviato niente — i filtri "ha aperto" restituiranno zero e finirà tutto in FREDDI. In quel caso: non forzare una segmentazione inesistente, trattare l'intera lista come freddi e usare il Flusso B per tutti.

**Il tag è il grilletto.** Applicarlo mentre l'automazione è attiva fa partire l'invio immediatamente. Applicare i tag **solo** dopo aver completato §7.

---

## 5. Cosa gira già da solo — non toccare

Il gestionale (Next.js, repo `sincro`) è già collegato. Quando qualcuno si registra sulla landing del webinar:

1. `POST /api/submit` salva il lead su Supabase e lo mette in pipeline
2. Chiama ActiveCampaign: `contact/sync` → `contactLists` (lista **9**) → `contactTags` (tag **176**)
3. Il tag 176 fa partire l'automazione R (§3.4)
4. Arriva una notifica Telegram ad Antonio con nome, email, telefono, data evento ed esito del sync

Codice: `lib/activecampaign.ts` e `app/api/submit/route.ts`. Funnel Supabase `71c333c3-faf1-4b15-9ede-6e5314bc3e0d`, con `settings.activecampaign = {list_id: 9, tag_id: 176}`.

⚠️ **Non è ancora in produzione.** Il codice è committato ma non pushato, e su Vercel mancano le variabili `ACTIVECAMPAIGN_API_KEY` e `ACTIVECAMPAIGN_BASE_URL`. Finché non ci sono, le registrazioni non arrivano in ActiveCampaign.

---

## 6. Vincoli di contenuto — non negoziabili

**⛔️ Nessun prezzo, da nessuna parte.** Non nelle email, non nelle landing, non nei documenti. I prezzi li comunicano solo i venditori in call. Non esiste alcun prodotto d'ingresso a basso prezzo: quello da 197€ è stato ritirato e ricompare per errore in materiale generato da sessioni vecchie.

Catalogo (solo nomi e durate): **Platinum** 3 mesi con coach specializzato · **Best Season** 12 mesi con i coach del team · **Sincro Circle** annuale seguito da Antonio, **solo 10 posti**.

L'unico numero usabile in copy sono i **10 posti di Sincro Circle**, perché è un limite di capienza e non un prezzo.

**CTA di ogni materiale: "candidati a una call gratuita".** Mai "compra".

Altri vincoli:
- Mittente `info@valenteantonio.it` (dominio autenticato SPF/DKIM/DMARC). **Non** usare `metodosincro.it`: non è autenticato.
- Non usare `%FIRSTNAME%` nel corpo senza valore predefinito: metà della lista importata non ha il nome, e leggerebbe "Ciao ,". Le email attuali usano "Ciao," senza nome, deliberatamente.
- Target: genitori di calciatori dai 10 ai 20 anni, non solo bambini. Niente immagini o linguaggio che suggerisca solo l'età infantile.
- Nessuna statistica inventata. Quelle vere: +1.100 atleti, +8.880 ore, 356 recensioni Trustpilot 4,9/5, #1 in Italia per Mental Coaching, +20 coach.

---

## 7. Checklist prima di attivare

- [ ] Account passato dal trial al **piano a pagamento** (bloccante: a 12.440 contatti il trial non invia)
- [ ] Supporto ActiveCampaign avvisato dell'invio massivo in arrivo, per evitare la sospensione antifrode
- [ ] Indirizzo postale impostato in *Impostazioni → Indirizzi* e associato alla lista 5 (non verificabile via API, va guardato a schermo)
- [ ] Link Zoom inserito al posto di `[LINK ZOOM]` in R1, R2, R3, R4
- [ ] Link gruppo WhatsApp al posto di `[LINK GRUPPO WHATSAPP]` in R1, R1bis, R2
- [ ] Pagine di conferma del Flusso B costruite, e `[LINK PAGINA SI]` / `[LINK PAGINA NO]` sostituiti in B1 e B2
- [ ] Pagina di candidatura costruita, e `[LINK PAGINA CANDIDATURA]` sostituito in P1, P3, P4, P5
- [ ] Link replay al posto di `[LINK REPLAY]` in P2 e P4
- [ ] Test di invio a sé stessi per ogni email, letta **su telefono**
- [ ] Ogni automazione **attivata** (salvare non basta: c'è l'interruttore in alto a destra)
- [ ] Solo a questo punto: applicare i tag di segmento, a scaglioni

### Rampa di invio

L'account non ha mai inviato niente. Mandare a 12.440 persone in un colpo significa finire in spam e restarci. Applicare i tag a scaglioni:

| Sera | Contatti | Segmento |
|---|---|---|
| 1 | 500 | caldi (i 500 già taggati `lancio26-lotto1` sono pronti) |
| 2 | 1.000 | caldi |
| 3 | 2.000 | caldi |
| 4 | 2.000 | caldi + tiepidi |
| 5 | 2.500 | tiepidi |
| 6 | il resto | freddi |

**Regola di stop.** Dopo il primo lotto da 500, attendere 12 ore e guardare il tasso di apertura: sopra il 30% si procede · tra 15% e 30% si procede dimezzando i lotti · **sotto il 15% ci si ferma**, perché è un problema di deliverability e non di copy, e va risolto prima di continuare.

---

## 8. Cosa riferire a fine lavoro

Per ogni automazione creata:
- id e nome
- trigger impostato (tag e id)
- per ogni slot email: `campaignid` → `messageid` → chiave dell'email scritta
- esito della **rilettura** di ogni messaggio (oggetto, preheader, corpo non più il template di default)
- stato: attiva o inattiva

Segnalare esplicitamente ogni punto in cui la realtà dell'account non corrisponde a questo brief. È già successo due volte che documenti tramandati fossero superati: vale più una segnalazione che un'assunzione.
