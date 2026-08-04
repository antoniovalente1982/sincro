# Guida operativa — costruire le automazioni in ActiveCampaign

Aggiornata al **4 agosto 2026**, con lo stato reale dell'account verificato via API (non quello scritto nell'handoff, che era già superato).

---

## Stato reale dell'account, oggi

| Cosa | Stato verificato |
|---|---|
| Contatti nell'account | **12.709** |
| Liste | id 5 (Lista Importata), 6 Aperti, 7 Cliccati, 8 Dormienti, **9 Registrati Webinar** |
| Tag `lancio26-*` | **tutti creati (id 169–182)** |
| Contatti taggati caldo / tiepido / freddo | **0 / 0 / 0** |
| `lancio26-lotto1` | 500 contatti |
| Automazioni esistenti | 4: id 3 "ha aperto", id 4 "ha cliccato", id 5 "dormienti", id 6 "Sequenza riscaldamento" |
| Contatti entrati in un'automazione | **0 su tutte e 4** |
| Email inviate | **nessuna** |

**Traduzione: la riattivazione non è mai partita.** Niente è stato inviato, nessuno è stato taggato per segmento, nessuna automazione ha mai lavorato.

È una buona notizia: nessun danno da recuperare, nessun contatto bruciato, e possiamo far partire il calendario pulito. Ma significa anche che il collo di bottiglia non sono le email — quelle ora ci sono tutte. È **la segmentazione**, che va rifatta.

I CSV `riattivazione_CALDI/TIEPIDI/FREDDI.csv` non esistono più: vivevano nella sandbox dell'altra sessione. Non serve rifarli — si fa tutto dentro ActiveCampaign, ed è più veloce.

---

## PASSO 0 — Segmentare i contatti (30 minuti, si fa una volta sola)

Nessun CSV, nessun import. Si usa la ricerca avanzata di ActiveCampaign e si applica il tag in blocco.

Per ciascuno dei tre segmenti: **Contatti → Cerca → Ricerca avanzata**, imposta le condizioni, poi seleziona tutti i risultati → **Aggiungi tag**.

### Segmento CALDI → tag `lancio26-caldo`
```
Lista           è          Lista Importata 30/07/2026
E
(  Ha cliccato un link in una campagna   —  in qualsiasi campagna
   OPPURE  Ha aperto una campagna        —  negli ultimi 90 giorni  )
```

### Segmento TIEPIDI → tag `lancio26-tiepido`
```
Lista           è          Lista Importata 30/07/2026
E   Tag         non è      lancio26-caldo
E   Ha aperto una campagna —  negli ultimi 180 giorni
```

### Segmento FREDDI → tag `lancio26-freddo`
```
Lista           è          Lista Importata 30/07/2026
E   Tag         non è      lancio26-caldo
E   Tag         non è      lancio26-tiepido
```

> **Attenzione all'ordine.** Vanno applicati in questa sequenza esatta: caldi, poi tiepidi, poi freddi. Le condizioni di ogni segmento escludono i precedenti — se inverti l'ordine finisce tutto nei freddi.

> **Se l'account non ha storico aperture** (lista importata, mai inviata nulla): i filtri "ha aperto" restituiranno zero, e finiranno tutti in FREDDI. In quel caso salta la distinzione caldo/tiepido, tratta l'intera lista come freddi e usa il Flusso B per tutti. Meglio partire con una domanda semplice a tutti che fingere una segmentazione che non hai.

**Non applicare i tag prima di aver costruito e attivato le automazioni.** Il tag è il grilletto: nel momento in cui lo applichi, se l'automazione è attiva, l'email parte.

---

## PASSO 1 — Automazione «A2 · Risveglio Caldi e Tiepidi»

**Automazioni → Crea automazione → Inizia da zero**
Nome: `A2 · Risveglio Caldi e Tiepidi`

### Trigger
- **Il tag viene aggiunto** → `lancio26-caldo` → *Esegui: una volta* → *Chi può entrare: contatti esistenti e nuovi*
- Clicca **Aggiungi un altro trigger** → **Il tag viene aggiunto** → `lancio26-tiepido` (stesse impostazioni)

Due trigger separati sulla stessa automazione = logica OR. È corretto così.

### Struttura
```
[Trigger: tag lancio26-caldo O lancio26-tiepido aggiunto]
   │
   ├─ 📧 EMAIL A1 — "Tuo figlio ci sta già pensando"
   │
   ├─ ⏱️  ATTENDI 2 giorni
   │
   ├─ 📧 EMAIL A2 — "«Stai tranquillo» è la frase che gli fa più male"
   │
   ├─ ⏱️  ATTENDI 3 giorni
   │
   ├─ 📧 EMAIL A3 — "1.100 ragazzi. Nessuno era «quello dotato»."
   │
   ├─ ⏱️  ATTENDI 1 giorno
   │
   ├─ ❓ CONDIZIONE: "Ha aperto" una qualsiasi delle 3 email?
   │      ├─ SÌ → 🏷️ aggiungi `lancio26-engaged` + `lancio26-invitabile`
   │      └─ NO → 🏷️ aggiungi `lancio26-sospeso`
   │
   └─ FINE
```

> **Usa sempre attese RELATIVE (2 giorni, 3 giorni), mai date fisse.** Se invii in rampa scaglionata, ogni lotto parte in un giorno diverso: con le date fisse chi entra tardi riceve tre email tutte insieme.

> **Imposta la finestra oraria sulle attese.** In ogni blocco "Attendi" c'è l'opzione *"Attendi fino a un orario specifico"*: imposta **9:00–10:00**. Le email ai genitori aprono meglio la mattina, e ti evita invii alle 3 di notte.

### Inserire il corpo delle email

✅ **Il corpo delle email si scrive via API.** Verificato il 4 agosto 2026 con `PUT /api/3/messages/{id}`: scrittura e rilettura confermate su oggetto, preheader e HTML.

> ⚠️ **Correzione a un errore che girava nei documenti precedenti.** L'handoff sosteneva che l'HTML non fosse scrivibile via API. È falso: quella sessione usava l'endpoint sbagliato, `campaign/message`, che aggiorna solo i metadati e ignora il campo `html` senza restituire errore. L'endpoint corretto è **`messages`**. Se in futuro un documento ripete quel limite, è sbagliato: testalo prima di rassegnarti a incollare a mano.

Quindi **le email non vanno incollate a mano**. Il flusso è:

1. Tu crei lo scheletro dell'automazione nell'editor (trigger, attese, blocchi "Invia email" anche vuoti)
2. Mi dici quali slot hai creato
3. Io ci scrivo dentro oggetto, preheader e corpo impaginato, e verifico rileggendo

**Già fatte così:** le tre email dell'automazione "Sequenza riscaldamento" — messaggi **18, 19, 20** (campagne 6, 8, 10).

Sul nome: nel corpo uso "Ciao," senza `%FIRSTNAME%`, perché metà della lista importata non ha il nome valorizzato e senza fallback quelle persone leggono "Ciao ,". Se vuoi la personalizzazione, va inserita dall'editor col pulsante *Personalizza* impostando un valore predefinito.

Resta obbligatorio in fondo a ogni email: `%SENDER-INFO-SINGLELINE%` e `%UNSUBSCRIBELINK%` — già inclusi nel template che uso.

---

## PASSO 2 — Automazione «A1 · Risveglio Freddi»

Quando A2 è finita e verificata, **non ricostruirla da zero**: menu tre puntini sull'automazione → **Duplica**. Poi cambia:

- Nome: `A1 · Risveglio Freddi`
- Trigger: un solo trigger, **tag `lancio26-freddo` aggiunto**
- Elimina il terzo blocco email
- Email 1 → **B1** "Tuo figlio gioca ancora?"
- Attesa → **4 giorni**
- Email 2 → **B2** "Chiudo"
- Condizione finale: ha cliccato uno dei due pulsanti? SÌ → `lancio26-riattivato` + `lancio26-invitabile` · NO → `lancio26-sospeso`

**Servono 2 pagine di conferma** per i pulsanti SÌ / NO del Flusso B. Posso costruirle nel gestionale come le altre landing — dimmelo e le faccio.

---

## PASSO 3 — Automazione «W · Promemoria Webinar»

Questa è quella collegata alla tua landing page. **Trigger: tag `lancio26-registrato` (id 176) aggiunto.**

Il tag arriva automaticamente: landing → `/api/submit` → gestionale → API ActiveCampaign. Non devi fare niente a mano.

```
[Trigger: tag lancio26-registrato aggiunto]
   │
   ├─ 📧 R1 — "Sei dentro, manca un passaggio"   ← subito, nessuna attesa
   │         (link Zoom + invito gruppo WhatsApp)
   │
   ├─ ⏱️  ATTENDI 1 giorno
   │
   ├─ ❓ CONDIZIONE: ha cliccato il link del gruppo WhatsApp in R1?
   │      ├─ SÌ → salta la prossima email
   │      └─ NO → 📧 R1-bis — "Non ti ho ancora visto nel gruppo"
   │
   ├─ ⏱️  ATTENDI fino al 23 agosto, ore 20:00
   ├─ 📧 R2 — "Domani sera alle 21:00"
   │
   ├─ ⏱️  ATTENDI fino al 24 agosto, ore 18:00
   ├─ 📧 R3 — "Tra 3 ore"
   │
   ├─ ⏱️  ATTENDI fino al 24 agosto, ore 20:45
   ├─ 📧 R4 — "Siamo live tra 15 minuti"
   │
   └─ FINE
```

> **Attenzione al mix di attese.** La prima è **relativa** (1 giorno dalla registrazione: chi si iscrive il 19 riceve il recupero il 20, chi si iscrive il 22 lo riceve il 23). Le altre tre sono **fisse**, perché il webinar è un evento a data fissa e tutti devono ricevere il promemoria nello stesso momento. Usa "Attendi 1 giorno" per la prima e **"Attendi fino a una data specifica"** per le altre.

> **Chi si registra il 24 stesso** salta di fatto R1-bis e riceve solo R1 + R3 + R4. È corretto così — non va forzato niente.

### Come si imposta la condizione sul gruppo WhatsApp

ActiveCampaign non sa chi è entrato davvero nel gruppo, ma sa **chi ha cliccato il link**. È un'ottima approssimazione.

1. In R1, il pulsante "ENTRA NEL GRUPPO" deve puntare al link del gruppo — ActiveCampaign traccia automaticamente i click sui link nelle email
2. Nel blocco condizione scegli **"Se/Altrimenti"** → condizione **"Ha cliccato un link"** → seleziona la campagna **R1** → seleziona il link del gruppo
3. Ramo SÌ → va direttamente all'attesa del 23 agosto. Ramo NO → passa da R1-bis

Se ti sembra troppo, l'alternativa è mandare R1-bis a tutti: chi è già nel gruppo legge una riga e la ignora. Perdi poco.

### Cosa serve da te su questa automazione

- **Il link Zoom** — va in R1, R2, R3, R4
- **Il link del gruppo WhatsApp** — va in R1, R1-bis, R2 (e nelle email di invito W1 e W3)
- **Tre messaggi nel gruppo** tra il 18 e il 24: mercoledì 19, venerdì 21, domenica 23. Vocali brevi da 60-90 secondi rendono più del testo. Se vuoi te li scrivo.

---

## PASSO 4 — Automazione post-webinar

Il giorno dopo il webinar tagghi a mano chi ha partecipato (Zoom ti dà l'elenco dei presenti: esportalo e importalo in AC applicando `lancio26-presente`; a tutti gli altri registrati applichi `lancio26-assente`).

Due automazioni gemelle:

- **Trigger `lancio26-presente`** → P1 → attendi 2gg → P3 → attendi 1gg → P4 → attendi 1gg → P5
- **Trigger `lancio26-assente`** → P2 → attendi 1gg → P3 → attendi 1gg → P4 → attendi 1gg → P5

In entrambe, metti in cima un blocco **"Esci dall'automazione se"** → *ha il tag `lancio26-cliente`*. Chi si è già candidato e ha comprato non deve continuare a ricevere email di vendita: è il modo più veloce per far incazzare un cliente appena acquisito.

---

## PASSO 5 — Rampa di invio (protezione del dominio)

L'account non ha mai inviato niente a 12.000 persone. Mandare tutto insieme il primo giorno è il modo più efficace per finire in spam e restarci.

Non applicare i tag a tutti in una volta: **applica il tag a scaglioni**, usando la ricerca avanzata e selezionando un numero limitato di contatti per volta.

| Sera | Contatti taggati | Segmento |
|---|---|---|
| Giorno 1 | 500 | caldi |
| Giorno 2 | 1.000 | caldi |
| Giorno 3 | 2.000 | caldi |
| Giorno 4 | 2.000 | caldi + tiepidi |
| Giorno 5 | 2.500 | tiepidi |
| Giorno 6 | il resto | freddi |

**Regola di stop:** dopo il primo lotto da 500, aspetta 12 ore e guarda il tasso di apertura.
- sopra il 30% → procedi
- tra il 15% e il 30% → procedi ma dimezza i lotti
- sotto il 15% → **fermati**. C'è un problema di deliverability, non di copy. Da lì si controlla autenticazione dominio e reputazione IP prima di continuare.

I 500 contatti già taggati `lancio26-lotto1` sono il tuo primo lotto pronto.

---

## PASSO 6 — Checklist prima di attivare

- [ ] Indirizzo postale impostato in **Impostazioni → Indirizzi** e associato alla lista 5 *(non verificabile via API — va guardato a schermo)*
- [ ] Mittente `info@valenteantonio.it`, dominio autenticato ✅ (già fatto)
- [ ] `%UNSUBSCRIBELINK%` presente in tutte le email
- [ ] `%FIRSTNAME%` con valore predefinito impostato
- [ ] Link Zoom inserito in R1, R2, R3, R4
- [ ] Test di invio a te stesso per ogni email — leggila sul telefono, non solo sul Mac
- [ ] Automazione **attivata** (non basta salvarla: c'è l'interruttore in alto a destra)
- [ ] Solo dopo tutto questo: applicare i tag di segmento

---

## Cosa gira già da solo (non devi farci niente)

Quando qualcuno si registra sulla landing del webinar:

1. Il gestionale salva il lead in Supabase e lo mette in pipeline
2. Chiama ActiveCampaign: crea/aggiorna il contatto, lo mette in **lista 9**, applica il tag **176**
3. Il tag 176 fa partire l'automazione W (promemoria)
4. Ti arriva su Telegram: **🎥 NUOVA REGISTRAZIONE AL WEBINAR** con nome, email, telefono, data evento e l'esito del sync ActiveCampaign

Se il sync fallisce, la notifica Telegram te lo dice esplicitamente (`⚠️ ActiveCampaign: sync FALLITA`) invece di restare nascosto nei log. Così non scopri a webinar finito che venti persone non hanno mai ricevuto il link.
