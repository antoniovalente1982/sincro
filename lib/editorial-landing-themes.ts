export interface EditorialTheme {
    label: string
    problem: string
    cost: string
    signals: { title: string; desc: string }[]
    work: string
    skills: { title: string; desc: string }[]
    faq: { q: string; a: string }
    closing: string
}

const fiducia: EditorialTheme = {
    label: 'Fiducia e risposta all’errore',
    problem: 'Un errore può durare un’azione. O restargli in testa per tutta la partita.',
    cost: 'Se dopo ogni errore smette di proporsi, le occasioni per ritrovare fiducia possono ridursi. Ripetere «non pensarci» rischia di lasciare intatto proprio il passaggio che gli serve allenare.',
    signals: [
        { title: 'Si nasconde dopo un errore', desc: 'Prima chiedeva palla. Dopo un passaggio sbagliato cerca di non farsi vedere.' },
        { title: 'In allenamento è diverso', desc: 'Le qualità si vedono, ma in partita sembra preoccupato delle conseguenze di ogni scelta.' },
        { title: 'Si giudica per una giocata', desc: 'Un episodio diventa «non sono capace», anche quando il resto della partita racconta altro.' },
    ],
    work: 'Allenare il ritorno alla prossima azione.',
    skills: [
        { title: 'Attenzione sul gioco', desc: 'Riconoscere quando resta sull’errore e riportare il focus su un compito concreto.' },
        { title: 'Dialogo interno', desc: 'Lavorare sulle parole che usa con sé stesso nei momenti di difficoltà.' },
        { title: 'Fiducia nelle scelte', desc: 'Allenare la disponibilità a proporsi e decidere anche senza la certezza di riuscire.' },
    ],
    faq: { q: 'Basta dirgli di avere più fiducia?', a: 'Un incoraggiamento può aiutarlo a sentirsi sostenuto. Il lavoro mentale riguarda anche cosa fare concretamente quando arriva un errore: attenzione, parole che rivolge a sé stesso e risposta nell’azione successiva.' },
    closing: 'La prossima partita merita un passo diverso dal solito «stai tranquillo».',
}
const panchina: EditorialTheme = {
    label: 'Panchina e poco spazio',
    problem: 'La panchina finisce al fischio finale. Il dubbio può seguirlo fino a casa.',
    cost: 'Un’altra settimana a chiedersi se restare o cambiare squadra può portare a decisioni affrettate e discussioni ripetute. Prima di scegliere, serve capire cosa dipende dal contesto e come tuo figlio sta vivendo questo momento.',
    signals: [
        { title: 'Entra con la fretta di dimostrare', desc: 'Pochi minuti sembrano l’unica occasione per meritarsi il posto.' },
        { title: 'Porta la delusione a casa', desc: 'Dopo la partita si chiude, si svaluta o non vuole più parlarne.' },
        { title: 'Il cambio di squadra diventa l’unica idea', desc: 'State valutando di spostarvi senza aver chiarito le ragioni del poco impiego.' },
    ],
    work: 'Lavorare su ciò che può allenare, anche quando lo spazio è poco.',
    skills: [
        { title: 'Prepararsi al proprio momento', desc: 'Allenare attenzione e gestione della pressione prima di entrare in campo.' },
        { title: 'Reagire alla delusione', desc: 'Lavorare su come affrontare una scelta del mister senza farne un giudizio sul proprio valore.' },
        { title: 'Distinguere ciò che dipende da lui', desc: 'Definire obiettivi personali concreti, tenendo separate le scelte dell’allenatore.' },
    ],
    faq: { q: 'Il coaching può garantirgli più minuti o il posto da titolare?', a: 'No. Formazione e minutaggio dipendono dall’allenatore e dal contesto sportivo. Il coaching può lavorare sulla preparazione mentale, sulla risposta alla delusione e su come affronta le opportunità che riceve.' },
    closing: 'Prima di un’altra decisione sulla squadra, facciamo il punto sulla sua situazione.',
}
const crescita: EditorialTheme = {
    label: 'Crescita e nuova categoria',
    problem: 'È cambiato il livello. Ora deve trovare il proprio modo di starci dentro.',
    cost: 'Confrontarsi ogni giorno con compagni più pronti può trasformare una nuova opportunità in una continua prova del proprio valore. Se il dubbio resta senza spazio, anche chiedere aiuto può diventare più difficile.',
    signals: [
        { title: 'Si sente indietro', desc: 'Il confronto con i nuovi compagni pesa più dei progressi che sta facendo.' },
        { title: 'Gioca per non sbagliare', desc: 'Cerca soltanto soluzioni sicure, anche quando potrebbe esprimere le sue qualità.' },
        { title: 'Non si riconosce più', desc: 'Nella squadra precedente era sicuro di sé. Ora mette in discussione il proprio posto.' },
    ],
    work: 'Costruire riferimenti personali nel nuovo contesto.',
    skills: [
        { title: 'Obiettivi realistici', desc: 'Tradurre una sfida più grande in comportamenti su cui lavorare una settimana alla volta.' },
        { title: 'Gestire il confronto', desc: 'Usare le informazioni sui compagni senza trasformarle in una sentenza su di sé.' },
        { title: 'Affrontare la novità', desc: 'Allenare concentrazione, fiducia nelle proprie scelte e disponibilità a imparare.' },
    ],
    faq: { q: 'Se prima andava bene, perché ora ha bisogno di un confronto?', a: 'Un contesto nuovo può richiedere un adattamento. Il primo passo è capire cosa è cambiato: richieste tecniche, ritmo, relazioni e aspettative. Da lì si valuta se e dove un lavoro mentale può essere pertinente.' },
    closing: 'La nuova categoria è già iniziata. Partiamo da come la sta vivendo.',
}
const genitori: EditorialTheme = {
    label: 'Dialogo e ruolo del genitore',
    problem: 'Vuoi aiutarlo. Ma le parole giuste sembrano non arrivare mai.',
    cost: 'Quando ogni partita riapre la stessa discussione, il calcio può occupare anche i momenti che dovrebbero unirvi. Continuare a dare consigli senza capire come vengono ricevuti può rendere più difficile il dialogo.',
    signals: [
        { title: 'Ogni consiglio diventa una discussione', desc: 'Provi a incoraggiarlo, ma lui sente una critica o cambia subito argomento.' },
        { title: 'Non sai quando parlare', desc: 'In macchina o a tavola, temi sia il silenzio sia la domanda sbagliata.' },
        { title: 'Ti senti responsabile di tutto', desc: 'Ti chiedi se essere più presente, lasciarlo stare o intervenire con il mister.' },
    ],
    work: 'Chiarire il tuo ruolo, partendo da una situazione concreta.',
    skills: [
        { title: 'Ascoltare prima del consiglio', desc: 'Capire quali domande aprono il dialogo e quali possono essere vissute come pressione.' },
        { title: 'Separare i ruoli', desc: 'Distinguere il sostegno del genitore dalle indicazioni tecniche dell’allenatore.' },
        { title: 'Coinvolgere il ragazzo', desc: 'Costruire un eventuale percorso tenendo conto di ciò che desidera e della sua disponibilità.' },
    ],
    faq: { q: 'Il primo incontro è per me o per mio figlio?', a: 'Il primo confronto è con te, il genitore che sta valutando come aiutarlo. Partiamo dal tuo racconto. Per iniziare un eventuale percorso con il ragazzo serviranno anche la sua voce e la sua disponibilità.' },
    closing: 'La prossima conversazione può cominciare da una domanda diversa.',
}
const pressione: EditorialTheme = {
    label: 'Pressione prima e durante la partita',
    problem: 'La partita deve ancora iniziare. Lui sembra già sotto esame.',
    cost: 'Se ogni appuntamento diventa una prova da superare, la tensione può prendere spazio già nei giorni precedenti. Aspettare soltanto che passi lascia la famiglia a ripetere gli stessi tentativi senza una direzione condivisa.',
    signals: [
        { title: 'Pensa soprattutto a cosa può andare male', desc: 'Prima di giocare immagina il giudizio del mister o dei compagni.' },
        { title: 'Vuole controllare ogni dettaglio', desc: 'La ricerca della partita perfetta rende difficile accettare un imprevisto.' },
        { title: 'L’attesa pesa anche a casa', desc: 'L’umore e le conversazioni della famiglia girano intorno alla prossima gara.' },
    ],
    work: 'Preparare l’attenzione, oltre alla partita.',
    skills: [
        { title: 'Routine prima della gara', desc: 'Individuare azioni e riferimenti che aiutino a prepararsi con continuità.' },
        { title: 'Gestire le aspettative', desc: 'Distinguere il compito da affrontare dal bisogno di dimostrare tutto in una partita.' },
        { title: 'Tornare al presente', desc: 'Allenare l’attenzione su ciò che può fare, un’azione alla volta.' },
    ],
    faq: { q: 'Il lavoro mentale elimina la tensione?', a: 'L’obiettivo non è promettere che non sentirà più pressione, ma lavorare su come affrontarla nel suo contesto sportivo. Se il disagio è intenso o riguarda anche altre aree della vita, può servire una valutazione di un professionista sanitario.' },
    closing: 'Prima della prossima gara, iniziamo da ciò che sta succedendo adesso.',
}
const ripartenza: EditorialTheme = {
    label: 'Motivazione e ripartenza',
    problem: 'Continua ad andare al campo. Ma qualcosa nel suo rapporto con il calcio è cambiato.',
    cost: 'Spingerlo ad andare avanti senza ascoltarlo può aumentare la distanza. Anche decidere tutto nel momento della delusione rischia di lasciare domande aperte. Dare spazio a quello che vive aiuta a capire quale scelta approfondire.',
    signals: [
        { title: 'Si allena senza entusiasmo', desc: 'Fa quello che deve, ma raramente parla di ciò che gli piace ancora.' },
        { title: 'Dice di voler smettere', desc: 'Non sai se sta esprimendo una decisione o la fatica di questo periodo.' },
        { title: 'Un episodio ha cambiato tutto', desc: 'Una delusione o un cambiamento ha reso difficile ritrovare una direzione.' },
    ],
    work: 'Ripartire da ciò che conta per lui.',
    skills: [
        { title: 'Ascoltare le motivazioni', desc: 'Dare spazio a ciò che desidera oggi, anche quando è diverso da quello che immaginavate.' },
        { title: 'Affrontare la delusione', desc: 'Lavorare su come leggere un episodio difficile senza farlo coincidere con tutta la propria storia.' },
        { title: 'Scegliere obiettivi condivisi', desc: 'Valutare passi sostenibili e un eventuale percorso che il ragazzo voglia intraprendere.' },
    ],
    faq: { q: 'Il percorso serve a convincerlo a continuare?', a: 'No. Il ragazzo deve poter esprimere ciò che vuole. Nel primo confronto con il genitore si chiarisce la situazione; un eventuale lavoro con lui richiede la sua disponibilità e obiettivi che senta anche suoi.' },
    closing: 'Prima di decidere il suo futuro nel calcio, facciamo spazio alla sua situazione.',
}

export const EDITORIAL_THEMES: Record<string, EditorialTheme> = {
    fiducia, panchina, crescita, genitori, pressione, ripartenza,
    femminile: {
        label: 'Fiducia nel calcio femminile',
        problem: 'Ama il calcio. Ma quando sente di dover dimostrare di meritarsi il campo, si trattiene.',
        cost: 'Se ogni errore diventa una prova del fatto che «non è abbastanza», può iniziare a chiedere meno palla e a raccontare meno ciò che vive. Liquidare il suo impegno come un passatempo rischia di aggiungere distanza proprio quando cerca di essere presa sul serio.',
        signals: [
            { title: 'Si scusa per ogni errore', desc: 'Un passaggio sbagliato le rimane in testa più a lungo dell’azione.' },
            { title: 'In allenamento osa di più', desc: 'In partita sceglie di non rischiare, anche quando conosce bene la giocata.' },
            { title: 'Non vuole essere minimizzata', desc: 'Quando racconta una difficoltà, cerca ascolto per qualcosa che per lei conta.' },
        ],
        work: 'Prendere sul serio il suo calcio e allenare la fiducia nelle proprie scelte.',
        skills: [
            { title: 'Rispondere all’errore', desc: 'Riportare l’attenzione alla prossima azione invece di continuare a giudicarsi.' },
            { title: 'Esprimersi in campo', desc: 'Allenare la disponibilità a chiedere palla, decidere e prendersi uno spazio nel gioco.' },
            { title: 'Obiettivi che sente suoi', desc: 'Definire ciò su cui vuole lavorare, rispettando età, livello e desideri della ragazza.' },
        ],
        faq: { q: 'È adatto anche se mia figlia gioca in una squadra dilettantistica?', a: 'Sì, il primo confronto è aperto anche alle famiglie di giovani calciatrici delle squadre locali. Non serve un contratto, una selezione o un obiettivo da professionista. Valutiamo la sua situazione e se il percorso può essere pertinente.' },
        closing: 'Il suo calcio merita ascolto. Anche senza un futuro da professionista da dimostrare.',
    },
    infortunio: { ...ripartenza, label: 'Rientro dopo un infortunio', problem: 'Tornare disponibile e sentirsi pronto possono essere due passaggi diversi.', cost: 'Dopo uno stop può restare il timore di farsi male di nuovo. Forzare i tempi o leggere ogni esitazione come mancanza di carattere può rendere più difficile raccontare ciò che prova.', signals: [
        { title: 'Evita un contrasto', desc: 'Quando il rientro è autorizzato, alcune azioni continuano a farlo esitare.' },
        { title: 'Si confronta con il prima', desc: 'Ogni allenamento diventa una verifica di quanto manca al livello precedente.' },
        { title: 'Teme di perdere ancora spazio', desc: 'La fretta di rientrare si mescola alla paura di un altro stop.' },
    ], work: 'Accompagnare la preparazione mentale al rientro.', skills: [
        { title: 'Obiettivi compatibili con il recupero', desc: 'Lavorare entro i tempi e le indicazioni dei professionisti che seguono la riabilitazione.' },
        { title: 'Gestione del timore', desc: 'Riconoscere pensieri e aspettative che accompagnano il ritorno al gioco.' },
        { title: 'Fiducia nei passi successivi', desc: 'Spostare l’attenzione dal confronto con il passato ai compiti del momento.' },
    ], faq: { q: 'Il mental coach decide quando può rientrare?', a: 'No. Idoneità, riabilitazione e tempi di rientro spettano ai professionisti sanitari. Il lavoro mentale può affiancare il recupero, rispettandone le indicazioni, senza sostituirlo.' }, closing: 'Partiamo da come sta vivendo il rientro, rispettando i tempi del recupero.' },
    provino: { ...pressione, label: 'Provino e selezione', problem: 'Un provino è un’occasione. Non deve diventare il verdetto su tutto il suo futuro.', cost: 'Caricare ogni giorno di aspettative può rendere più difficile concentrarsi su ciò che sa fare. E dopo la selezione, leggere un sì o un no come un giudizio definitivo può pesare anche sulle scelte successive.', work: 'Prepararsi a una selezione senza dover dimostrare tutto.', faq: { q: 'Il coaching può garantire che superi il provino?', a: 'No. La selezione dipende da molti fattori e dalle scelte della società. Il lavoro mentale riguarda preparazione, attenzione e gestione dell’esito, qualunque esso sia.' }, closing: 'Il provino si avvicina. Partiamo da come lo sta vivendo.' },
    gruppo: { ...genitori, label: 'Inserimento nel gruppo', problem: 'Essere nella squadra non significa sentirsi parte del gruppo.', cost: 'Se smette di raccontare ciò che succede nello spogliatoio, può diventare difficile distinguere un normale adattamento da una situazione che richiede un intervento degli adulti. Liquidare tutto con «devi farti le ossa» rischia di chiudere il dialogo.', signals: [
        { title: 'Resta ai margini', desc: 'Parla poco dei compagni o sembra evitare i momenti di gruppo.' },
        { title: 'Non racconta cosa succede', desc: 'Alle domande sulla squadra risponde appena e cambia argomento.' },
        { title: 'Non sai con chi confrontarti', desc: 'Ti chiedi quando ascoltare, quando parlare con la società e come coinvolgerlo.' },
    ], work: 'Capire il contesto prima di attribuire tutto alla sua sicurezza.', faq: { q: 'E se ci sono esclusioni ripetute o umiliazioni?', a: 'Vanno prese sul serio e affrontate con gli adulti e i referenti competenti della società. Il coaching non sostituisce la tutela del ragazzo e non rende lui responsabile di comportamenti scorretti altrui.' }, closing: 'Prima di chiedergli di adattarsi, capiamo che cosa sta vivendo.' },
    fisico: { ...crescita, label: 'Confronto e crescita fisica', problem: 'Gli altri sono cresciuti. Lui può sentirsi rimasto indietro anche nel valore.', cost: 'Se ogni confronto fisico diventa «non sono abbastanza», rischia di perdere di vista le qualità che può continuare ad allenare. Aggiungere pressione ai tempi della crescita non gli dà un riferimento utile.', work: 'Separare il confronto fisico dal giudizio su di sé.', faq: { q: 'Il lavoro mentale può compensare la differenza fisica?', a: 'Non modifica tempi di crescita o caratteristiche fisiche. Può aiutare a gestire il confronto e a concentrarsi su obiettivi personali, insieme al lavoro tecnico e fisico seguito dai professionisti competenti.' }, closing: 'Aiutiamolo a vedere più del confronto con chi è cresciuto prima.' },
    carico: { ...genitori, label: 'Scuola, calcio e famiglia', problem: 'Se tutta la settimana gira intorno al calcio, anche il resto chiede spazio.', cost: 'Una settimana sempre piena può lasciare poco spazio per recuperare e parlarvi. Continuare ad aggiungere impegni senza chiarire le priorità rischia di far pesare anche un’attività che ama.', signals: [
        { title: 'Ogni impegno è una rincorsa', desc: 'Compiti, allenamenti e trasferte si incastrano con fatica.' },
        { title: 'Il calcio diventa terreno di scontro', desc: 'I voti o la stanchezza riaprono ogni volta la discussione sulla squadra.' },
        { title: 'La famiglia ha perso margine', desc: 'Vi sembra di poter scegliere solo tra sacrificare la scuola o sacrificare lo sport.' },
    ], work: 'Rimettere a fuoco priorità e impegni sostenibili.', faq: { q: 'Dobbiamo scegliere tra scuola e calcio?', a: 'Prima di arrivare a una scelta così netta, serve capire carico reale, recupero, organizzazione e desideri del ragazzo. Il confronto può aiutare a individuare cosa approfondire, senza promettere di risolvere ogni difficoltà con la motivazione.' }, closing: 'Facciamo il punto prima di riempire un’altra settimana.' },
    percorso: { ...fiducia, label: 'Valutare il mental coaching', problem: 'Prima di investire, vuoi capire come si lavora e se serve davvero a tuo figlio.', cost: 'Scegliere solo per una promessa o rimandare senza cercare informazioni lascia lo stesso dubbio. Un confronto concreto serve a chiarire obiettivi, impegno richiesto e pertinenza del percorso.', signals: [
        { title: 'Hai già provato altre strade', desc: 'Vuoi capire quale bisogno affronta il lavoro mentale e come si distingue dagli altri supporti.' },
        { title: 'Cerchi un metodo concreto', desc: 'Vuoi sapere chi lo segue, cosa si fa nelle sessioni e come si definiscono gli obiettivi.' },
        { title: 'Devi valutare l’investimento', desc: 'Tempi, costi e disponibilità di tuo figlio devono avere senso per la famiglia.' },
    ], work: 'Valutare il percorso a partire dalla sua situazione.', faq: { q: 'Dopo la consulenza sono obbligato ad acquistare?', a: 'No. Il primo confronto è gratuito e senza impegno. Se il percorso è pertinente, vengono presentati modalità, durata, prezzo e condizioni prima di decidere.' }, closing: 'Porta i tuoi dubbi. Il primo passo è capire se il percorso ha senso per voi.' },
    allenamento: { ...fiducia, label: 'Allenamento extra e resa in partita', problem: 'Si allena di più. Ma in partita sembra sempre trattenersi.', cost: 'Aggiungere altro lavoro senza capire dove nasce la difficoltà può aumentare impegno, costi e frustrazione. Il punto da approfondire è cosa cambia tra allenamento e gara.', work: 'Capire cosa cambia quando dall’allenamento passa alla partita.', faq: { q: 'Deve smettere di fare allenamenti extra?', a: 'Non si può stabilire da un articolo. Il lavoro tecnico ha una funzione diversa dal lavoro mentale. Prima di aggiungere o togliere attività, è utile chiarire gli obiettivi con chi lo segue e ascoltare il ragazzo.' }, closing: 'Prima di aggiungere un altro allenamento, capiamo il passaggio che manca.' },
    rifiuto: { ...genitori, label: 'Quando rifiuta un aiuto', problem: 'Gli proponi un aiuto. Lui sente che vuoi aggiustarlo.', cost: 'Insistere a convincerlo può trasformare il percorso in un’altra fonte di conflitto. Partire dal suo rifiuto come informazione, invece che come ostacolo da vincere, aiuta a capire cosa non gli torna.', work: 'Aprire un confronto senza forzare il ragazzo.', faq: { q: 'Posso fare il primo incontro anche se lui non vuole?', a: 'Puoi chiedere un confronto nel tuo ruolo di genitore. Questo non sostituisce la disponibilità di tuo figlio: un eventuale percorso con lui richiede il suo coinvolgimento, senza pressioni o iscrizioni a sua insaputa.' }, closing: 'Puoi cominciare tu, dal tuo modo di proporgli aiuto.' },
    nonconferma: { ...ripartenza, label: 'Mancata conferma in squadra', problem: 'La società ha detto no. Ora serve spazio per quello che questo no significa per lui.', cost: 'Cercare subito un’altra squadra può essere necessario, ma non sempre basta a elaborare la delusione. Se l’esclusione diventa «non valgo», quel pensiero può accompagnarlo anche nella prossima esperienza.', work: 'Separare una decisione della società dal proprio valore.', faq: { q: 'Il coaching aiuta a trovare una nuova squadra?', a: 'Metodo Sincro lavora sulla preparazione mentale e non offre attività di procuratore o garanzie di tesseramento. Il percorso può riguardare come affronta la delusione e si prepara a una nuova esperienza.' }, closing: 'Il prossimo capitolo comincia anche da come attraversa questa delusione.' },
}

export const EDITORIAL_THEME_OPTIONS = Object.entries(EDITORIAL_THEMES).map(([id, theme]) => ({ id, label: theme.label }))
export function isEditorialTheme(value: unknown): value is string {
    return typeof value === 'string' && Object.prototype.hasOwnProperty.call(EDITORIAL_THEMES, value)
}
