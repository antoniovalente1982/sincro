# Contratto di impaginazione e verifica

Richiesta: creare nel gestionale, sezione Funnel, l’advertorial già scritto per i genitori dei calciatori. Il contenuto è in ADVERTORIAL_BOZZA.md, confermato dalla successiva richiesta di crearlo. Nome nel gestionale: Advertorial — Pochi minuti; slug pochi-minuti. Creazione verificata in stato Bozza.

## Direzione

THESIS: articolo del brand leggibile da telefono che conduce dal problema dei pochi minuti alla consulenza. Modalità Read con conclusione commerciale.

OWN-WORLD: fondo bianco per la lettura mobile anche all’aperto, inchiostro verde scuro, accento oro coerente con i materiali Sincro. Titoli Barlow Condensed Bold, testo Georgia, navigazione Arial. Fotografia illustrativa già presente nel progetto, senza presentarla come un cliente.

STORY: riconoscere un episodio sportivo; capire il lavoro individuale; accedere alla consulenza gratuita. Percorso a pagamento esplicito. Nessuna promessa di ingaggio o promozione.

FIRST VIEWPORT: marchio testuale, titolo e introduzione affiancati all’immagine su desktop; colonna unica su mobile. Autore reale e natura promozionale visibili. Indice desktop; accesso all’articolo e alla conclusione tramite ancore.

FORM: estensione editoriale della proposta e del testo richiesti; nessun cambiamento alle campagne. Corpo copiato dalla bozza tramite struttura JSON, note interne escluse. Interazione principale: indice e link che conserva UTM/fbclid verso il modulo esistente.

FINISH: verifica visiva desktop/mobile, test collegamenti, build, creazione e stato Funnel verificati; documentazione del risultato. Il controllo non è una misura di conversione.

## Evidenza

- Screenshot desktop.png: 1365×900, pagina intera.
- Screenshot mobile.png: 390×844, pagina intera.
- Immagine presente e caricata; nessun overflow orizzontale alle due larghezze.
- Link destinazione include UTM e entry, più ab=A durante anteprima (non registra visite).
- Build produzione riuscita. ESLint sui nuovi file e tre test comportamento link passati.
- Il detector segnala Arial e border-top 3px come preferenze stilistiche: Arial è usato per interfaccia e metadati di una pagina Read; la sezione con border-top è rettangolare, senza border-radius. Valutare sull’immagine, non applicare modifiche ad altri componenti.
- Anteprima locale usa una fixture in /private/tmp e non tocca il database. Le icone Next visibili negli screenshot sono solo del server di sviluppo.

## Origine asset

- public/landing-luglio/img-bench.jpg: asset preesistente dell’utente, riutilizzato senza modifiche; origine precedente non verificata. Didascalia “Immagine illustrativa”.
- public/fonts/barlow-condensed-bold.ttf: Google Fonts, https://raw.githubusercontent.com/google/fonts/main/ofl/barlowcondensed/BarlowCondensed-Bold.ttf. Licenza OFL salvata insieme al font.

Confine di scrittura del task: app/f/pochi-minuti/, lib/advertorial.ts e relativo test, public/fonts/barlow-condensed*, documentazione dedicata. La modifica già presente e staged in app/api/settings/route.ts appartiene ad altro lavoro e va preservata.
