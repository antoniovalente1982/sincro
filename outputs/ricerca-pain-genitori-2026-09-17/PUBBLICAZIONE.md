# Advertorial — Pochi minuti: pubblicazione

Verifica completata il 17 settembre 2026 alle 18:50 circa, Europe/Rome.

- Pagina pubblica: https://landing.metodosincro.com/f/pochi-minuti
- Gestionale: https://landing.metodosincro.com/dashboard/funnels
- Nome nel Funnel: **Advertorial — Pochi minuti**.
- Stato verificato nell’interfaccia: **Attivo**.
- Commit pubblicato: `3ee94e25c5978b3574613e9f7353d928dfe6455e`.
- Vercel: stato **success** per il commit, [rilascio](https://vercel.com/antonio-personales-projects/adpilotik/6P3HN5ondG3DKdDYzEhuAxC2TPrc).

## Verifiche

Build di produzione, ESLint mirato e tre test del collegamento alla consulenza superati. Revisione desktop e mobile completata a 1365×900 e 390×844, senza overflow orizzontale. Revisione indipendente del contenuto e delle schermate conclusa senza rilievi materiali.

La pagina in produzione è stata aperta con `?ab=A` per disabilitare le visite di verifica. Titolo, sottotitolo, articolo, fotografia e CTA presenti. Il clic su “Richiedi una consulenza gratuita” ha aperto `/f/salto-di-qualita?entry=advertorial-pochi-minuti&ab=A#ms-form`, con modulo di consulenza visibile. Non è stato inviato un contatto di prova.

## Gestione e misurazione

Titolo, sottotitolo e testo del pulsante si modificano dalle impostazioni del Funnel. Il corpo dell’articolo si trova in `app/f/pochi-minuti/content.json` e richiede un rilascio per le modifiche.

Le visite dell’articolo sono collegate al nuovo Funnel attraverso il tracciamento esistente. Le richieste inviate dal modulo rimangono attribuite al Funnel di destinazione `salto-di-qualita`. Il passaggio conserva i parametri di campagna ammessi; `entry=advertorial-pochi-minuti` identifica la provenienza nel link ma non aggiunge un report di conversione dedicato. Consegna degli eventi a Meta e incremento delle conversioni non verificati da questa pubblicazione.

Le campagne e le inserzioni non sono state modificate. Per usare l’articolo in una campagna, la destinazione pubblica è il link senza `ab=A`.

Documentazione implementativa: [docs/advertorial-pochi-minuti.md](../../docs/advertorial-pochi-minuti.md).

## Aggiornamento immagini e target — 17 settembre 2026

Su precisazione di Antonio, target prioritario allineato ai genitori di calciatori di **16–18 anni** nel gestionale e nell’articolo. Immagine principale sostituita e seconda scena aggiunta nella sezione dedicata al genitore. Entrambe generate con image_gen per rappresentare un ragazzo di circa 17 anni e identificate come illustrative AI.

Commit `eaac02083e3c3f6800d18cea5c01e19a25146324`; [rilascio Vercel](https://vercel.com/antonio-personales-projects/adpilotik/CsvzMiJoQMKFGmbQJe9ar9pUx33v) completato con stato success. Build, lint e verifica visiva desktop/mobile superati. Dopo il rilascio, confermati nel browser di produzione il nuovo sottotitolo, il riferimento 16–18 anni, l’introduzione e il caricamento di entrambe le immagini. Stesso URL pubblico.

[File, prompt e verifiche delle immagini](IMMAGINI_16_18.md).
