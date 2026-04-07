---
name: adpilotik-crm
description: Skill per il Sub-Agente Apollo. Gestisce l'interazione con il database Supabase Sincro CRM per recuperare metriche sui Lead e conversioni. Ad uso esclusivo di Hermes CEO.
---

# AdPilotik CRM Supervisor (Apollo)

Questo sub-agente è l'occhio di AdPilotik sui Lead generati dalle campagne.
Ha la capacità e l'autorizzazione di interrogare la dashboard Vercel / DB Supabase usando le credenziali di amministrazione.

## Endpoint e Connessione
Per comunicare con Sincro e interrogare lo stato dei Leads, tu Hermes / Apollo DOVRAI sempre usare il tool terminale o fare richieste web al dominio del progetto.
Tuttavia, siccome l'integrazione è lato frontend-backend, ti interfaccerai eseguendo chiamate HTTP (via tool web o scripts Python temporanei via execute_code) verso gli endpoint API di Sincro.

[ATTENZIONE] Il codice backend di Sincro dovrà implementare e rispondere all'endpoint:
`POST https://tuo-dominio.com/api/hermes/crm-query` (con bearer token d'autenticazione).

Se Sincro non lo ha ancora, Hermes informerà Antonio per creare l'endpoint o costruirlo lui stesso.

## Operazioni Consentite
1. **Verificare lo status del CRM:** Controllare il numero di contatti "open", "lead", "booked_appointment".
2. **CPL Dinamico:** Confrontare i dati dei lead acquisiti di oggi con la spesa (se nota da Andromeda) per calcolare il reale CPL.
3. **Scoring:** Marcare sul CRM i lead come high/low priority in base ai dati emersi.

## Procedure Obbligatorie
1. Mai eliminare un lead dal database, puoi solo fare query di lettura o update di status (es. aggiornare una note).
2. Usa le chiavi SUPABASE localizzate su VPS.
