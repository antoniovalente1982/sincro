# Blog — Dentro la partita

Area richiesta da Antonio il 18 settembre 2026; identità confermata «Dentro la partita, a firma Metodo Sincro».

## Superfici

- `/dashboard/blog`: gestione autenticata, editor, anteprima, pubblicazione/ritiro, SEO e 12 brief editoriali. Ruoli owner/admin e manager marketing/IT.
- `/blog`: archivio pubblico con articoli attivi e advertorial legacy individuati per slug pochi-minuti o template advertorial.
- `/blog/[slug]`: articolo pubblico, HTML sul server, CTA al funnel esistente, correlati, canonical/OG/JSON-LD.
- `/blog/anteprima`, `/blog/anteprima/articolo`, `/blog/anteprima/gestionale`: solo development, fixture dichiarata, nessun salvataggio/tracking, noindex. 404 in produzione.

## Persistenza e accessi

Migrazione `supabase/migrations/20260918_blog_posts.sql` applicata il 18 settembre 2026 al progetto Adpilotik (`bktiuhxenxwhkgvdaxnp`). Tabella dedicata `blog_posts`, nessun accesso anonimo Supabase, RLS su membership attiva e ruoli. L’API e la dashboard aggiungono controlli applicativi e filtri organization_id. L’API scrive solo campi validati e usa updated_at per impedire sovrascritture concorrenti; gli input sono bloccati durante il salvataggio. Il corpo non ammette HTML eseguibile.

Il server pubblico usa service role e legge un solo tenant: `BLOG_ORGANIZATION_ID`, oppure l’organizzazione del funnel esistente `pochi-minuti`. Serve `SUPABASE_SERVICE_ROLE_KEY`; non c’è fallback anonimo. Un problema del database produce errore, mai dati fittizi presentati come reali. La tabella dedicata evita di esporre bozze attraverso le policy pubbliche dei funnel e di contaminare conteggi/analytics dei funnel.

## SEO e domini

`NEXT_PUBLIC_BLOG_ORIGIN` è l’origine pubblica, default `https://landing.metodosincro.com`. Gli URL contengono `/blog`; un dominio dedicato con path abbreviati richiede un successivo routing per host. `/sitemap.xml` contiene archivio, articoli pubblicati e legacy attivi, senza parametri. `/robots.txt` esclude aree tecniche e anteprime; Vercel non-production disallow `/`.

La sitemap copre il contenuto editoriale, non pretende di inventariare tutte le landing del progetto. Le pagine pubblicate mantengono lo slug, anche se cambiano titolo; cambiare slug richiederebbe introdurre redirect permanenti. Nessun dominio alternativo è configurato dal codice di questa consegna. Le anteprime non ereditano canonical di un articolo pubblico.

## Attribuzione

`blogNavigationHref` conserva una whitelist UTM/fbclid/fbadid fra archivio e articoli. `blogConsultationHref` aggiunge `entry=blog-[slug]`; non inventa UTM. Il modulo MetodoSincroLandingV2 invia editorial_entry, normalizzato con blogEntry nel server. Viene conservato in funnel_submissions.extra_data e nei metadati lead first_editorial_entry/last_editorial_entry. Le richieste restano attribuite al funnel di destinazione. Questi campi rappresentano provenienza dichiarata dal browser, non un’identità verificata o un modello multi-touch.

Nessun nuovo script GA4/Meta installato sul blog e nessun invio di contatti di prova. Il consenso e il setup di misurazione del nuovo dominio vanno verificati all’attivazione. Informazioni di salute o racconti privati dei ragazzi non devono diventare parametri degli eventi pubblicitari.

## Verifiche e rilascio

Prima del rilascio verificare migrazione/RLS con ruolo anonimo, ruolo non autorizzato, editor autorizzato e organizzazione diversa; provare un ciclo bozza → pubblicato → ritirato e assenza delle bozze da archivio/sitemap. Applicare la migrazione prima del deploy. Nessun dato va spostato dalla tabella funnels; il legacy resta collegato ai suoi URL.

Test locali: `npx tsx --test lib/blog.test.ts lib/advertorial.test.ts`; ESLint mirato alle nuove superfici; `npm run build`. Verificare 404 delle anteprime in produzione. Dati e problemi conosciuti del database remoto non possono essere dedotti dalla sola build.

Strategia e raccomandazione dominio: `outputs/blog-dentro-la-partita-2026-09-18/STRATEGIA.md`.

## Attivazione 18 settembre 2026

Rilascio produzione completato (`a28838ef`). Blog pubblico e gestionale verificati online; bozza creata e aggiornata dall’editor con sessione autenticata e controllata nel database. Bozza esclusa da archivio/sitemap e URL pubblico 404. RLS e passaggi bozza/pubblicazione/ritiro verificati con SQL transazionale e rollback. Dettagli e link: `outputs/blog-dentro-la-partita-2026-09-18/STATO.md`.
