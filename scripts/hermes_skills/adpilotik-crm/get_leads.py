import urllib.request
import urllib.parse
import json
import os

supabase_url = os.environ.get('SUPABASE_URL')
supabase_key = os.environ.get('SUPABASE_SERVICE_KEY')

if not supabase_url or not supabase_key:
    print("ERRORE: Variabili SUPABASE_URL e SUPABASE_SERVICE_KEY non impostate.")
    exit(1)

# Fetch active leads
req = urllib.request.Request(
    f"{supabase_url}/rest/v1/leads?status=eq.open&select=*",
    headers={
        "apikey": supabase_key,
        "Authorization": f"Bearer {supabase_key}",
        "Content-Type": "application/json"
    }
)

try:
    with urllib.request.urlopen(req) as response:
        data = json.loads(response.read().decode())
        print(f"[{len(data)} Leads aperti trovati nel CRM]")
        # Provide a quick summary of the leads
        for lead in data[:5]:
            print(f"- Lead ID: {lead.get('id')}, Name: {lead.get('name')}, Source: {lead.get('source')}, Campaign: {lead.get('campaign_id')}")
        if len(data) > 5:
            print("... and others.")
except Exception as e:
    print(f"ERRORE di connessione a Supabase: {e}")
