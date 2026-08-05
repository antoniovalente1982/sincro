# Architettura del Lancio — Webinar 24 agosto 2026 · Metodo Sincro

**Aggiornato: 5 agosto 2026, sera — rispecchia lo stato REALE e verificato dei sistemi.**
Tutto ciò che è marcato ✅ è costruito, attivo e testato dal vivo.

---

## 1. I tre sistemi e chi fa cosa

```
┌─────────────────────┐      ┌──────────────────────┐      ┌─────────────────────┐
│  LANDING PAGES      │      │  GESTIONALE          │      │  ACTIVECAMPAIGN     │
│  landing.           │ ───▶ │  (Next.js su Vercel, │ ───▶ │  valenteantonio     │
│  metodosincro.com   │ form │  repo "sincro")      │ API  │  17118              │
│                     │      │                      │      │                     │
│  vetrina + moduli   │      │  riceve i form,      │      │  invia le email,    │
│                     │      │  salva TUTTO, mette  │      │  gestisce automa-   │
│                     │      │  il lead in pipeline,│      │  zioni, tag, liste  │
│                     │      │  tagga in AC         │      │                     │
└─────────────────────┘      └──────────────────────┘      └─────────────────────┘
                                       │
                        ┌──────────────┴──────────────┐
                        ▼                             ▼
              Telegram + email a te        CRM: pipeline con venditore
                                           assegnato (chi chiama, chiama
                                           da lì — non da Telegram)
```

**Fuori dai sistemi ma dentro il funnel:** il **gruppo WhatsApp**
(`chat.whatsapp.com/K3ofUeUjEuOGCXk6yD1BBI`) — unico canale per link Zoom e replay.
Lì scrivi SOLO tu, a mano (vedi §7).

### Le pagine

| URL | Funzione | Cosa scatena |
|---|---|---|
| `/webinar-agosto` (+ `#register`) | landing del webinar col form di registrazione | → gestionale → tag `lancio26-registrato` |
| `/webinar-agosto/grazie.html` | thank-you registrazione ("entra nel gruppo WhatsApp") | nulla (informativa) |
| `/candidatura` | form candidatura alla chiamata gratuita di 20 min | → gestionale → **lead in pipeline "Consulenza Post Webinar"** + tag `lancio26-candidato` + nota per il coach |
| pagina "Candidatura ricevuta" | thank-you candidatura | nulla (informativa) |
| `/resto` | conferma per chi clicca "SÌ, GIOCA ANCORA" / "RESTO IN LISTA" (email freddi) | nulla — il tag lo mette l'automazione via click-tracking |

### Il gestionale (repo `sincro`, deploy su Vercel)

- `app/api/submit/route.ts` → registrazioni webinar: salva su Supabase → AC (`contact/sync` → lista 9 → **tag 176 `lancio26-registrato`**) → Telegram a te
- `app/api/candidatura/route.ts` → candidature: salva SEMPRE prima (log+file), poi **in parallelo e indipendenti** gestionale e AC (upsert → **tag 185 `lancio26-candidato`** → **nota col contenuto del form per il coach**) → Telegram + email interna. Se uno dei due salta, l'altro passa e la notifica dice quale. Se le candidature sono chiuse (`CANDIDATURE_APERTE=false`) → tag `lancio26-lista-attesa` (186)
- `lib/crm-candidatura.ts` → mette il candidato nel CRM: pipeline **Consulenza Post Webinar**, stage *Candidatura ricevuta*, venditore assegnato in round-robin. Chi era già lead (tipico: registrato al webinar) non viene duplicato, viene **spostato** in questa pipeline. Il legame pagina→pipeline passa dal funnel con slug `candidatura` sul database: la pipeline si cambia dal gestionale, senza deploy
- `lib/activecampaign.ts` → il ponte verso AC
- `scripts/lancio_prepara_lotti.py` → crea i tag-lotto della rampa (da eseguire dal Mac, ~35 min)

### La pipeline dei candidati (gestionale → CRM)

`Consulenza Post Webinar` — è la lista di lavoro dei coach, dove finisce ogni
candidatura. Telegram avvisa, ma la telefonata si fa da qui.

```
Candidatura ricevuta → Contattato su WhatsApp → Chiamata fissata → Chiamata fatta
                                                                    ├─▶ Vendita
                                                                    ├─▶ Non idoneo
                                                                    └─▶ Perso
```

*Non idoneo* è separato apposta: la pagina promette che se il Metodo non è la cosa
giusta glielo dite, e quel no non è un lead perso — è la promessa mantenuta.

Nella scheda del lead ci sono età, livello e la difficoltà **in parole sue**: le
stesse che finiscono nella nota su AC. Il coach non deve aprire due sistemi.

---

## 2. ActiveCampaign — anagrafica

**Liste**

| id | nome | uso |
|---|---|---|
| 5 | Lista Importata 30/07/2026 | il serbatoio: 12.440 genitori |
| 6 / 7 / 8 | Lancio26 Aperti / Cliccati / Dormienti | popolate in automatico dalle automazioni di misurazione |
| 9 | Registrati Webinar - 24 Agosto 2026 | riempita dal gestionale a ogni registrazione |

**Tag — il sistema nervoso.** Ogni tag `lancio26-*` è un grilletto o uno stato:

| tag | chi lo mette | cosa fa scattare |
|---|---|---|
| `lancio26-caldo` / `tiepido` | **TU, a mano, ogni sera della rampa** | → Automazione Risveglio (A1-A2-A3) |
| `lancio26-freddo` | tu, sera 6 | → Automazione Freddi (B1-B2) |
| `lancio26-engaged` + `invitabile` | automazione Risveglio (chi apre) | `invitabile` → Automazione Invito (W1-W4) |
| `lancio26-riattivato` + `invitabile` | automazione Freddi (chi clicca) | idem |
| `lancio26-sospeso` | automazioni Risveglio/Freddi (chi ignora) | stato: non riceve più nulla |
| `lancio26-registrato` (176) | **gestionale**, alla registrazione | → Automazione R (conferma + promemoria) |
| `lancio26-presente` / `assente` (177/178) | **TU, il 25/8** (export Zoom) | → Automazioni Post-webinar P |
| `lancio26-candidato` (185) | **gestionale**, alla candidatura | → Automazione Conferma Candidatura (C1) |
| `lancio26-lista-attesa` (186) | **gestionale**, a candidature chiuse | niente ancora: è la lista da riavvisare a ottobre |
| `lancio26-cliente` (180) | tu/venditori, alla vendita | ESCE subito dalle sequenze P |
| `lancio26-lotto1…lotto6` | script/import — tag NEUTRI | niente: servono solo a selezionare i lotti |

**Mittente:** sempre `info@valenteantonio.it` (SPF/DKIM/DMARC ok). Indirizzo postale nel footer: Sincro Group S.r.l, Via Monte Napoleone 8, Milano ✅.

---

## 3. Le 7 automazioni (tutte ATTIVE ✅)

### ① Lancio26 - Risveglio Caldi e Tiepidi (id 6)
```
tag caldo O tiepido
  → 📧 A1 "Tuo figlio ci sta già pensando"        (subito, la sera del tag)
  → attendi 1 giorno → attendi fino alle 9:00
  → 📧 A2 "«Stai tranquillo» è la frase..."        (2 mattine dopo, ore 9)
  → attendi 3 giorni
  → 📧 A3 "1.100 ragazzi. Nessuno era «dotato»"    (il lunedì, ore 9)
  → attendi 1 giorno
  → HA APERTO almeno una?
      SÌ → tag engaged + invitabile  ──▶ parte l'Invito (④)
      NO → tag sospeso               ──▶ fine, non riceve altro
```

### ② A1 - Risveglio Freddi (id 7)
```
tag freddo
  → 📧 B1 "Tuo figlio gioca ancora?"   [SÌ → /resto · non gioca più → disiscrizione]
  → attendi 4 giorni
  → 📧 B2 "Chiudo"                     [RESTO IN LISTA → /resto]
  → attendi 1 giorno
  → HA CLICCATO?
      SÌ → tag riattivato + invitabile ──▶ parte l'Invito (④)
      NO → tag sospeso                 ──▶ fine
```

### ④ W - Invito Webinar 24 Agosto (id 8)
```
tag invitabile
  → se ha già il tag registrato → FINE (niente inviti a chi è già iscritto)
  → 📧 W1 invito                        (subito)
  → 📧 W2                               (20/8 ore 9)
  → 📧 W3                               (22/8 ore 10)
  → 📧 W4 "È stasera"                   (24/8 ore 9)
  CTA di tutte: → /webinar-agosto#register
```

### ⑤ R - Promemoria Registrati (id 9) — il cuore
```
tag registrato   ◀── messo dal gestionale quando uno si registra
  → 📧 R1 "Sei dentro — manca un passaggio"        (subito = è l'email di CONFERMA)
  → attendi 1 giorno
  → ha cliccato (il gruppo WhatsApp)?
      SÌ → salta avanti
      NO → 📧 R1bis "Ti sei perso il pezzo importante"
  → attendi fino al 23/8 ore 20:00 → 📧 R2 "Domani sera alle 21:00"
  → attendi fino al 24/8 ore 18:00 → 📧 R3 "Tra 3 ore"
  → attendi fino al 24/8 ore 20:45 → 📧 R4 "Siamo live tra 15 minuti"
```
✅ Testata DAL VIVO due volte (iCloud 15:12, Gmail 18:30 → Posta in arrivo).

### ⑥⑦ P - Post Webinar Presenti (id 10) / Assenti (id 11)
```
tag presente                              tag assente
  → cliente? SÌ→fine                        → cliente? SÌ→fine
  → 📧 P1 recap + candidature aperte        → 📧 P2 "il replay è nel gruppo"
  → 2 giorni → 📧 P3 obiezioni              → 1 giorno → 📧 P3
  → 1 giorno → 📧 P4 replay in scadenza     → 1 giorno → 📧 P4 "a mezzanotte lo tolgo"
  → 1 giorno → 📧 P5 chiusura               → 1 giorno → 📧 P5
  CTA di tutte: → /candidatura
```

### ⑧ Lancio26 - Conferma Candidatura (id 12) — nuova del 5/8
```
tag candidato   ◀── messo dal gestionale quando uno compila /candidatura
  → 📧 C1 "Candidatura ricevuta — ti chiamiamo entro 24 ore"
        (aspettative + "rispondi anche ai numeri sconosciuti")
```

**Di supporto (misurazione):** Lancio26 "ha aperto" / "ha cliccato" / "dormienti" — spostano i contatti nelle liste 6/7/8 in base al comportamento. Non toccano le email.

---

## 4. Il viaggio completo di un contatto (esempio: genitore del lotto 1)

```
5/8 sera   tu gli metti il tag caldo → A1 in casella
7/8 h9     A2 · 10/8 h9 A3
11/8       ha aperto → invitabile → W1 invito webinar
14/8       si registra sulla landing → gestionale → tag registrato
           → R1 conferma ("entra nel gruppo WhatsApp") → entra nel gruppo
19-23/8    riceve i tuoi 3 messaggi di valore nel gruppo (+ W2/W3 non gli
           arrivano più? sì che gli arrivano — ma R2 lo tiene caldo)
23/8 h20   R2 vigilia · sera: TU mandi il link Zoom nel gruppo
24/8       h9 W4* · h18 R3 · h20:45 R4 + TU rimandi il link nel gruppo
           h21:00 WEBINAR
25/8       tu esporti i presenti da Zoom → tag presente
           → P1 → si candida su /candidatura → gestionale → tag candidato
           → C1 "ti chiamiamo entro 24h" + Telegram a te + nota per il coach
           → e nel CRM: pipeline Consulenza Post Webinar, già assegnato a un venditore
26/8       il venditore lo chiama dalla sua pipeline: età, livello e difficoltà
           in parole sue sono nella scheda lead (e nella nota su AC)
```
*W4 non arriva a chi è già registrato: il blocco d'uscita lo espelle.

---

## 5. La rampa di invio (perché non tutti insieme)

Account nuovo, mai inviato → reputazione da costruire. Lo dice anche Luca di AC: piano approvato.

| Sera | Lotto | Contatti | Tag da mettere |
|---|---|---|---|
| 1 · mer 5/8 | lotto1 (già taggato) | 500 | `lancio26-caldo` |
| 2 · gio 6/8 | lotto2 | 1.000 | `lancio26-caldo` |
| 3 · ven 7/8 | lotto3 | 2.000 | `lancio26-caldo` |
| 4 · sab 8/8 | lotto4 | 2.000 | `lancio26-caldo` |
| 5 · dom 9/8 | lotto5 | 2.500 | `lancio26-caldo` |
| 6 · lun 10/8 | lotto6 | ~4.440 | `lancio26-freddo` (flusso B) |

**Procedura serale (1 minuto):** Contatti → cerca tag `lancio26-lottoN` → seleziona tutti → Aggiungi tag → il tag trigger. *(Prerequisito: eseguire una volta `scripts/lancio_prepara_lotti.py` dal Mac per creare i lotti 2-6.)*

**Regola di stop (ogni mattina, non negoziabile):** apertura del lotto precedente
**>30%** → lotto pieno · **15-30%** → dimezza · **<15%** → FERMO, è un problema di
deliverability, si risolve prima di continuare.

Nota: niente storico aperture su questo account → lotti neutri in ordine di lista
(la divisione caldi/tiepidi per engagement del piano originale non era possibile).

---

## 6. Notifiche verso di te

| Evento | Canale | Contenuto |
|---|---|---|
| Registrazione webinar | Telegram | nome, email, telefono, esito sync AC |
| Candidatura | Telegram + email interna | tutti i dati del form + esito dei DUE sync, gestionale e AC (⚠️ se uno fallisce lo dice, e quello va rifatto a mano) |
| Candidatura → per il coach | nota sulla scheda contatto AC **+ scheda lead nel CRM** | età, livello, difficoltà in parole sue |
| Candidatura → al venditore | Telegram personale | a chi è stata assegnata in round-robin |

---

## 7. Quello che fai SOLO TU (il sistema non ti copre qui)

| Quando | Azione |
|---|---|
| ogni sera 5-10/8 | tag del lotto (§5) + mattina dopo: regola di stop |
| mer 19/8 · ven 21/8 · dom 23/8 | 3 messaggi di valore nel gruppo WhatsApp (testi pronti nel file "messaggi-whatsapp-community") |
| **dom 23/8 sera** | **link Zoom nel gruppo** (le email lo promettono: solo lì) |
| **lun 24/8 h20:45** | **link Zoom di nuovo nel gruppo** → h21 diretta |
| mar 25/8 | export presenti Zoom → tag `presente`/`assente` a mano · replay nel gruppo |
| gio 27/8 mezzanotte | togli il replay dal gruppo (promesso in P2/P4) |
| dal 25/8 | i venditori chiamano i candidati entro 24h (nota in AC) |
| alla vendita | tag `lancio26-cliente` (spegne le email di vendita per quel contatto) |

---

## 8. Vincoli non negoziabili (valgono ovunque)

⛔ **Nessun prezzo, mai** — i prezzi solo in chiamata. CTA sempre "candidati alla
chiamata gratuita", mai "compra". Mittente solo `info@valenteantonio.it`.
Statistiche solo vere: +1.100 atleti, +8.880 ore, 356 recensioni Trustpilot 4,9/5,
#1 in Italia, ~20 coach (10 posti Sincro Circle = capienza, unico numero ammesso).
Niente `%FIRSTNAME%` nel corpo (metà lista è senza nome).

---

## 9. Stato al 5/8 sera e cosa manca

✅ 7 automazioni attive (10 in tutto con quelle di misurazione, verificate via API) ·
20 email pronte e testate · funnel registrazione e candidatura provati end-to-end
dal vivo · pagine live · pipeline "Consulenza Post Webinar" attiva, con lead,
assegnazione e note verificati in produzione · deliverability Gmail ok (Posta in
arrivo al primo colpo) · supporto AC allineato (rampa approvata) · indirizzo
postale ok · brief e note nel repo

### Come si leggono gli errori di ActiveCampaign (verificato sul campo il 5/8)

La prima candidatura di prova è fallita con `403` a **corpo vuoto**, ed è stata
diagnosticata come un problema di BASE_URL. Non lo era. Provato a mano:

| Sintomo | Causa vera |
|---|---|
| `403` con corpo **vuoto** | la **chiave API** è sbagliata, troncata, o incollata **con le virgolette** attorno (uno spazio in coda invece passa) |
| `404` | il BASE_URL non finisce con `/api/3` |

La chiave caricata su Vercel non era quella buona (quale dei tre casi non si è potuto
sapere: Vercel restituisce il valore mascherato). È stata ricaricata via CLI dal
valore verificato, senza copia-incolla di mezzo. Ora il codice ripulisce da solo
virgolette e spazi e normalizza il BASE_URL in qualunque formato — ma se ricapita,
questa tabella dice dove guardare senza perdere un pomeriggio.

⬜ **Piano a pagamento** (mensile €279,65 approvato da Luca) — finché è trial gli
invii oltre la franchigia restano in coda
⬜ Controprova candidatura post-upgrade (`+alias@gmail.com` → deve arrivare C1)
⬜ `scripts/lancio_prepara_lotti.py` dal Mac (prepara i lotti 2-6)
⬜ Stasera: tag `lancio26-caldo` ai 500 del lotto 1

---

*Documenti collegati nel repo: `docs/lancio-agosto-2026/brief-per-agente-mcp.md`
(dettagli operativi e storia delle decisioni) · `brief-pagina-candidatura.md` ·
mappa visuale del lancio (artifact Cowork "mappa-lancio-24-agosto").*
