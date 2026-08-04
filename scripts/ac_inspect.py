#!/usr/bin/env python3
"""
Ispettore ActiveCampaign — mappa automazioni → trigger → slot email → messageid.

Da lanciare sul Mac (la rete del cloud non raggiunge api-us1.com):

  cd ~/Desktop/sincro
  export $(grep -E '^ACTIVECAMPAIGN' .env.local | xargs)
  python3 scripts/ac_inspect.py               # tutte le automazioni
  python3 scripts/ac_inspect.py 6             # solo l'automazione 6

Per ogni automazione stampa: stato, trigger (con nome del tag risolto),
e per ogni blocco "invia email": campaignid → messageid → oggetto,
segnalando con TEMPLATE i corpi ancora al default dell'editor.
In fondo suggerisce le righe --write per ac_write_emails.py
abbinando gli oggetti alle 19 email note.
"""

import json
import os
import sys
import urllib.request

BASE = os.environ.get('ACTIVECAMPAIGN_BASE_URL', '').rstrip('/')
KEY = os.environ.get('ACTIVECAMPAIGN_API_KEY', '')

if not BASE or not KEY:
    sys.exit("Mancano ACTIVECAMPAIGN_BASE_URL / ACTIVECAMPAIGN_API_KEY nell'ambiente.")

# Nel .env.local la BASE_URL include già /api/3 — normalizza in ogni caso.
if not BASE.endswith('/api/3'):
    BASE += '/api/3'

# oggetto → chiave email in ac_write_emails.py (per suggerire i --write)
SUBJECT_TO_KEY = {
    'Tuo figlio ci sta già pensando (anche se non te lo dice)': 'A1',
    '«Stai tranquillo» è la frase che gli fa più male': 'A2',
    '1.100 ragazzi. Nessuno di loro era «quello dotato».': 'A3',
    'Tuo figlio gioca ancora?': 'B1',
    'Chiudo': 'B2',
    'Lunedì 24, ore 21:00 — come si imposta la stagione': 'W1',
    'Le prime tre settimane decidono i nove mesi dopo': 'W2',
    '«Ma serve anche se gioca bene?»': 'W3',
    'Stasera alle 21:00': 'W4',
    'Sei dentro — manca un passaggio': 'R1',
    'Ti sei perso il pezzo importante': 'R1bis',
    'Domani sera alle 21:00': 'R2',
    'Tra 3 ore': 'R3',
    'Siamo live tra 15 minuti': 'R4',
    'Ieri sera hai fatto una cosa che pochi genitori fanno': 'P1',
    'Non c’eri ieri — ecco la registrazione': 'P2',
    '«Ma il mio è timido, non si aprirà mai»': 'P3',
    'Tolgo la registrazione stasera': 'P4',
    'Chiudo le candidature per settembre': 'P5',
}

TEMPLATE_MARKER = 'Progetta qui la tua email'


def get(path):
    req = urllib.request.Request(f"{BASE}/{path}", headers={'Api-Token': KEY})
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.loads(r.read().decode('utf-8'))


def first_list(payload, *candidates):
    """Le risposte AC usano chiavi diverse (automationBlocks, non blocks...):
    prova le chiavi candidate, poi qualsiasi valore che sia una lista."""
    for k in candidates:
        if k in payload and isinstance(payload[k], list):
            return payload[k]
    for v in payload.values():
        if isinstance(v, list):
            return v
    return []


def tag_name(tagid, cache={}):
    if tagid in cache:
        return cache[tagid]
    try:
        name = get(f"tags/{tagid}").get('tag', {}).get('tag', f'tag {tagid}?')
    except Exception:
        name = f'tag {tagid}?'
    cache[tagid] = name
    return name


STATUS = {'1': 'ATTIVA', '2': 'inattiva', '0': 'bozza'}


def main():
    only = sys.argv[1] if len(sys.argv) > 1 else None
    autos = get('automations?limit=100').get('automations', [])
    write_hints = []

    for a in autos:
        if only and a['id'] != only:
            continue
        print(f"\n━━ Automazione {a['id']} — {a['name']}  [{STATUS.get(a.get('status'), a.get('status'))}]")

        # trigger
        try:
            trigs = first_list(get(f"automations/{a['id']}/triggers"), 'automationTriggers', 'triggers')
        except Exception as e:
            trigs = []
            print(f"   (trigger non leggibili: {e})")
        for t in trigs:
            ttype = t.get('type', '?')
            params = t.get('params') or {}
            if isinstance(params, str):
                try:
                    params = json.loads(params)
                except Exception:
                    params = {'raw': params}
            desc = ttype
            tagid = params.get('tagid') or params.get('tag')
            listid = params.get('listid') or params.get('list')
            if tagid:
                desc += f" → tag {tagid} ({tag_name(tagid)})"
            if listid:
                desc += f" → lista {listid}"
            extra = {k: v for k, v in params.items() if k not in ('tagid', 'tag', 'listid', 'list')}
            if extra:
                desc += f"  {extra}"
            print(f"   trigger: {desc}")

        # blocchi → slot email
        try:
            blocks = first_list(get(f"automations/{a['id']}/blocks"), 'automationBlocks', 'blocks')
        except Exception as e:
            print(f"   (blocchi non leggibili: {e})")
            continue
        for b in blocks:
            if b.get('type') != 'send':
                continue
            params = b.get('params') or {}
            if isinstance(params, str):
                try:
                    params = json.loads(params)
                except Exception:
                    params = {}
            cid = params.get('campaignid')
            if not cid:
                print(f"   slot email (blocco {b.get('id')}): campaignid mancante")
                continue
            try:
                cm = get(f"campaigns/{cid}/campaignMessage").get('campaignMessage', {})
                mid = cm.get('messageid')
                msg = get(f"messages/{mid}").get('message', {})
            except Exception as e:
                print(f"   slot email: campagna {cid} → errore lettura ({e})")
                continue
            subject = msg.get('subject') or '(senza oggetto)'
            html = msg.get('html') or ''
            is_template = TEMPLATE_MARKER in html or not html.strip()
            flag = '⚠️ TEMPLATE/VUOTO' if is_template else 'ok'
            key = SUBJECT_TO_KEY.get(subject)
            keytxt = f"  [{key}]" if key else ''
            print(f"   slot email: campagna {cid} → msg {mid} — “{subject}”{keytxt}  [{flag}]")
            if key and is_template:
                write_hints.append(f"{key}={mid}")

    if write_hints:
        print("\n═══ Da scrivere adesso ═══")
        print("python3 scripts/ac_write_emails.py --write " + " ".join(write_hints))
    else:
        print("\nNessuno slot con corpo mancante tra quelli riconosciuti.")


if __name__ == '__main__':
    main()
