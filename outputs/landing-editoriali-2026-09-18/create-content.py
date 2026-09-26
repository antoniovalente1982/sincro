import json
from pathlib import Path
out=Path('outputs/landing-editoriali-2026-09-18')
rows=[
('incoraggiare-figlio-calcio','genitori','Gli dici di stare tranquillo. E se servisse un passo diverso?','Porta un episodio in cui i tuoi incoraggiamenti non hanno aiutato. Nel primo confronto gratuito con te, il genitore, partiamo da come comunicate e valutiamo se il percorso può essere pertinente.'),
('salto-di-categoria-fiducia','crescita','Nella nuova squadra sembra aver perso fiducia. Partiamo da qui.','Ha raggiunto il livello che voleva, ma ora si sente indietro. Raccontaci cosa è cambiato: il primo confronto gratuito è con te, per valutare come accompagnarlo e se un lavoro mentale è pertinente.'),
('cosa-dire-dopo-brutta-partita','genitori','Dopo una brutta partita non sai più cosa dirgli. Parliamone.','Il viaggio di ritorno finisce sempre nello stesso silenzio o nella stessa discussione. Porta quella conversazione al primo confronto gratuito: iniziamo dal tuo ruolo di genitore.'),
('mio-figlio-gioca-poco','panchina','Tuo figlio gioca poco. Da dove partire per aiutarlo?','Prima di scegliere se restare o cambiare squadra, facciamo il punto su come vive la panchina e quei pochi minuti. Il primo confronto gratuito è con te, il genitore: partiamo da un episodio e dai tuoi dubbi.'),
('figlio-non-si-diverte-calcio','ripartenza','Il calcio non gli piace più come prima. Che cosa è cambiato?','Continua ad allenarsi, ma l’entusiasmo sembra lontano. Nel primo confronto gratuito partiamo da ciò che hai osservato e da quello che ti racconta, senza decidere al suo posto.'),
('paura-rientro-infortunio-calcio','infortunio','Dopo l’infortunio, come sta vivendo il ritorno in campo?','La voglia di rientrare può convivere con il timore di farsi male di nuovo. Raccontaci la sua situazione: valutiamo il possibile ruolo del lavoro mentale, nel rispetto delle indicazioni di chi segue il recupero.'),
('allenamento-extra-partita','allenamento','Si allena di più, ma in partita si trattiene. Cosa manca da capire?','Prima di aggiungere un altro impegno, partiamo da cosa cambia tra allenamento e gara. Il primo confronto gratuito è con te, il genitore, per valutare se il percorso può essere pertinente.'),
('fiducia-dopo-errore-calcio','fiducia','Dopo un errore smette di chiedere palla. Partiamo dalla prossima azione.','Quel passaggio sbagliato sembra restargli in testa per tutta la partita. Raccontaci un episodio nel primo confronto gratuito: valutiamo quali domande approfondire e come potrebbe lavorarci.'),
('pressione-prima-della-partita','pressione','La partita deve ancora iniziare. Lui si sente già sotto esame.','L’attesa della gara pesa anche a casa. Nel primo confronto gratuito con te, il genitore, partiamo da ciò che succede prima di giocare e valutiamo se un lavoro mentale è pertinente.'),
('genitori-pressione-calcio','genitori','Vuoi sostenerlo dalla tribuna. Come vive lui la tua presenza?','Tifo, consigli e aspettative possono essere ricevuti in modi diversi. Porta una situazione concreta al primo confronto gratuito: iniziamo dal tuo ruolo di genitore e da ciò che vorresti chiarire.'),
('pressione-provino-calcio','provino','Il provino si avvicina. Aiutiamolo a viverlo come un’occasione.','Una giornata non racconta tutto il suo valore. Nel primo confronto gratuito partiamo da come vive l’attesa e dalle aspettative che sente, per valutare il possibile lavoro sulla preparazione mentale.'),
('confronto-fisico-calcio-ragazzi','fisico','Gli altri sono cresciuti. Aiutiamolo a non sentirsi meno capace.','Il confronto fisico può pesare sulla fiducia. Raccontaci come lo vive: partiamo da ciò che osservi per valutare un lavoro mentale rispettoso dei suoi tempi, delle sue qualità e dei suoi obiettivi.'),
('figlio-rifiuta-mental-coach','rifiuto','Lui dice «non mi serve». Il primo confronto puoi farlo tu.','Non devi convincerlo a partecipare per raccontarci i tuoi dubbi. Il primo incontro gratuito è con te, il genitore. Un eventuale percorso con tuo figlio richiederà anche la sua disponibilità.'),
('figlio-escluso-gruppo-squadra','gruppo','È nella squadra, ma non si sente parte del gruppo. Capiamo cosa vive.','Prima di dirgli di adattarsi, ascoltiamo la situazione. Nel primo confronto gratuito partiamo dal tuo racconto e dalle domande da approfondire, tenendo distinti il contesto e il possibile lavoro individuale.'),
('scuola-famiglia-calcio','carico','Scuola, calcio, trasferte. La vostra settimana ha ancora spazio?','Quando ogni impegno diventa una rincorsa, serve capire cosa pesa davvero. Porta la vostra situazione al primo confronto gratuito: iniziamo dalle priorità e dal possibile ruolo del percorso.'),
('figlio-non-confermato-squadra','nonconferma','La società non lo conferma. Come stargli vicino adesso?','La delusione può accompagnarlo anche nella prossima squadra. Nel primo confronto gratuito con te, il genitore, partiamo da come sta vivendo questo passaggio e da ciò che serve approfondire.'),
('mental-coaching-calcio-ragazzi','percorso','Prima di investire, capiamo se il mental coaching fa per voi.','Porta i tuoi dubbi sul metodo, sugli obiettivi e sull’impegno richiesto. Il primo confronto è gratuito: se il percorso è pertinente, chiariremo modalità e investimento prima di decidere.'),
]
patches=[dict(slug=s,landingTheme=t,landingTitle=h,landingIntro=d) for s,t,h,d in rows]
(out/'TESTI_ARTICOLI.json').write_text(json.dumps(patches,ensure_ascii=False,indent=2)+'\n')
body='''«Mamma, lo so che non devo diventare una professionista. Ma per me conta.»

Emma ha sedici anni. Gioca in una squadra femminile della sua zona, studia, riempie il borsone due volte a settimana e arriva in anticipo al campo. In allenamento chiede palla. Prova il passaggio difficile. Se sbaglia, spesso ci riprova.

La domenica, invece, qualcosa cambia. Dopo il primo errore si scusa con una compagna. Poi con un’altra. Alla giocata successiva potrebbe proporsi, ma rimane dietro l’avversaria. A fine partita la madre prova a rassicurarla: «Dai, è solo una partita.»

Emma non cerca una promessa di Serie A. Vorrebbe che qualcuno capisse perché quella partita le è rimasta addosso.

**Emma e sua madre sono personaggi di una storia illustrativa. Le immagini sono generate con AI: non rappresentano clienti o risultati del Metodo Sincro.** La scena serve a mettere a fuoco una domanda concreta: come sostenere una figlia che ama il calcio, ma in partita sembra perdere fiducia?

## Il suo calcio conta anche se gioca nella squadra del paese

A volte un genitore pensa che un supporto individuale abbia senso solo per chi è già dentro una grande academy, viene osservato da una società o si prepara a diventare professionista.

Così finisce per minimizzare una difficoltà che, vista da fuori, sembra troppo piccola: una convocazione mancata, un passaggio sbagliato, una compagna che le dice di svegliarsi. Per lei, però, lì ci sono impegno, relazioni e un pezzo della propria identità.

Prendere sul serio quel momento non significa trasformare il calcio in una carriera obbligatoria. Significa riconoscere che una ragazza può voler vivere meglio il proprio sport, al livello in cui lo pratica oggi.

Il calcio femminile giovanile comprende anche attività di avvicinamento e partecipazione. I [Play Days della FIGC](https://www.figc.it/it/giovani/femminile/play-days) si rivolgono sia a chi vuole scoprire il gioco sia alle giovani già tesserate. Il punto di ingresso non è soltanto la selezione delle migliori.

## «Non volevo sbagliare un’altra volta»

Torniamo alla nostra scena. In macchina, la madre di Emma smette per un momento di spiegare perché la partita non fosse andata così male.

«C’è stato un momento in cui hai iniziato a sentirti diversa?»

Emma indica il primo passaggio perso. Racconta di aver pensato che le compagne non si fidassero più. La madre non sa se fosse davvero così. Ora, però, ha un’informazione più precisa di «oggi eri spenta».

Può distinguere tre cose: il passaggio è stato sbagliato; Emma ha sentito il giudizio delle compagne; dopo ha chiesto meno palla. Non sono la stessa cosa, e non richiedono necessariamente la stessa risposta.

**Un errore tecnico non dimostra da solo un problema mentale.** Può esserci un compito non chiaro, un momento di stanchezza, una richiesta tattica, una relazione difficile o la paura di sbagliare. Prima di scegliere come intervenire, serve capire meglio.

![Emma parla con la madre fuori dal campo. Scena illustrativa generata con AI.](/images/blog/storie/calciatrice-fiducia-calcio-femminile-02.webp "Ascoltare un episodio prima di dare un consiglio. Storia e persone illustrative, immagine AI.")

## Il costo di aspettare non è una carriera perduta

Non sappiamo quale sarà il futuro calcistico di Emma. Nessuno può dedurlo da una partita o da una telefonata.

Il costo che la famiglia può osservare è molto più vicino: un’altra domenica passata a giudicarsi, un altro allenamento affrontato con il pensiero di dover recuperare, un’altra conversazione che si chiude con «lascia stare».

Se la risposta resta sempre «devi essere più sicura», la ragazza riceve un obiettivo senza un passaggio concreto per lavorarci. Se ogni errore viene seguito da un’analisi in auto, può iniziare a proteggersi raccontando meno.

Anche continuare ad aggiungere lezioni o allenamenti, senza aver chiarito il bisogno, può richiedere tempo e denaro senza rispondere alla domanda da cui siete partiti.

Questo non significa che ogni difficoltà richieda un percorso. Significa che, quando la stessa scena ritorna, vale la pena smettere di rispondere per tentativi e cercare un confronto più preciso.

## Non serve trattarla come più fragile. Serve ascoltare la sua esperienza.

Una calciatrice non ha bisogno di sentirsi dire che «le ragazze sono fatte così». Età, ambiente, carattere, relazioni e storia personale contano più di una spiegazione generica sul genere.

Può desiderare indicazioni tecniche chiare. Può avere bisogno di essere ascoltata dopo una delusione. Può sentirsi bene nel gruppo e, comunque, trattenersi in gara. Oppure può vivere commenti svalutanti che non vanno trasformati in un suo difetto di fiducia.

Se racconta umiliazioni, esclusioni ripetute o comportamenti inappropriati, il punto è ascoltarla e coinvolgere i referenti competenti della società. Il lavoro individuale non sostituisce la responsabilità degli adulti e dell’ambiente sportivo.

Nelle indicazioni UEFA sugli [ambienti accoglienti per le bambine che si avvicinano al calcio](https://www.uefa.com/development/womens-football/playmakers/play-games/girl-friendly-environments/), fiducia, piacere di partecipare e coinvolgimento delle famiglie hanno un ruolo esplicito. Si tratta di attività introduttive per fasce più giovani: non è una prova che un determinato percorso produca risultati per una sedicenne. È un richiamo utile a guardare anche l’esperienza della persona, oltre all’esecuzione tecnica.

## Tre domande da portare al prossimo confronto

Puoi partire da una situazione recente, lasciandole la possibilità di scegliere quando parlarne.

- **«Quale momento ti è rimasto in testa?»** Aiuta a passare da «è andato tutto male» a un episodio.
- **«Che cosa ti sei detta dopo?»** Permette di ascoltare il suo punto di vista, senza sostituirlo con il tuo.
- **«In quel momento, da me avresti voluto ascolto o un consiglio?»** Chiarisce quale presenza può esserle utile.

Non sono domande da fare tutte insieme come un interrogatorio. Se non vuole rispondere subito, puoi dirle che ci sei e riprendere il discorso in un altro momento.

L’obiettivo non è ottenere la frase che conferma una tua ipotesi. È capire che cosa sta vivendo e quale informazione vi manca ancora.

## Su che cosa può lavorare il mental coaching nel calcio femminile

Quando è pertinente e la ragazza è disponibile, il lavoro può riguardare attenzione, risposta all’errore, dialogo interno e gestione delle aspettative. Gli obiettivi vanno definiti sulla sua situazione: chiedere palla dopo un errore, tornare al compito della prossima azione, prepararsi alla gara con riferimenti più chiari.

Si tratta di un possibile lavoro da costruire, non del risultato che Emma avrebbe ottenuto. La nostra storia non contiene una trasformazione inventata o una testimonianza mascherata.

![Emma si propone per ricevere palla durante un allenamento di calcio femminile. Scena illustrativa generata con AI.](/images/blog/storie/calciatrice-fiducia-calcio-femminile-03.webp "Un obiettivo da definire può essere tornare a partecipare alla prossima azione. L’immagine illustra il gioco, non un risultato del percorso.")

Nel Metodo Sincro l’eventuale percorso prevede un lavoro individuale online, con un coach dedicato. Il riferimento è la persona, la sua fascia d’età e ciò che vuole allenare. Il lavoro del team con atlete professioniste non è un requisito di accesso per tua figlia: **anche una giovane calciatrice dilettante può chiedere, attraverso la famiglia, di valutare se il percorso sia adatto.**

Il coaching non sceglie la formazione, non assicura convocazioni o contratti e non sostituisce cure o valutazioni sanitarie quando necessarie.

## Il primo incontro è con te. Non devi convincerla a fare una call.

Se ti riconosci nella madre di Emma, il primo passo può essere raccontare un episodio al team Metodo Sincro. Il primo confronto gratuito è rivolto a te, il genitore che valuta come sostenere sua figlia e se investire in un percorso.

Porta ciò che hai osservato, quello che lei ti ha detto e i tentativi già fatti. Il confronto serve a chiarire la situazione e a valutare se il lavoro proposto può essere pertinente. Non è una diagnosi della ragazza fatta attraverso il racconto del genitore.

Se emerge una proposta, chiariremo come coinvolgere tua figlia, le modalità, la durata e il costo. La sua disponibilità conta: il percorso non si impone.

Non serve arrivare con un curriculum sportivo. Non serve promettere che diventerà professionista. Serve una situazione che vuoi capire meglio.

**Il suo calcio conta già. Anche se il suo campo è quello dietro casa.**
'''
article={
 'title':'Tua figlia ama il calcio. Ma in partita sembra dover dimostrare di meritarsi il campo.',
 'slug':'calciatrice-fiducia-calcio-femminile',
 'excerpt':'In allenamento osa. Dopo un errore in partita, invece, smette di chiedere palla. Come sostenere una giovane calciatrice e prendere sul serio il suo sport, anche quando gioca in una squadra dilettantistica.',
 'body':body,'topic':'femminile','seoTitle':'Calcio femminile: aiutare una figlia che perde fiducia in partita',
 'seoDescription':'Tua figlia gioca a calcio ma dopo un errore si trattiene? Una storia illustrativa per capire come sostenerla, anche nel calcio dilettantistico.',
 'cover':'/images/blog/storie/calciatrice-fiducia-calcio-femminile-01.webp',
 'coverAlt':'Emma, giovane calciatrice in maglia verde, si prepara a bordo di un campo dilettantistico. Personaggio e scena illustrativi generati con AI.',
 'status':'draft','landingTheme':'femminile',
 'landingTitle':'Tua figlia ama il calcio. Aiutiamola a viverlo con più fiducia.',
 'landingIntro':'Dopo un errore si trattiene, chiede meno palla o torna a casa delusa. Partiamo da un episodio nel primo confronto gratuito con te, il genitore. Il suo calcio conta anche se gioca in una squadra locale.'
}
(out/'CALCIATRICE.json').write_text(json.dumps(article,ensure_ascii=False,indent=2)+'\n')
(out/'ADVERTORIAL_CALCIATRICE.md').write_text('# '+article['title']+'\n\n'+article['excerpt']+'\n\n'+body)
print(json.dumps({'landing':len(patches),'new_article_words':len(body.split()),'new_article_slug':article['slug']}))
