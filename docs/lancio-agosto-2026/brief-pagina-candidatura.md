# Brief — Pagina Candidatura Call Gratuita (lancio 24 agosto 2026)

**Per:** agente che lavora sul gestionale (`/Users/antoniovalente/Desktop/sincro`, Next.js su landing.metodosincro.com)
**Scopo:** pagina dove i genitori si candidano alla **chiamata gratuita di 20 minuti con un coach**. È la destinazione delle email P1, P3, P4, P5 del funnel post-webinar (placeholder attuale: `[LINK PAGINA CANDIDATURA]`).
**URL proposto:** `https://landing.metodosincro.com/candidatura` (se diverso, comunicarlo: va sostituito in 8 email su ActiveCampaign).

---

## 1. Cosa promettono le email (la pagina DEVE mantenere queste promesse)

- Chiamata di **20 minuti**, con **uno dei nostri coach** (non necessariamente Antonio)
- **Gratuita, nessun impegno**
- Si guarda la **situazione specifica del figlio**, si capisce **se c'è un blocco e quale**, e "ti diciamo cosa faremmo noi"
- Onestà dichiarata: *"Se il Metodo Sincro non è la cosa giusta per lui, te lo diciamo"*
- Scarsità reale: ~20 coach, posti di settembre limitati; chi arriva dopo va a ottobre
- È una **candidatura** (si compila un form e si viene ricontattati), NON un booking calendario

## 2. Vincoli non negoziabili

- ⛔ **Nessun prezzo, da nessuna parte.** Mai "compra/acquista". Solo "candidati alla chiamata gratuita"
- Numeri usabili SOLO questi: +1.100 atleti seguiti, +8.880 ore, 356 recensioni Trustpilot 4,9/5, +20 coach, #1 in Italia. (Sincro Circle: 10 posti, solo se citato come capienza)
- Target: genitori di calciatori 10–20 anni, fino ai professionisti
- Pagina `noindex` (come `/resto`)

## 3. Stile (identico alle email del funnel)

- Sfondo pagina `#f6f4ef` (crema) · card bianche radius 8px
- Header navy `#0d1b2a` con wordmark `METODO SINCRO®` oro `#c9a84c`, letter-spacing largo
- Bottoni oro `#c9a84c`, testo navy bold maiuscolo, radius 4px
- Font Helvetica/Arial. Mobile-first (il traffico arriva da email + WhatsApp, quasi tutto da telefono)

## 4. Struttura e copy (pronto all'uso)

### Hero (card navy)
- H1: **«20 minuti sulla situazione di tuo figlio. Non sulla teoria.»**
- Sub: «Una chiamata gratuita con uno dei coach del Metodo Sincro. Guardiamo il suo momento, capiamo se c'è un blocco e quale, e ti diciamo cosa faremmo noi. Se non è la cosa giusta per lui, te lo diciamo — è successo, succederà ancora.»
- Bottone oro → ancora `#candidatura`: **CANDIDATI ALLA CHIAMATA**

### Come funziona (3 step, card bianca)
1. **Compili la candidatura** — due minuti, le domande servono al coach per arrivare preparato
2. **Ti ricontattiamo su WhatsApp entro 24–48 ore** — per fissare giorno e ora
3. **Fai la chiamata** — 20 minuti, si parla solo di tuo figlio

### Per chi è / per chi non è (card bianca, due colonne)
- ✔ Genitori di calciatori 10–20 anni · ✔ dal settore giovanile ai professionisti · ✔ «in allenamento è un altro, in partita sparisce» · ✔ ansia da prestazione, blocchi, pressione, provini
- ✘ Chi cerca un procuratore · ✘ chi cerca allenamento tecnico in campo · ✘ chi vuole «la frase magica da dire in macchina»

### Barra prova sociale (come nelle email)
`+1.100 ATLETI SEGUITI · +8.880 ORE DI LAVORO · 4,9★ 356 RECENSIONI TRUSTPILOT · +20 COACH`

### Form `#candidatura` (card bianca)
Campi:
1. Nome e cognome (genitore) — required
2. Email — required (chiave per ActiveCampaign)
3. Cellulare/WhatsApp — required (il ricontatto avviene lì)
4. Età del figlio — select 10…20 — required
5. Livello — select: Scuola calcio / Agonistica dilettanti / Settore giovanile professionistico / Professionista — required
6. «Qual è la difficoltà principale in questo momento?» — textarea, placeholder: «Es.: in partita si blocca, dopo un errore sparisce dal gioco…» — required, max ~500 caratteri
7. Checkbox privacy — required

Bottone oro full-width: **INVIA LA CANDIDATURA**
Microcopy sotto: «Gratuita e senza impegno. I posti per settembre sono limitati: ~20 coach, agende chiuse a numero.»

### Thank-you (stessa pagina, stato post-submit — stile `/resto`)
- «**Candidatura ricevuta.** Ti scriviamo su WhatsApp entro 24–48 ore per fissare la chiamata. Se non ti arriva nulla, controlla anche l'email.»

## 5. Integrazione (stesso pattern della registrazione webinar)

Al submit, route API del gestionale che:
1. Upsert contatto in ActiveCampaign (email, nome, telefono)
2. Applica il tag **`lancio26-candidato`** (da creare in AC — NON usare `lancio26-cliente`, quello è riservato a chi compra)
3. Salva età/livello/difficoltà come nota o campi custom sul contatto (il coach li legge prima della chiamata)
4. Notifica interna ad Antonio (email o webhook) con i dati della candidatura
5. Se AC non risponde: salvare comunque la submission in locale/log — una candidatura non si perde mai

Env: stesse `ACTIVECAMPAIGN_API_KEY` / `ACTIVECAMPAIGN_BASE_URL` già previste per il deploy Vercel.

## 6. Stato "candidature chiuse"

Flag/env `CANDIDATURE_APERTE` (default true). A false: form nascosto, messaggio: «Le candidature per settembre sono chiuse. Lascia l'email: ti avvisiamo quando riapriamo per ottobre.» (campo email singolo → tag `lancio26-lista-attesa`, da creare). P5 dice "chiudo le candidature": la pagina deve poter mantenere la promessa.

## 7. Extra

- Preservare i parametri UTM in ingresso e passarli alla submission (per capire da quale email arriva la candidatura)
- Zero dipendenze esterne pesanti: la pagina deve aprirsi in <2s da mobile

**Quando è online:** comunicare l'URL definitivo → va sostituito il placeholder `[LINK PAGINA CANDIDATURA]` nelle campagne AC 33, 35, 37, 39 (P-Presenti) e 41, 43, 45, 49 (P-Assenti).
