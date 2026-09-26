"""Build local, reviewable copy. Does not call Meta or publish anything."""
from pathlib import Path
import csv
import datetime
import html
import json

OUT = Path(__file__).resolve().parent
if (OUT / 'LEADIN_R3_RECEIPT.json').exists():
    raise SystemExit('R3 already published: this draft generator is archived. Do not overwrite published copy or its receipt; create a new revision for changes.')
original = json.loads((OUT / 'CAMPAGNA_PREPARAZIONE.json').read_text())
groups = {
    'A01': {
        'story': 'Elena: il dialogo intorno alle partite',
        'source': 'https://it.trustpilot.com/review/valenteantonio.it?page=10',
        'source_author': 'Elena', 'source_date': '2023-07-08',
        'headline': 'Era impossibile rivolgergli la parola',
        'description': 'Il racconto di una madre',
        'hooks': [
            '«Prima e dopo le partite era impossibile rivolgergli la parola». Elena racconta.',
            '«lo vedo più rilassato, fiducioso e sicuro di sé». Elena racconta.',
            '«ho notato un grosso cambiamento nel suo umore». Parla di suo figlio.',
        ],
        'hook_angles': ['Momento più difficile', 'Cambiamento osservato', 'Svolta nel racconto'],
        'shared_body': '''A raccontarlo è Elena, nella recensione che ha pubblicato l’8 luglio 2023.

Vedeva suo figlio nervoso, arrabbiato, insoddisfatto delle proprie prestazioni. Anche rivolgergli la parola, prima e dopo una partita, era diventato difficile.

Nel suo racconto, dopo l’incontro con il coach Diego cambia qualcosa: nota un umore diverso e, alla fine del percorso, lo descrive più rilassato e sicuro di sé.

Mi colpisce ciò che questa madre guarda: come sta suo figlio anche quando la partita è finita.

Da coach, è una domanda che porterei dentro il dopo gara: prima di aggiungere un consiglio, c’è spazio perché il ragazzo racconti ciò che ha vissuto?

Nell’articolo del Metodo Sincro trovi da quale domanda iniziare e come riprendere il dialogo quando avete già discusso.

Scopri di più nell’articolo.

Fonte: recensione di Elena su Trustpilot. Esperienza individuale. Immagine illustrativa AI, non ritrae la famiglia citata.''',
    },
    'A02': {
        'story': 'Vincenzo: allenava ragazzi, ma non capiva la difficoltà del figlio',
        'source': 'https://it.trustpilot.com/reviews/65ca03b3faf08922ea216364',
        'source_fallback': 'https://it.trustpilot.com/review/valenteantonio.it?page=6',
        'source_author': 'Vincenzo', 'source_date': '2024-02-12',
        'headline': 'Allenava ragazzi. Non capiva suo figlio.',
        'description': 'La confidenza che mancava',
        'hooks': [
            '«nonostante alleni giovani ragazzi, non capivo realmente la problematica». Parlava di suo figlio.',
            '«ad ogni gara l’ansia e la paura di sbagliare prendevano il sopravvento».',
            '«in quei minuti risicati doveva mostrare tanto». A raccontarlo è suo padre.',
        ],
        'hook_angles': ['Contraddizione del padre allenatore', 'Picco di tensione', 'La pressione dei pochi minuti'],
        'shared_body': '''Lo scrive Vincenzo, padre e allenatore di settore giovanile, in una recensione del 12 febbraio 2024.

Le qualità tecniche del figlio le vedeva. Quello che gli succedeva durante la gara, invece, gli sfuggiva.

Poi ne parlano. Il ragazzo gli confida che la paura di sbagliare prende il sopravvento: gioca poco e sente di dover dimostrare tanto proprio in quei minuti.

È il dettaglio del suo racconto su cui mi fermerei: dalla tribuna il padre vedeva il gioco; parlando con il figlio ha scoperto la pressione con cui lo viveva.

Per lavorare sulla risposta all’errore, partirei da lì. Che cosa si è detto il ragazzo dopo lo sbaglio? Che cosa ha fatto nell’azione successiva?

Nell’articolo del Metodo Sincro trovi un modo per ricostruire quell’episodio e passare dal generico “non pensarci” a una risposta concreta da provare.

Scopri di più nell’articolo.

Fonte: recensione di Vincenzo su Trustpilot. Esperienza individuale. Immagine illustrativa AI, non ritrae le persone citate.''',
        'quote_note': 'Nella seconda apertura è ripristinato soltanto l’apostrofo di “l’ansia”, assente nell’originale; parole e significato invariati.',
    },
    'A03': {
        'story': 'Daniel: poco impiego e ritorno al piacere di giocare',
        'source': 'https://it.trustpilot.com/review/valenteantonio.it?page=2',
        'source_author': 'Daniel', 'source_date': '2025-05-01',
        'headline': 'Tornare a divertirsi, dopo la panchina',
        'description': 'Il racconto di Daniel',
        'hooks': [
            '«sono tornato a divertimi come quando giocavo ai pulcini». Daniel racconta.',
            '«avevo giocato poco e avevo perso tanta fiducia». Poi qualcosa è cambiato.',
            '«ho ripreso fiducia». Veniva da un anno con pochi minuti in campo.',
        ],
        'hook_angles': ['Risultato raccontato dall’atleta', 'Punto basso e svolta', 'Risultato prima del contesto'],
        'shared_body': '''Daniel lo racconta nella recensione pubblicata il 1° maggio 2025.

Alle spalle aveva un anno con poco impiego. Insieme alla fiducia aveva perso anche una parte della passione che lo faceva continuare.

Poi racconta il lavoro con il coach Nicolò: ritrova fiducia e il piacere di giocare che ricordava da bambino.

Il cambiamento che sceglie di raccontare riguarda il modo in cui torna a vivere il calcio.

Prima di decidere se restare o cercare un’altra squadra, da coach vorrei capire anche questo: che cosa rappresentano quei pochi minuti per il ragazzo?

Nell’articolo del Metodo Sincro trovi tre domande per chiarire le indicazioni ricevute, le opportunità per lavorarci e il punto di vista del figlio. Da lì la scelta può diventare più concreta.

Scopri di più nell’articolo.

Fonte: recensione di Daniel su Trustpilot. Esperienza individuale. Immagine illustrativa AI, non ritrae l’atleta citato.''',
        'quote_note': '“divertimi” è il testo originale della recensione, conservato senza correggere la citazione. La data 1° maggio è la pubblicazione, distinta dall’esperienza indicata come 12 febbraio 2025.',
    },
}

ads = []
for group, data in groups.items():
    old = [a for a in original['ads'] if a['code'].startswith(group + '-')]
    assert len(old) == 3
    visual = next(a for a in old if a['code'].endswith('V1'))
    for i, a in enumerate(sorted(old, key=lambda x: x['code'])):
        hook = data['hooks'][i]
        words = len(hook.split())
        assert 11 <= words <= 14, (a['code'], words)
        row = dict(a)
        row.update(revision='R3', publication_status='LOCAL_DRAFT_NOT_PUBLISHED',
                   hook=hook, shared_body=data['shared_body'], body=hook + '\n\n' + data['shared_body'],
                   headline=data['headline'], description=data['description'],
                   source=data['source'], source_author=data['source_author'], source_date=data['source_date'],
                   asset_path=visual['asset_path'], meta_image_hash=visual['meta_image_hash'],
                   previous_creative_id=a['meta_creative_id'],
                   ad_name=a['pocket'] + ' — IMG Feed | ' + a['code'] + ' R3-H' + str(i+1) + ' T: ' + a['trigger'],
                   hook_angle=data['hook_angles'][i],
                   counts={'opening_words': words, 'opening_chars': len(hook), 'primary_text': len(hook + '\n\n' + data['shared_body']), 'headline': len(data['headline']), 'description': len(data['description'])})
        row.pop('meta_creative_id', None)
        row.pop('configured_status', None)
        row.pop('effective_status', None)
        row['placement_preview_status'] = 'NOT_CREATED_FOR_R3'
        row['asset_status'] = 'EXISTING_ASSET_SELECTED_FOR_LOCAL_DRAFT'
        assert len(row['body']) < 2200
        assert len(row['headline']) <= 40
        assert len(row['description']) <= 30
        ads.append(row)

prepared = {
    'revision': 'R3', 'status': 'LOCAL_DRAFT_AWAITING_TESTIMONIAL_USAGE_EVIDENCE',
    'prepared_at': datetime.datetime.now(datetime.timezone.utc).isoformat(),
    'campaign_id': '120251780591420047', 'adset_id': '120251780591590047',
    'url_tags': original['ads'][0].get('url_tags', 'utm_source=facebook&utm_medium=paid&utm_campaign={{campaign.name}}&utm_term={{adset.name}}&utm_content={{ad.name}}&fbadid={{ad.id}}'),
    'authorization': 'Publication and total average daily budget EUR100 previously authorized. No renewed general campaign approval requested.',
    'open_requirement': 'Brain source requires written consent for public testimonial use. Public availability verified; written consent for these three uses not found.',
    'test_design': 'Three opening variants per story; shared body, headline, description, image, CTA, article and landing identical within each group. R1 vs R3 is an overall editorial revision, not an opening-only experiment.',
    'performance_basis': 'Current campaign does not have enough conversion data to identify three winning ads. One story per existing article; no winner claim.',
    'groups': groups, 'ads': ads,
}
(OUT / 'COPY_REVISION_R3.json').write_text(json.dumps(prepared, ensure_ascii=False, indent=2) + '\n')

md = ['# Revisione Slippery Leadin — R3', '', '**Preparata localmente, non pubblicata su Meta. R2 ritirata e bloccata nello script.**', '',
      'Il chiarimento di Antonio del 19 settembre 2026 riguarda la prima riga del testo principale: entrare nel momento di massima intensità o nel cambiamento reale, con parole concrete e conversazionali. Non serve introdurre prima il prodotto o la biografia del coach. Il racconto viene dopo il suo punto più forte.', '',
      '## Impostazione del confronto', '',
      '- Nove varianti: tre aperture per ciascuno dei tre advertorial già scelti.',
      '- Ogni apertura contiene 11–14 parole. È una guida editoriale; la porzione visibile dipende dall’anteprima e dal posizionamento.',
      '- All’interno di ogni terna restano uguali corpo, titolo sotto l’immagine, descrizione, immagine, pulsante e destinazione.',
      '- Rispetto agli annunci R1 è una revisione complessiva del racconto. Non viene presentata come prova causale dell’effetto del solo incipit rispetto a R1.',
      '- Le nuove headline accompagnano la storia. Il solo punto 3 del framework non impone di cambiare il titolo sotto l’immagine: nel confronto degli incipit va tenuto fisso.',
      '- Foto V1 già disponibili usate come illustrazioni, con dichiarazione nel copy; non vengono presentate come foto delle famiglie recensenti.',
      '- I dati correnti non consentono di identificare tre vincitrici: la selezione copre i tre articoli, non simula una classifica.',
      '- Budget complessivo 100 €/giorno di media, campagna continuativa, percorsi e tracking esistenti.', '',
      '## Requisito prima della pubblicazione', '',
      'Fonti e citazioni riscontrate; manca nei file consultati la conferma del consenso scritto all’uso pubblicitario di queste testimonianze. La fonte del Brain `raw/Analisi recensioni Trustpilot - casi studio e pattern_COMPILED.md` richiede: “Prima di usare una storia in comunicazione pubblica serve consenso scritto dell’interessato (o del genitore, se minore).” La successiva nota wiki che chiama il riutilizzo “a rischio zero” non documenta quel consenso. Nessuna nuova autorizzazione al budget o alla campagna è richiesta.', '',
      '## Testi pronti', '']
cards=[]
for group,data in groups.items():
    rows=[a for a in ads if a['code'].startswith(group+'-')]
    md += ['### ' + group + ' · ' + data['story'], '', f"Fonte: {data['source_author']}, {data['source_date']} · {data['source']}", '',
           '| Variante | Prime parole | N. parole |', '| --- | --- | --- |']
    for a in rows:
        md.append(f"| {a['code']} | {a['hook']} | {a['counts']['opening_words']} |")
    md += ['', '**Titolo sotto l’immagine:** ' + data['headline'], '**Descrizione:** ' + data['description'], '', '**Corpo comune, dopo l’apertura:**', '', data['shared_body'], '',
           'Articolo: ' + rows[0]['article_url'], 'Landing: ' + rows[0]['landing_url'], '']
    if data.get('quote_note'): md += ['Nota di fedeltà: ' + data['quote_note'], '']
    for a in rows:
        e=html.escape
        cards.append(f'<article><small>{a["code"]} · {a["counts"]["opening_words"]} parole · {e(a["hook_angle"])}</small><h2>{e(a["hook"])}</h2><p class="copy">{e(a["shared_body"])}</p><img src="{e(a["asset_path"])}" alt="Immagine illustrativa AI, non ritrae le persone citate" loading="lazy"><p><strong>Titolo: {e(a["headline"])}</strong><br>{e(a["description"])}</p><p><a href="{e(a["article_url"])}">Scopri di più: advertorial</a> · <a href="{e(a["source"])}">Fonte</a></p></article>')
(OUT / 'REVISIONE_LEADIN_R3.md').write_text('\n'.join(md) + '\n')
(OUT / 'GALLERIA_LEADIN_R3.html').write_text('''<!doctype html><html lang="it"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>R3 · Slippery Leadin · Bozza</title><style>body{margin:0;background:#f5f2ed;color:#182b38;font:16px/1.55 system-ui}main{max-width:1440px;margin:auto;padding:32px}h1{font-size:40px;line-height:1.12}.status{padding:18px;border:1px solid #bb7722;background:#fff4dd}.grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:20px;margin-top:28px}article{padding:24px;background:white;border:1px solid #d8d3ca}h2{font-size:23px;line-height:1.3}.copy{white-space:pre-line}img{width:100%;height:auto;margin-top:12px}small{color:#704a26}a{color:#184879}@media(max-width:950px){.grid{grid-template-columns:1fr}main{padding:20px}}</style><main><h1>La storia comincia dal suo punto più forte.</h1><p class="status"><strong>BOZZA R3 — NON PUBBLICATA SU META.</strong><br>Tre aperture per ciascun articolo. Corpo, titolo, immagine e destinazione sono uguali all’interno di ogni terna. Testimonianze riscontrate; conferma dell’autorizzazione d’uso ancora da documentare.</p><p><a href="GALLERIA.html">Annunci R1 attualmente pubblicati</a> · <a href="REVISIONE_LEADIN_R3.md">Criteri e testi completi</a></p><div class="grid">''' + ''.join(cards) + '</div></main></html>')
with (OUT / 'ANNUNCI_LEADIN_R3.csv').open('w',newline='') as f:
    w=csv.DictWriter(f,fieldnames=['code','hook','body','headline','description','article_url','landing_url','source','ad_name','publication_status'])
    w.writeheader(); w.writerows({k:a[k] for k in w.fieldnames} for a in ads)
print(json.dumps({'status':prepared['status'],'ads':len(ads),'counts':[{a['code']:a['counts']} for a in ads]},ensure_ascii=False,indent=2))
