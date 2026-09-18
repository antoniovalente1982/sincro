---
name: Dentro la partita — Metodo Sincro
description: Template advertorial V3 scelto da Antonio il 18 settembre 2026.
colors:
  paper: "#fffefb"
  ink: "#20231f"
  muted: "#5c625a"
  accent: "#92501f"
  rule: "#d9dbd4"
  action: "#254432"
  action-hover: "#163222"
  action-text: "#fff"
  consultation-surface: "#eef1e8"
  disclosure-surface: "#eff0eb"
  disclosure-text: "#4e554c"
  supporting-text: "#50584d"
  quotation: "#77421b"
  selection: "#f4dbb5"
  dashboard-action: "#2d3e2b"
  dashboard-focus: "#a23a29"
typography:
  masthead:
    fontFamily: "'Sincro Editorial', sans-serif"
    fontSize: "48px"
    fontWeight: 700
    lineHeight: 1
    letterSpacing: "-.02em"
  article-title:
    fontFamily: "'Sincro News', Georgia, serif"
    fontSize: "clamp(36px, 3.6vw, 49px)"
    fontWeight: 700
    lineHeight: 1.14
    letterSpacing: "-.025em"
  section-title:
    fontFamily: "'Sincro News', Georgia, serif"
    fontSize: "31px"
    fontWeight: 700
    lineHeight: 1.23
    letterSpacing: "-.018em"
  article-body:
    fontFamily: "Georgia, 'Times New Roman', serif"
    fontSize: "19px"
    fontWeight: 400
    lineHeight: 1.75
  article-dek:
    fontFamily: "Arial, sans-serif"
    fontSize: "18px"
    lineHeight: 1.65
  editorial-utility:
    fontFamily: "Arial, sans-serif"
    fontSize: "12px"
    lineHeight: 1.65
  button-primary:
    fontFamily: "Arial, sans-serif"
    fontSize: "16px"
    fontWeight: 700
    lineHeight: 1.4
rounded:
  advertorial-action: "3px"
  author-avatar: "50%"
  dashboard-button: "7px"
  dashboard-input: "6px"
spacing:
  paragraph: "21px"
  section: "33px"
  figure: "30px"
  mobile-gutter: "20px"
  column-gap: "72px"
components:
  button-primary:
    backgroundColor: "{colors.action}"
    textColor: "{colors.action-text}"
    typography: "{typography.button-primary}"
    rounded: "{rounded.advertorial-action}"
    padding: "16px 24px"
  button-primary-hover:
    backgroundColor: "{colors.action-hover}"
  consultation:
    backgroundColor: "{colors.consultation-surface}"
    textColor: "{colors.ink}"
    padding: "31px"
  disclosure:
    backgroundColor: "{colors.disclosure-surface}"
    textColor: "{colors.disclosure-text}"
    padding: "7px 20px"
---

# Design System: Dentro la partita

## Overview

**Creative North Star: "Il modello advertorial V3 di Dentro la partita"**

Il 18 settembre 2026 Antonio ha scelto come riferimento visuale `/f/pochi-minuti/anteprima`. Questa decisione **supera la precedente direzione grafica del Blog**, con accento rosso, testata serif e homepage di rivista. Tutte le pagine advertorial condividono il modello V3: carta quasi bianca, testata condensata, titoli Source Serif, corpo Georgia, righe sottili e azioni verdi. Il riferimento è un'implementazione esistente, da riusare senza reinterpretazioni.

La superficie pubblica è **Persuade**, con lettura lunga e progressione verso la consulenza. Il Blog nel gestionale è **Operate**: raccolta, editor, stati e azioni mantengono le convenzioni dell'app. Il collegamento pubblico `/blog` apre direttamente un advertorial; non è una homepage editoriale. La cornice dichiara firma Metodo Sincro e natura pubblicitaria.

Fonti: `app/f/pochi-minuti/advertorial.module.css`, `components/advertorial/AdvertorialFrame.tsx`, `app/blog/BlogViews.tsx` e `app/(dashboard)/dashboard/blog/blog-admin.module.css`. Piano: `docs/superpowers/plans/2026-09-18-template-unico-advertorial.md`. Questo documento registra il codice e la direzione scelta; non certifica rilascio o indicizzazione.

**Key Characteristics:**

- Un'unica cornice advertorial condivisa tra V3 e contenuti gestiti dal Blog.
- Gerarchia distinta tra testata, titoli, lettura e informazioni di servizio.
- Impaginazione piatta, fotografie nel flusso e autore laterale su desktop.
- CTA verdi, firma e trasparenza commerciale visibili anche su mobile.

## Colors

I valori normativi sono nel frontmatter. Nel CSS pubblico `--paper`, `--ink`, `--muted`, `--accent` e `--rule` corrispondono ai token omonimi.

### Primary

- **Action / Action Hover:** verde del pulsante consulenza e dei collegamenti alle prove; fondo più scuro al passaggio del puntatore, testo bianco.
- **Accent:** marrone di focus e frecce della sequenza. **Quotation** distingue citazioni e frasi estratte.

### Neutral

- **Paper / Ink:** fondo continuo della pagina e testo principale.
- **Muted / Supporting Text:** metadati, didascalie, sottotitolo e note a margine.
- **Rule:** separatori di firma, edizione, contenuti di supporto e footer.
- **Consultation Surface:** blocco finale con bordo superiore verde.
- **Disclosure Surface / Disclosure Text:** fascia pubblicitaria o di anteprima.
- **Selection:** evidenziazione del testo selezionato, con testo in inchiostro.

Il gestionale conserva `--text-primary`, `--text-secondary`, `--text-muted`, `--bg-card`, `--bg-secondary` e `--border-color`, con i fallback presenti nel suo CSS. I token `dashboard-action` e `dashboard-focus` appartengono soltanto a quella superficie.

## Typography

**Testata:** Barlow Condensed Bold, alias CSS `Sincro Editorial`, da `/fonts/barlow-condensed-bold.ttf`; serve anche il nome dell'autore laterale.

**Titoli:** Source Serif 4, alias CSS `Sincro News`, da `/fonts/source-serif-4.woff2`, pesi 400–700 e fallback Georgia. Entrambi i font locali usano `font-display: swap`.

**Corpo:** Georgia, fallback Times New Roman. Arial accompagna sottotitolo, firma, metadati, didascalie, dimostrazioni, pulsanti e footer: è una scelta del riferimento approvato, non un errore del detector. La dashboard eredita il font dell'app.

La gerarchia desktop è nel frontmatter. Il primo paragrafo dell'apertura usa peso 700 a 23 px/1,5. Le citazioni usano Source Serif 600 a 30 px/1,35. Nei contenuti dell'editor i titoli di terzo livello usano Source Serif 700 a 21 px/1,4; le regole del contenuto scritto sono limitate a `authored` per preservare diagrammi e FAQ della V3.

## Layout

Testata, edizione, contenuto e footer hanno larghezza massima 1120 px. La griglia desktop usa `minmax(0, 760px) 240px`, distanza 72 px e padding verticale 38 px sopra e 76 px sotto. La colonna laterale contiene ritratto, autore, nota contestuale e disclosure.

La testata termina con un bordo da 3 px; l'edizione con una riga sottile. Titolo, sottotitolo, firma con avatar e fotografia precedono il corpo. Il ritmo dipende dai margini dei paragrafi e dalla distanza tra sezioni, senza schede ripetute.

| Viewport | Comportamento del template |
| --- | --- |
| Fino a 1220 px | Margini esterni 32 px; griglia `minmax(0, 1fr) 210px`, distanza 44 px. |
| Fino a 900 px | Una colonna, massimo 740 px, centrata con padding laterale 24 px; autore laterale nascosto; titolo 43 px. |
| Fino a 600 px | Margini di testata, edizione e footer 20 px; contenuto con padding `25px 20px 44px`; testata 36 px; titolo `clamp(30px, 8.2vw, 39px)`/1,18; corpo 18 px/1,75; titoli di sezione 27 px. |

Su mobile l'apertura passa a 21 px e i margini tra paragrafi a 19 px. La foto principale passa dal rapporto 1,95 a 1,5; sequenza e confronto diventano verticali; CTA intermedia a tutta larghezza. La consulenza finale usa padding `26px 20px` e margini laterali negativi di 20 px. Il footer diventa verticale. Firma e disclosure restano presenti quando la colonna autore scompare.

La raccolta gestionale resta entro 1450 px. L'editor affianca il contenuto a impostazioni da 310 px, distanza 45 px. A 1100 px le impostazioni diventano 270 px e la distanza 25 px; a 720 px passano sotto il testo, con padding esterno laterale 16 px. Questi breakpoint appartengono alla dashboard.

## Elevation & Depth

Il template advertorial non usa ombre. Gerarchia e profondità derivano da tipografia, righe e superfici tenui. Non aggiungere effetti del gestionale alla cornice pubblica.

La CTA usa la transizione `background-color .18s ease`, rimossa con `prefers-reduced-motion: reduce`. Il template non applica ingrandimenti alle fotografie al passaggio del puntatore.

## Shapes

Fotografie, citazioni e blocchi editoriali sono rettangolari. L'avatar nella firma è circolare, 44 px su desktop e 38 px fino a 600 px; il ritratto laterale è quadrato. Le CTA hanno angoli appena arrotondati secondo `advertorial-action`.

La dashboard mantiene pulsanti e campi con i propri raggi, etichette di stato da 3 px e separatori sottili tra le righe.

## Components

### Cornice condivisa

`AdvertorialFrame` contiene salto all'articolo, disclosure, testata, edizione, griglia con autore e footer aziendale. Il collegamento della testata usa per default `#inizio`; `/blog` resta l'ingresso pubblico che reindirizza all'advertorial. `AdvertorialHeader` definisce titolo, sottotitolo, firma, data, tempo di lettura e fotografia. Contenuti Blog e anteprime riusano cornice e CSS della V3.

### Azioni e consulenza

`ConsultationLink` è una CTA verde con freccia, altezza minima 56 px e distanza interna 15 px. La CTA intermedia vive tra due righe sottili; quella finale in una superficie tenue con bordo superiore verde da 3 px. Il testo distingue primo confronto gratuito e percorso a pagamento.

I collegamenti hanno focus marrone da 3 px, distanziato 5 px. Al passaggio del puntatore il pulsante cambia fondo. Su mobile usa testo 15 px e padding 16 px.

### Lettura e immagini

Fotografie e didascalie restano nel flusso. Citazioni delimitate sopra e sotto sostituiscono la riga verticale del precedente Blog. Sequenza e confronto della V3 mantengono il proprio impianto. I correlati, se presenti, sono collegamenti testuali separati da una riga.

### Anteprima e raccolta

L'anteprima conserva la cornice e indica «Anteprima · Advertorial non pubblicato» nella fascia superiore. Nell'editor, salvataggio, pubblicazione e ritiro rimangono azioni distinte. Avvisi, campi, badge e tab seguono il CSS gestionale; gli stati sono espressi anche con testo.

## Do's and Don'ts

### Do:

- **Do** riusare cornice, font e CSS della V3 scelta il 18 settembre 2026 per tutte le pagine advertorial.
- **Do** mantenere Barlow Condensed per la testata, Source Serif per i titoli e Georgia per il corpo.
- **Do** conservare firma Metodo Sincro, disclosure e distinzione tra consulenza gratuita e percorso a pagamento.
- **Do** mantenere lo stesso template nelle anteprime, con stato di anteprima esplicito.
- **Do** distinguere Persuade nell'advertorial e Operate nella raccolta gestionale.

### Don't:

- **Don't** ripristinare accento rosso, testata serif e homepage di rivista del precedente Blog: la scelta di Antonio li supera.
- **Don't** creare un secondo sistema di stili per gli advertorial gestiti dal Blog.
- **Don't** trasferire carte, ombre, gradienti o densità del gestionale alle pagine di lettura.
- **Don't** presentare bozze, anteprime o simulazioni SEO come pubblicazioni o risultati Google verificati.
