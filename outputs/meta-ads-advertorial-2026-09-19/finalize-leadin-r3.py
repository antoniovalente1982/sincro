"""Synchronize local deliverables only after a verified Meta publication receipt."""
from pathlib import Path
from datetime import datetime
from zoneinfo import ZoneInfo
import csv
import html
import json
import re
import shutil

p = Path(__file__).resolve().parent
r = json.loads((p/'COPY_REVISION_R3.json').read_text())
receipt = json.loads((p/'LEADIN_R3_RECEIPT.json').read_text())
ledger = json.loads((p/'LEADIN_R3_LEDGER.json').read_text())
auth = json.loads((p/'LEADIN_R3_AUTHORIZATION.json').read_text())
assert receipt['status'] == 'PUBLISHED_VERIFIED'
assert auth['testimonial_usage_confirmation']['status'] == 'CONFIRMED_BY_USER'
assert len(receipt['ads']) == 9
live = {x['id']: x for x in receipt['ads']}
for a in r['ads']:
    x = live[a['meta_ad_id']]
    spec = x['creative']['object_story_spec']['link_data']
    assert (spec['message'],spec['name'],spec['description'],spec['link'],spec['image_hash']) == (a['body'],a['headline'],a['description'],a['article_url'],a['meta_image_hash'])

backup = p/'archivio-prima-pubblicazione-r3'
backup.mkdir(exist_ok=True)
for name in ['CAMPAGNA_PREPARAZIONE.json','CREATIVITA.md','GALLERIA.html','PIANO.md','README.md','PUBBLICAZIONE.md','ANNUNCI.csv','COPY_REVISION_R3.json','REVISIONE_LEADIN_R3.md','GALLERIA_LEADIN_R3.html']:
    if (p/name).exists() and not (backup/name).exists(): shutil.copy2(p/name,backup/name)

when = datetime.fromisoformat(receipt['checked_at'].replace('Z','+00:00')).astimezone(ZoneInfo('Europe/Rome')).strftime('%d/%m/%Y alle %H:%M')
campaign_url='https://adsmanager.facebook.com/adsmanager/manage/ads?act=511099830249139&business_id=1224962114308041&selected_campaign_ids=120251780591420047&selected_adset_ids=120251780591590047'
statuses = {}
for x in live.values(): statuses[x['effective_status']] = statuses.get(x['effective_status'],0)+1
status_text = ', '.join(f'{n} {status}' for status,n in statuses.items())
for a in r['ads']:
    x=live[a['meta_ad_id']]
    a.update(meta_creative_id=x['creative']['id'],publication_status='PUBLISHED_VERIFIED',configured_status=x['status'],effective_status=x['effective_status'],asset_status='PUBLISHED_EXISTING_ASSET',placement_preview_status='META_PREVIEWS_GENERATED_AND_CREATIVE_READBACK_MATCHED')
r.update(status='PUBLISHED_VERIFIED',published_at=receipt['first_mutation_at'],verified_at=receipt['checked_at'],publication_receipt='LEADIN_R3_RECEIPT.json',open_requirement=None)
(p/'COPY_REVISION_R3.json').write_text(json.dumps(r,ensure_ascii=False,indent=2)+'\n')

cfg=json.loads((p/'CAMPAGNA_PREPARAZIONE.json').read_text())
cfg.update(ads=r['ads'],revision='R3',updated_at=receipt['checked_at'],publication_receipt='LEADIN_R3_RECEIPT.json',creative_status='NINE_R3_CREATIVES_PUBLISHED_VERIFIED',creative_test='Three opening variants per article; within each group identical shared body, headline, description, image, CTA and destination. Ordinary Meta allocation, not randomized.',current_targeting=receipt['adset']['targeting'],excluded_custom_audiences=receipt['adset']['targeting'].get('excluded_custom_audiences',[]))
cfg['placement_assets']['active_images']=3
cfg['placement_assets']['placement_preview_status']='18 R3 previews generated. Browser spot checks: A01-V1 Facebook Feed, A03-V1 Instagram Feed including expanded text. All nine creatives read back exactly.'
cfg['release_gates_status']['creative_files']='PASS: 9 R3 creatives, 3 existing images; exact body/title/description/image/CTA/URL/identity verified.'
cfg['release_gates_status']['targeting_budget']='PASS: 100 EUR average daily, continuous. Concurrent external removal of recent-lead exclusion at 13:20 preserved, documented in LEADIN_R3_ADSET_CURRENT_BASELINE.json; copy publication made no adset changes.'
cfg['release_gates_status']['status']='All 9 configured ACTIVE. Effective states at readback: '+status_text
(p/'CAMPAGNA_PREPARAZIONE.json').write_text(json.dumps(cfg,ensure_ascii=False,indent=2)+'\n')

revision=(backup/'REVISIONE_LEADIN_R3.md').read_text()
revision=revision.replace('**Preparata localmente, non pubblicata su Meta. R2 ritirata e bloccata nello script.**',f'**Pubblicata su Meta e verificata il {when}. Nove annunci impostati ACTIVE.** Stati effettivi alla rilettura: {status_text}. R2 ritirata e mai applicata.')
start=revision.index('## Requisito prima della pubblicazione')
end=revision.index('## Testi pronti',start)
revision=revision[:start]+'''## Consenso e pubblicazione

Antonio ha confermato esplicitamente “Sì, per tutte e tre” alla domanda sul consenso scritto di Elena, Vincenzo e Daniel all’uso pubblicitario. Conferma registrata in `LEADIN_R3_AUTHORIZATION.json`; nessuna copia dei documenti è stata richiesta o ispezionata. Pubblicazione autorizzata con “ok proviamo” ed eseguita sui nove annunci esistenti.

Rilettura: `LEADIN_R3_RECEIPT.json`. Lo storico degli stessi ID comprende anche R1: non attribuire automaticamente a R3 i risultati cumulativi precedenti alla sostituzione. L’eventuale revisione/elaborazione Meta resta distinta dalla richiesta di attivazione.

'''+revision[end:]
(p/'REVISIONE_LEADIN_R3.md').write_text(revision)
(p/'CREATIVITA.md').write_text(revision.replace('# Revisione Slippery Leadin — R3','# Testi, titoli e creatività pubblicati — R3',1))

gallery=(backup/'GALLERIA_LEADIN_R3.html').read_text()
gallery=gallery.replace('R3 · Slippery Leadin · Bozza','R3 · Slippery Leadin · Pubblicata')
gallery=gallery.replace('BOZZA R3 — NON PUBBLICATA SU META.', 'R3 PUBBLICATA SU META — NOVE ANNUNCI IMPOSTATI ACTIVE.')
gallery=gallery.replace('Testimonianze riscontrate; conferma dell’autorizzazione d’uso ancora da documentare.',f'Consenso confermato da Antonio. Verifica: {when}. Stato Meta: {html.escape(status_text)}.')
gallery=gallery.replace('<a href="GALLERIA.html">Annunci R1 attualmente pubblicati</a>',f'<a href="{campaign_url}">Apri la campagna su Meta</a>')
(p/'GALLERIA_LEADIN_R3.html').write_text(gallery)
(p/'GALLERIA.html').write_text(gallery)

fields=['code','hook','body','headline','description','article_url','landing_url','source','ad_name','meta_ad_id','meta_creative_id','publication_status']
for filename in ['ANNUNCI.csv','ANNUNCI_LEADIN_R3.csv']:
    with (p/filename).open('w',newline='') as f:
        w=csv.DictWriter(f,fieldnames=fields);w.writeheader();w.writerows({k:a[k] for k in fields} for a in r['ads'])

(p/'README.md').write_text(f'''# Nove aperture Slippery Leadin — campagna R3

**Pubblicate e verificate su Meta il {when}.** Tre aperture per ognuno dei tre advertorial, nove annunci impostati ACTIVE. Stato effettivo alla rilettura: **{status_text}**.

[Galleria aggiornata](GALLERIA.html) · [Testi e titoli](CREATIVITA.md) · [CSV annunci](ANNUNCI.csv) · [Piano](PIANO.md) · [Ricevuta Meta](LEADIN_R3_RECEIPT.json) · [Campagna in Ads Manager]({campaign_url})

Le aperture partono da citazioni reali di Elena, Vincenzo e Daniel. Antonio ha confermato il consenso scritto per tutte e tre. Il Brain contiene il chiarimento operativo sullo Slippery Leadin e la conferma ricevuta.

Per ciascun articolo, le tre varianti condividono corpo, titolo sotto l’immagine, descrizione, foto illustrativa AI, pulsante e destinazione. Cambia l’apertura. Le immagini attive sono tre; le nove immagini originali rimangono disponibili in `assets/`. La distribuzione di Meta non è un test randomizzato.

**100 €/giorno di media complessivi; campagna continuativa, senza data di fine o limite cumulativo.** Italia, età minima 38, lingua italiana; segnali genitori 13–17/18–26, non certificazione che ogni persona raggiunta sia genitore. Facebook e Instagram Feed. Ottimizzazione Lead sul sito, pixel `311586900940615`.

Durante il lavoro lo storico Meta ha registrato la rimozione dell’esclusione lead recenti da un altro operatore alle 13:20; tale impostazione è stata mantenuta. [Evidenza della modifica](LEADIN_R3_ADSET_CURRENT_BASELINE.json). La pubblicazione R3 ha modificato soltanto nomi e creatività dei nove annunci.

Percorsi annuncio → articolo → landing personalizzata e parametri UTM preservati. Nella rilettura, tutti gli annunci mantengono il pixel previsto e l’ad set ottimizza per LEAD. Le verifiche precedenti degli eventi restano documentate; non è stato creato un nuovo lead fittizio.

R1 conservata nell’archivio; R2 ritirata e mai applicata. Gli ID degli annunci sono gli stessi: per giudicare R3 separare il periodo successivo alla modifica dallo storico precedente. Nessun monitoraggio automatico nuovo configurato.
''')

(p/'PIANO.md').write_text(f'''# Piano operativo — R3 Slippery Leadin

Stato: pubblicata, verifica {when}. [Ricevuta](LEADIN_R3_RECEIPT.json). Il nome storico “Test 01” non indica una data di fine.

## Obiettivo e budget

Acquisire lead che completano la registrazione sulla landing, attraversando annuncio → advertorial → landing personalizzata. Campagna OUTCOME_LEADS, sito web, OFFSITE_CONVERSIONS, evento LEAD, pixel `311586900940615`.

Budget medio **100 €/giorno per l’intera campagna**. Campagna continuativa, senza data di fine né tetto cumulativo. Le finestre di analisi non sono scadenze della campagna e non autorizzano aumenti del budget.

## Pubblico e posizionamenti

Italia, minimo 38 anni, 65+ come massimo UI, tutti i generi, italiano; Advantage+ Audience disattivato. Segnali genitori con figli 13–17 e 18–26 anni, senza promessa di raggiungere esclusivamente genitori. Facebook Feed e Instagram Feed.

L’esclusione dei lead recenti è stata rimossa nell’account durante il lavoro, alle 13:20 del 19 settembre, come documentato nello storico Meta. Questa revisione dei copy conserva la configurazione corrente e non interviene sul pubblico.

## Storie, aperture e destinazioni

| Gruppo | Fonte narrativa | Articolo |
| --- | --- | --- |
| A01 | Elena: difficoltà nel dialogo intorno alla partita e cambiamento osservato | cosa-dire-dopo-brutta-partita |
| A02 | Vincenzo: padre allenatore, paura dell’errore e pochi minuti per dimostrare | fiducia-dopo-errore-calcio |
| A03 | Daniel: poco impiego, fiducia e ritorno al piacere di giocare | mio-figlio-gioca-poco |

Tre aperture di 11–14 parole per gruppo. Si entra nel passaggio di maggior intensità o nel cambiamento documentato, poi si sviluppa il racconto. Nessun episodio aggiunto come fatto reale. Consenso all’uso delle tre testimonianze confermato da Antonio. Le foto sono illustrazioni AI dichiarate, non foto dei recensenti.

Ogni articolo accompagna alla landing `/f/salto-di-qualita?entry=blog-<slug>`. L’annuncio promette l’approfondimento effettivamente presente, non una biografia integrale del recensente nella destinazione.

## Disegno del confronto

Dentro ogni gruppo cambiano solo le aperture. Corpo, headline, descrizione, visual, CTA e URL restano identici. Le trasformazioni automatiche del copy e delle immagini risultano disattivate nella rilettura dei creativi. Meta può distribuire quantità diverse di traffico: scarsa distribuzione non dimostra che una variante sia perdente.

La revisione rispetto a R1 cambia anche corpo, headline e abbinamento del visual. Non è un confronto causale del solo incipit rispetto a R1. Nessuna delle tre storie viene chiamata vincente in anticipo.

## Misurazione

- KPI principale: costo per Lead registrato; collegare poi qualità del contatto, appuntamenti e vendite.
- Passaggi diagnostici: visita advertorial, clic verso landing, visita landing, registrazione riuscita. Preservare ID annuncio, UTM e provenienza articolo.
- UTM fissi: `{r['url_tags']}`.
- Nomi con tag `T:` validi e verificati nel Funnel Routing Engine. L’entry dell’articolo determina il contenuto pertinente della landing.
- Il registro della pubblicazione conserva primo e ultimo istante della sostituzione. Gli stessi ID comprendono lo storico R1: escluderlo dall’analisi R3. Per report giornalieri puliti, partire dal 20 settembre; la porzione del 19 richiede separazione temporale.
- Valutare spesa, esposizione e conversioni prima di intervenire. Nessuna promessa di CPL minimo o 5× ROAS; finestre di osservazione senza spegnimento automatico.

## Verifiche completate

Nove creativi riletti campo per campo, 18 anteprime Meta generate; controllo UI rappresentativo Facebook e Instagram. Tutti i nove annunci sono impostati ACTIVE. Budget, continuità, pubblico corrente, pixel, tracking specs e destinazioni riletti dopo l’applicazione. Stati effettivi: {status_text}.

Verifiche precedenti: ricezione CAPI di test e coerenza event ID browser/server; tre percorsi reali con parametri. Questa modifica non aggiunge un test Lead fittizio né dimostra un tasso aggregato di deduplicazione o risultati commerciali già ottenuti.

## Fonti e registri

[Testi](CREATIVITA.md), [autorizzazione](LEADIN_R3_AUTHORIZATION.json), [stato prima](LEADIN_R3_BEFORE.json), [registro modifiche](LEADIN_R3_LEDGER.json), [ricevuta dopo](LEADIN_R3_RECEIPT.json). Riferimento creativo persistente: `AV Brain/wiki/comunicazione/meta-ads-procedura.md` e chiarimento Slippery Leadin del 19 settembre 2026.
''')

table='\n'.join(f'| {a["code"]} | `{a["meta_ad_id"]}` | `{a["meta_creative_id"]}` | {a["effective_status"]} |' for a in r['ads'])
(p/'PUBBLICAZIONE.md').write_text(f'''# Pubblicazione R3 — nove aperture

**Nove annunci aggiornati su Meta e impostati ACTIVE.** Verifica {when}; stato effettivo: {status_text}.

[Apri la campagna]({campaign_url}) · [Galleria](GALLERIA.html) · [Ricevuta completa](LEADIN_R3_RECEIPT.json)

Campagna `120251780591420047`, ad set `120251780591590047`. **100 €/giorno medi complessivi, senza data di fine e senza limite cumulativo.** Evento LEAD sul pixel `311586900940615`.

| Variante | ID annuncio | Nuovo creativo R3 | Stato effettivo |
| --- | --- | --- | --- |
{table}

Modificati nomi e assegnazioni dei creativi dei nove annunci esistenti. Budget, programmazione, pixel, tracking e pubblico corrente preservati. La rimozione dell’esclusione lead recenti delle 13:20 proviene da una modifica contemporanea registrata in Meta e non da questo script; vedere `LEADIN_R3_ADSET_CURRENT_BASELINE.json`.

La richiesta di attivazione e gli stati di elaborazione/revisione Meta sono distinti. I risultati precedenti alla sostituzione appartengono alla R1. Prima modifica: `{receipt['first_mutation_at']}`; ultima: `{receipt['last_mutation_at']}`.

R2 mai applicata. Vecchi creativi conservati per storico; nessun annuncio duplicato, nessun incremento di budget. Autorizzazione d’uso delle tre testimonianze confermata da Antonio in `LEADIN_R3_AUTHORIZATION.json`.
''')

f=p/'AUDIT_TESTI_GROUNDINGWELL_2.md'
s=f.read_text().replace('[R3: nove aperture e racconti preparati](REVISIONE_LEADIN_R3.md), non ancora pubblicati; R2 ritirata.', '[R3: nove aperture e racconti pubblicati e verificati](REVISIONE_LEADIN_R3.md), dopo conferma di Antonio sull’uso delle testimonianze; R2 ritirata. L’audit qui sotto conserva il riscontro storico sulla R1.')
f.write_text(s)
f=Path('/Users/antoniovalente/Desktop/AV Brain/output/meta-ads-slippery-leadin-chiarimento-2026-09-19.md')
s=f.read_text().replace('- R3: nove aperture preparate localmente, con tre varianti per articolo e testimonianze di Elena, Vincenzo e Daniel riscontrate su Trustpilot. Nessuna pubblicazione R3 effettuata.',f'- **R3 pubblicata e verificata su Meta il {when}:** nove aperture, tre per articolo, con testimonianze di Elena, Vincenzo e Daniel riscontrate su Trustpilot. Nove annunci impostati ACTIVE; stati effettivi alla rilettura: {status_text}. Ricevuta `LEADIN_R3_RECEIPT.json`.')
s=s.replace('- La campagna R1 resta attiva, 100 €/giorno medi complessivi e continuativa.','- La stessa campagna ora usa i nove creativi R3, con 100 €/giorno medi complessivi e programmazione continuativa. Nessun monitoraggio automatico nuovo configurato.')
s=re.sub(r'^- \*\*R3 pubblicata e verificata su Meta.*$', f'- **R3 pubblicata e verificata su Meta il {when}:** nove annunci impostati ACTIVE; stati effettivi alla rilettura: {status_text}. Ricevuta `LEADIN_R3_RECEIPT.json`.', s, flags=re.M)
f.write_text(s)
print(json.dumps({'status':'DELIVERABLES_SYNCED_WITH_META_RECEIPT','verified_at':receipt['checked_at'],'effective_statuses':statuses,'ads':9},ensure_ascii=False))
