---
name: Dentro la partita — Metodo Sincro
description: Estensione editoriale del progetto esistente e area Blog nel gestionale.
colors:
  paper: "#faf8f3"
  ink: "#222620"
  editorial-red: "#a33123"
  secondary-text: "#52594f"
  rule: "#c9c9bf"
  consultation-surface: "#f0eee5"
  preview-surface: "#efe0bd"
  dashboard-action: "#2d3e2b"
typography:
  article-body:
    fontFamily: "BlogSerif, Georgia, serif"
    fontSize: "21px"
    fontWeight: 400
    lineHeight: 1.75
  article-title:
    fontFamily: "BlogSerif, Georgia, serif"
    fontSize: "clamp(35px, 4vw, 55px)"
    fontWeight: 600
    lineHeight: 1.09
  editorial-utility:
    fontFamily: "Arial, sans-serif"
rounded:
  dashboard-button: "7px"
  dashboard-input: "6px"
---

# Design System: Dentro la partita

## Overview

«Dentro la partita», a firma Metodo Sincro, estende il linguaggio editoriale dell’advertorial V3: testata, tipografia da lettura, fotografie nel flusso e separatori sottili. Il Blog introduce i propri token carta/inchiostro/rosso; questo documento non sostituisce la palette dell’advertorial o l’identità del gestionale.

Fonti implementate: `app/blog/blog.module.css`, `app/blog/BlogViews.tsx` e `app/(dashboard)/dashboard/blog/blog-admin.module.css`. Il documento descrive il codice locale, senza attestare pubblicazione o indicizzazione.

## Colors

Nel Blog, `--paper` e `--ink` definiscono fondo e testo. `--red` evidenzia rubriche, collegamenti nel testo, citazioni e consulenza. Testi secondari e righe restano attenuati; la consulenza usa una superficie appena più scura della carta.

Il gestionale conserva `--text-primary`, `--text-secondary`, `--text-muted`, `--bg-card`, `--bg-secondary` e `--border-color`, con i fallback presenti nel CSS. Non estendere la carta del Blog alla dashboard. Le azioni principali del suo editor usano verde `#2d3e2b`; focus e tab selezionata usano `#a23a29`.

## Typography

`BlogSerif` carica Source Serif 4 da `/fonts/source-serif-4.woff2`, pesi 200–900, con `font-display: swap` e fallback Georgia. Serve testata, titoli e corpo degli articoli. Il corpo è 21 px/1,75; i sottotitoli principali sono 31 px. Arial accompagna navigazione, didascalie, metadati e pulsanti. Il gestionale eredita il carattere dell’app; il testo nell’editor è 16 px/1,8.

## Layout

Archivio entro 1180 px: apertura e articolo in evidenza su due colonne, altri articoli su tre. Pagina articolo entro 1120 px: testo fino a 770 px, colonna autore di 220 px e distanza di 70 px. Il gestionale arriva a 1450 px, con editor e impostazioni da 310 px.

A 1000 px il Blog riduce spazi e colonna laterale, e l’archivio passa a due colonne. A 720 px usa una colonna e margini laterali di 20 px, nasconde la colonna autore, porta il corpo a 20 px/1,7 e allarga il pulsante consulenza. La firma resta nel testo dell’articolo e nel footer. Il gestionale si adatta a 1100 e 720 px: toolbar a capo, azioni flessibili, impostazioni sotto al testo e padding laterale di 16 px su mobile.

## Elevation & Depth

Superfici piatte, distinte da righe e variazioni di fondo. Le ombre non costruiscono la gerarchia del Blog. L’immagine in evidenza ha un lieve ingrandimento al passaggio del puntatore, disattivato con `prefers-reduced-motion`.

## Shapes

Il Blog usa immagini e blocchi editoriali rettangolari. Il gestionale mantiene angoli contenuti: pulsanti da 7 px, campi da 6 px, etichette di stato da 3 px. Le righe degli articoli sono separate da bordi sottili.

## Components

- **Firma e trasparenza:** «A cura di Metodo Sincro» accompagna gli articoli; il footer chiarisce che i contenuti possono presentare i percorsi del brand. Il primo contatto gratuito è distinto dal successivo percorso a pagamento. Le immagini illustrative generate con AI sono indicate nelle descrizioni disponibili.
- **Consulenza:** fondo tenue, riga superiore scura e azione rossa. Il gestionale separa salvataggio, pubblicazione e ritiro; i campi sono disabilitati durante il salvataggio.
- **Anteprima:** fascia color sabbia nel Blog, avviso verde tenue nel gestionale. Le anteprime dimostrative dichiarano contenuti di esempio e salvataggio/pubblicazione disabilitati. Gli stati di errore usano testo esplicito e superficie chiara color pesca.
- **Accessibilità:** collegamento per saltare al contenuto, focus visibile da 3 px e stato espresso anche attraverso etichette testuali.

## Do's and Don'ts

- Conservare il rapporto con la V3 e le convenzioni operative del gestionale; estendere queste superfici senza introdurre una nuova identità.
- Mantenere visibili autore, natura commerciale dei percorsi e distinzione tra bozza, anteprima e contenuto pubblicato.
- La riga sinistra delle citazioni e Arial per le funzioni di servizio sono convenzioni deliberate dell’impianto editoriale: gli avvisi meccanici del detector non richiedono di sostituirle.
- Non presentare le simulazioni SEO come risultati di Google o le anteprime locali come pagine già pubblicate.
