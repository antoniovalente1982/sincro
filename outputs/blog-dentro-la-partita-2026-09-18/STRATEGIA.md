# Dentro la partita — dominio, SEO e acquisizione

18 settembre 2026. Nome confermato da Antonio: **Dentro la partita, a firma Metodo Sincro**. Area privata: **Blog** nel gestionale.

## La raccomandazione

Per partire, propongo `blog.metodosincro.it`: identità chiara, collegamento evidente con Metodo Sincro e possibilità di usare lo stesso progetto Next.js/Vercel. Il dominio oggi documentato per il gestionale è `landing.metodosincro.com`, non `.it`. L’indirizzo finale non è stato configurato.

| Soluzione | Vantaggio | Costo operativo / limite | Valutazione |
| --- | --- | --- | --- |
| `landing.metodosincro.com/blog` | Riusa subito l’hosting esistente | Il nome “landing” comunica meno bene uno spazio editoriale | Valido per avvio tecnico |
| `metodosincro.it/blog` | Percorso naturale dentro il sito principale | Il sito principale risulta WordPress: occorre integrarvi la sezione o configurare un proxy verso Next.js | Buona architettura, da verificare con hosting e routing esistenti |
| `blog.metodosincro.it` | Sottodominio dedicato, stesso marchio e gestionale | Configurazione DNS/Vercel e indirizzo canonico; collegamenti dal sito principale | Raccomandazione operativa per questa implementazione |
| Dominio autonomo “Dentro la partita” | Marchio editoriale estendibile | Disponibilità, acquisto, nuove configurazioni e promozione; il nome da solo non trasferisce autorevolezza | Da valutare se vogliamo un’attività editoriale distinta |

Il prefisso “landing” non rende un sito non indicizzabile. La scelta fra sottodominio e sottocartella va fatta anche per gestione e chiarezza: non esiste un vantaggio automatico che permetta di promettere posizionamenti. [Guida Google alla SEO](https://developers.google.com/search/docs/fundamentals/seo-starter-guide).

## Come collegare un nuovo indirizzo

Il collegamento tecnico avviene tramite **DNS e hosting**, non tramite pixel: aggiunta del dominio al progetto Vercel, record DNS indicato da Vercel, verifica e certificato HTTPS. Il database e il gestionale rimangono gli stessi. [Documentazione Vercel](https://vercel.com/docs/domains/working-with-domains/add-a-domain).

Le route costruite sono `/blog` e `/blog/[slug]`. Configurando solo il nuovo host, gli URL saranno inizialmente `blog.metodosincro.it/blog/...`. Per un indirizzo breve `blog.metodosincro.it/articolo` serve un routing dedicato per host, da eseguire insieme alla scelta definitiva: non è già configurato. Aggiornare `NEXT_PUBLIC_BLOG_ORIGIN`, canonical, sitemap e link pubblici in modo coerente. Il dominio vecchio dovrà reindirizzare alle pagine equivalenti, senza copie concorrenti. Non impostare canonical verso un host ancora inesistente.

## Come lavorare sulla SEO

Sono predisposti nel codice: pagine renderizzate sul server, titolo e descrizione SEO, canonical, Open Graph, dati strutturati BlogPosting e BreadcrumbList, sitemap dei pubblicati, esclusione delle anteprime e accesso privato alle bozze.

Per l’avvio effettivo occorrono anche:

1. Pubblicare gli articoli completi e revisionati sul dominio scelto.
2. Collegare il blog dal sito principale, dal menu e dalle pagine pertinenti.
3. Verificare la proprietà in Search Console e inviare la sitemap.
4. Controllare con Ispezione URL che Google possa leggere le pagine e quale canonical abbia selezionato.
5. Misurare query, impressioni, clic e richieste pertinenti; migliorare i contenuti con dati reali.

La sitemap aiuta la scoperta, ma non garantisce l’indicizzazione. [Google sulle sitemap](https://developers.google.com/search/docs/crawling-indexing/sitemaps/overview). Il markup Article aiuta a descrivere autore, titolo e date, senza garantire risultati speciali. [Google su Article](https://developers.google.com/search/docs/appearance/structured-data/article).

Per ogni problema serve una risposta utile alla domanda del genitore: situazione, spiegazione, indicazioni pratiche, fonti, limiti del lavoro e invito pertinente. La forma editoriale resta a firma del brand. Non moltiplicare pagine quasi uguali cambiando soltanto la parola chiave. [Google sui contenuti utili](https://developers.google.com/search/docs/fundamentals/creating-helpful-content).

## Il piano dei contenuti

Sono preparati **12 brief, non 12 articoli finiti**: paura di sbagliare; panchina; salto di categoria; dialogo dopo la partita; reazione all’errore; pressione prepartita; vissuto del rientro da infortunio; perdita del divertimento; genitori in tribuna; cambio squadra; provini; funzionamento del mental coaching.

Fonte: ricerca locale del 17 settembre e descrizione del metodo in AV Brain. Le query proposte sono ipotesi: non sono stati inventati volumi di ricerca o percentuali di acquisto. I primi contenuti da sviluppare dopo l’articolo esistente sono panchina, salto di categoria e dialogo dopo la partita. Pubblicare progressivamente dopo revisione del contenuto, prima di estendere la serie.

## Come collegare visite, contatti e vendite

| Strumento | Che cosa chiarisce | Stato di questo lavoro |
| --- | --- | --- |
| Search Console | Scoperta, indicizzazione, query e clic organici | Da collegare e verificare sul dominio scelto |
| GA4 | Letture, navigazione, clic verso la consulenza | Configurazione dedicata al blog non eseguita |
| Meta Pixel + Conversions API | Segnali per attribuzione pubblicitaria e campagne | Integrazione già presente sui funnel; non attivata automaticamente sul nuovo blog |
| Identificativo articolo + CRM | Quale articolo precede una richiesta, poi esito commerciale | Propagazione `entry=blog-[slug]` e registrazione nei metadati predisposte; invio reale non testato |

Proposta: riutilizzare l’infrastruttura Meta della stessa attività, con eventi distinti per visita, lettura e richiesta effettivamente accettata. Verificare consenso, configurazione del dataset e deduplicazione Pixel/CAPI prima dell’attivazione. Il pixel non migliora la SEO e da solo non collega tutti i risultati commerciali.

Se blog e consulenza rimangono rispettivamente su `.it` e `.com`, configurare **GA4 cross-domain** sullo stesso stream e controllare che il passaggio non venga contato come una nuova provenienza. I cookie e il localStorage non vengono condivisi automaticamente fra quei due domini. [Guida ufficiale GA4](https://support.google.com/analytics/answer/10071811?hl=en).

Nel codice gli UTM esistenti passano dall’archivio all’articolo e alla consulenza. Non vengono creati UTM interni che trasformino una visita organica in una falsa campagna. Si conserva separatamente l’ultimo articolo prima del modulo; questo non equivale a un modello completo di attribuzione multicanale. Il percorso da misurare è articolo → richiesta → contatto raggiunto → appuntamento svolto → contratto → incasso, mantenendo distinti contratti, incassi e margini.

## Stato reale

Implementazione locale e anteprime disponibili; nessun acquisto, modifica DNS, deploy, invio di contatti o pubblicazione di nuovi articoli. La nuova tabella richiede la migrazione `supabase/migrations/20260918_blog_posts.sql`. Il database remoto non è raggiungibile dall’ambiente di sviluppo: salvataggi reali e policy RLS sul server restano da verificare. Le anteprime locali hanno dati dimostrativi, salvataggio disabilitato e `noindex`; non esistono in produzione.
