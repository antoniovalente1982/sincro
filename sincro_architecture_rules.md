# Sincro Architecture Rules & Manifesto

Queste regole sono **MANDATORIO** per qualsiasi AI o Sviluppatore che lavora su Metodo Sincro.
Se stai per scrivere codice, fermati e leggi questo file.

## 1. Architettura Multi-Agent Swarm (Hermes CEO)
L'obiettivo di Sincro non è essere un semplice gestionale, ma un sistema completamente autonomo.
- **Hermes è il CEO (Orchestratore):** Non fa lavori manuali sporchi. Valuta i KPI (North Star), calcola il budget e *delega* task ad altri agenti specializzati (Media Buyer, Copywriter, Creative Studio).
- **Non usare un singolo Agent loop per tutto:** Il codice deve essere modulare. Ogni area (Meta Ads, Creazione Landing, Generazione Creatività) deve avere il proprio agente con il proprio System Prompt isolato.

## 2. 100% Data-Driven UI (Niente Scritte Hard-Coded)
L'intelligenza artificiale **NON DEVE MAI** modificare i file del codice sorgente Vercel (Next.js `.tsx`) per compiere un'ottimizzazione di copy o di funnel.
- **Supabase è il Re:** Se l'Agente Copywriter vuole fare A/B test cambiando un titolo, lo deve fare aggiornando la riga corrispondente nel database Supabase (es. tabelle `funnel_routing_engine`, `landing_page_config`, ecc.).
- **La UI si idrata da Sola:** Il framework Next.js deve essere costruito per leggere header, recensioni, moduli e colori direttamente da Supabase in realtime.

## 3. Gestione e Ottimizzazione dei Token LLM
Le chiamate LLM costano. Un'azienda AI non può sprecare margini in Token inutili.
- **Micro-Modelli per Routine:** Le decisioni matematiche, le deleghe di Hermes e i controlli giornalieri vanno fatti con prompt limitati e modelli efficienti (Claude 3.5 Haiku, Llama 3).
- **Macro-Modelli per Creatività:** O1-Pro o Sonnet 3.5 si usano SOLO quando l'Agente Creativo deve scrivere un'email persuasiva, creare copy ad alta conversione o impostare un framework psicologico profondo. Nessun modello gigante per smistare webhook.
- **Risposte in JSON:** Qualsiasi comunicazione inter-agente DEVE avvenire tramite JSON strutturato estraibile facilmente, mai testi narrativi inutili.

## 4. Esperienza e Apprendimento (Vector Memory)
Gli Agenti non devono risolvere gli incroci con memoria corta.
- Usa le tabelle dedicate (`agent_knowledge`, o le future `ai_experience_memory`) per salvare gli esiti positivi/negativi degli esperimenti sulle ADS o sul Funnel.
- Prima di lanciare un test, l'Agente pertinente DEVE interrogare la memoria per assicurarsi di non ripetere un test fallito nei mesi precedenti.

## 5. UI dell'Ai-Engine Trasparente
Il pannello `AI Engine` nella dashboard deve mostrare esattamente cosa sta succedendo per rassicurare l'utente umano.
- I log in streaming devono essere visibili.
- Il catalogo degli Agenti (Team) e le loro "Skills" attuali devono essere facilmente consultabili da database.

---
**Ultimo aggiornamento:** 2026-04-07
**Ingegnere:** Antigravity AI
