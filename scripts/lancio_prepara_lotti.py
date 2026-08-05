#!/usr/bin/env python3
"""
Prepara i lotti della rampa di invio — lancio 24 agosto 2026.

Divide la Lista 5 (12.440 contatti) in lotti NEUTRI (tag lancio26-lottoN),
escludendo i 500 già taggati lancio26-lotto1. I tag di lotto NON innescano
nessuna automazione: sono solo selettori. Ogni sera basta cercare
"tag = lancio26-lottoN" → seleziona tutti → aggiungi lancio26-caldo.

Rampa: lotto2=1000, lotto3=2000, lotto4=2000, lotto5=2500, lotto6=resto.

COME SI ESEGUE (dal Mac, dentro la cartella del repo):
    export $(grep -E '^ACTIVECAMPAIGN' .env.local | xargs)
    python3 scripts/lancio_prepara_lotti.py

Durata: ~30-40 minuti (rispetta il rate limit API). Si può interrompere e
rilanciare senza danni: salta i contatti già taggati.
"""
import json, os, sys, time, urllib.request, urllib.parse

BASE = os.environ["ACTIVECAMPAIGN_BASE_URL"].rstrip("/")
KEY = os.environ["ACTIVECAMPAIGN_API_KEY"].strip()
LIST_ID = 5
LOTTO1_TAG = 182
RAMPA = [("lancio26-lotto2", 1000), ("lancio26-lotto3", 2000),
         ("lancio26-lotto4", 2000), ("lancio26-lotto5", 2500),
         ("lancio26-lotto6", None)]  # None = tutto il resto

def call(method, path, payload=None, params=None, retries=4):
    url = f"{BASE}/{path}"
    if params:
        url += "?" + urllib.parse.urlencode(params)
    data = json.dumps(payload).encode() if payload is not None else None
    for attempt in range(retries):
        req = urllib.request.Request(url, data=data, method=method,
                                     headers={"Api-Token": KEY, "Content-Type": "application/json"})
        try:
            with urllib.request.urlopen(req, timeout=30) as r:
                return json.loads(r.read().decode() or "{}")
        except urllib.error.HTTPError as e:
            body = e.read().decode()[:200]
            if e.code in (429, 500, 502, 503) and attempt < retries - 1:
                time.sleep(2 ** attempt)
                continue
            raise RuntimeError(f"{method} {path} -> HTTP {e.code}: {body}")
        except Exception:
            if attempt < retries - 1:
                time.sleep(2 ** attempt)
                continue
            raise

def get_or_create_tag(name):
    data = call("GET", "tags", params={"filters[search][eq]": name, "limit": 100})
    for t in data.get("tags", []):
        if t.get("tag") == name:
            return int(t["id"])
    created = call("POST", "tags", {"tag": {"tag": name, "tagType": "contact",
                   "description": "Lotto rampa di invio lancio 24/8 — tag neutro, non innesca nulla."}})
    return int(created["tag"]["id"])

def contact_ids_with_tag(tag_id):
    ids, offset = set(), 0
    while True:
        data = call("GET", "contacts", params={"tagid": tag_id, "limit": 100, "offset": offset})
        got = data.get("contacts", [])
        ids.update(int(c["id"]) for c in got)
        if len(got) < 100:
            return ids
        offset += 100

def all_list_contact_ids():
    ids, offset = [], 0
    while True:
        data = call("GET", "contacts", params={"listid": LIST_ID, "limit": 100,
                                               "offset": offset, "orders[id]": "ASC"})
        got = data.get("contacts", [])
        ids.extend(int(c["id"]) for c in got)
        if len(got) < 100:
            return ids
        offset += 100
        if offset % 1000 == 0:
            print(f"  ...letti {len(ids)} contatti", flush=True)

def main():
    print("1) Leggo i 500 del lotto1...", flush=True)
    lotto1 = contact_ids_with_tag(LOTTO1_TAG)
    print(f"   lotto1: {len(lotto1)} contatti", flush=True)

    print("2) Leggo tutta la lista 5 in ordine di id...", flush=True)
    tutti = all_list_contact_ids()
    print(f"   lista 5: {len(tutti)} contatti", flush=True)

    resto = [i for i in tutti if i not in lotto1]
    print(f"   da distribuire nei lotti 2-6: {len(resto)}", flush=True)

    # controllo ripresa: escludi chi ha già un tag lotto2-6 (rilanci sicuri)
    plan = []
    cursor = 0
    for name, size in RAMPA:
        tag_id = get_or_create_tag(name)
        chunk = resto[cursor:cursor + size] if size else resto[cursor:]
        cursor += len(chunk)
        gia = contact_ids_with_tag(tag_id)
        todo = [c for c in chunk if c not in gia]
        plan.append((name, tag_id, chunk, todo))
        print(f"   {name} (tag {tag_id}): {len(chunk)} previsti, {len(gia)} già taggati, {len(todo)} da fare", flush=True)

    print("3) Applico i tag...", flush=True)
    done_total = 0
    for name, tag_id, chunk, todo in plan:
        for n, cid in enumerate(todo, 1):
            call("POST", "contactTags", {"contactTag": {"contact": cid, "tag": tag_id}})
            done_total += 1
            if n % 200 == 0:
                print(f"   {name}: {n}/{len(todo)}", flush=True)
            time.sleep(0.12)  # ~8 req/s max, sotto il rate limit
        print(f"   ✔ {name}: {len(todo)} taggati (lotto completo: {len(chunk)})", flush=True)

    print(f"FATTO. Tag applicati in questa corsa: {done_total}", flush=True)

if __name__ == "__main__":
    main()
