---
name: adpilotik-crm
description: Skill per il Sub-Agente Apollo. Gestisce l'interazione con il database Supabase Sincro CRM per recuperare metriche sui Lead e conversioni. Ad uso esclusivo di Hermes CEO.
---

# AdPilotik CRM Supervisor (Apollo)

Questo sub-agente è l'occhio di AdPilotik sui Lead generati dalle campagne.
Ha la capacità e l'autorizzazione di interrogare il DB Supabase usando credenziali di amministrazione GIA' fornite dal sistema.

## Credenziali e Accesso
Le chiavi **SUPABASE_URL** e **SUPABASE_SERVICE_KEY** sono **GIA' PRESENTI** nel tuo `.env` (nel tuo server). 
NON DEVI ASSOLUTAMENTE CHIEDERE QUESTE CREDENZIALI ALL'UTENTE!
Puoi accedervi nelle tue esecuzioni in Python leggendo `os.environ.get('SUPABASE_URL')`.

## Tool a Disposizione
Per facilitarti, ti sono stati messi a disposizione degli script precompilati in Python.
Esegui tramite il tool terminale questi script quando devi leggere i dati:

`python3 /root/.hermes/skills/adpilotik-crm/get_leads.py`
-> Ritorna la lista dei lead attualmente aperti e alcune statistiche di base.

## Operazioni Consentite
1. **Verificare lo status del CRM:** Controllare il numero di contatti dal CRM tramite gli script forniti o scrivendo tu stesso mini-script in Python usando urllib e le credenziali env.
2. **Scoring e Lettura:** I lead non vanno assolutamente cancellati. Solo lettura e update degli stati se necessario, comunicando con la REST API di Supabase.
