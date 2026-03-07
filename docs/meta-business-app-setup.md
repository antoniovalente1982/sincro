# Guida Step-by-Step: Creare la Meta Business App

Questa guida ti spiega come creare l'app Meta necessaria per collegare la piattaforma Sincro alle API di Meta (Ads + CAPI).

## Prerequisiti
- Account Facebook personale
- Accesso a Meta Business Manager
- Account pubblicitario: `511099830249139`

---

## Step 1: Vai su Meta for Developers

1. Apri [developers.facebook.com](https://developers.facebook.com)
2. Se non hai un account developer, clicca **"Inizia"** e segui la registrazione
3. Accetta i termini d'uso

## Step 2: Crea una Nuova App

1. Clicca **"Le mie app"** in alto a destra
2. Clicca **"Crea app"**
3. Seleziona il tipo di app: **"Business"**
4. Compila i dettagli:
   - **Nome app**: `Metodo Sincro Platform`
   - **E-mail di contatto**: la tua email business
   - **Account Business Manager**: seleziona il tuo BM
5. Clicca **"Crea app"**

## Step 3: Aggiungi il Prodotto "Marketing API"

1. Nella dashboard dell'app, vai su **"Aggiungi prodotto"**
2. Cerca **"Marketing API"** e clicca **"Configura"**
3. Questo ti dà accesso a:
   - Lettura/creazione campagne
   - Insights (dati performance)
   - Regole automatiche
   - Gestione pubblici

## Step 4: Aggiungi il Prodotto "Conversions API" (CAPI)

1. Torna su **"Aggiungi prodotto"**
2. Cerca **"Conversions API"** e clicca **"Configura"**
3. Questo ti permette di inviare eventi server-side a Meta

## Step 5: Genera il System User Token (IMPORTANTE)

Il Token personale scade. Per un'app in produzione serve un **System User Token**.

1. Vai su [business.facebook.com/settings](https://business.facebook.com/settings)
2. Nel menu a sinistra: **Utenti** → **Utenti di sistema**
3. Clicca **"Aggiungi"**
   - Nome: `sincro-platform`
   - Ruolo: **Admin**
4. Clicca sull'utente appena creato → **"Genera nuovo token"**
5. Seleziona l'app `Metodo Sincro Platform`
6. Permessi necessari:
   - `ads_management`
   - `ads_read`
   - `business_management`
   - `pages_read_engagement`
7. Clicca **"Genera token"**
8. **⚠️ COPIA IL TOKEN E SALVALO** — non lo vedrai più!

## Step 6: Genera il Token CAPI (per Conversions API)

1. Vai su [Meta Events Manager](https://business.facebook.com/events_manager2)
2. Seleziona il tuo Pixel
3. Tab **"Impostazioni"**
4. Scorri fino a **"Conversions API"**
5. Clicca **"Genera access token"**
6. **⚠️ COPIA IL TOKEN E SALVALO**

> **Nota**: Se hai già un Access Token CAPI funzionante, puoi riutilizzarlo.
> Il Pixel ID resta lo stesso. Non devi ricrearlo.

## Step 7: Dammi queste informazioni

Dopo aver completato i passaggi, inviami:

| Info | Dove trovarla |
|---|---|
| **App ID** | Dashboard app → Impostazioni → Generali |
| **App Secret** | Dashboard app → Impostazioni → Generali → Mostra |
| **System User Token** | Step 5 sopra |
| **CAPI Access Token** | Step 6 sopra (o quello che hai già) |
| **Pixel ID** | Events Manager → il tuo Pixel → ID |
| **Ad Account ID** | Già fornito: `511099830249139` ✅ |

## Step 8: Modalità di Sviluppo vs Produzione

L'app parte in **modalità sviluppo** (solo tu puoi usarla). Questo va benissimo per iniziare.

Quando siamo pronti per la produzione:
1. Vai su **Revisione app** nella dashboard
2. Richiedi le autorizzazioni necessarie
3. Meta approverà in pochi giorni

---

## Domande frequenti

**Devo ricreare il Pixel?**
No. Il tuo Pixel ID esistente funziona perfettamente. Lo usiamo com'è.

**Il token CAPI che ho già funziona?**
Probabilmente sì. Se è stato generato per il tuo Pixel via Events Manager, è ancora valido. Provami a mandarlo e lo verifico.

**Costa qualcosa?**
No. L'accesso alle API Meta è gratuito. Paghi solo il budget ads come sempre.
