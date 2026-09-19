# Editorial Journey Implementation Plan

> **For agentic workers:** Use subagent-driven-development with bounded file ownership; follow tasks continuously, without another approval checkpoint.

**Goal:** Measure advertorial visits, landing arrivals and saved requests, expose per-article results and a contact timeline.

**Architecture:** A consent-aware browser tracker posts typed events to a same-origin API. The server resolves the published page and organization, persists editorial events separately from funnel statistics, and sends consented Meta events with shared browser/server IDs. Submission success is recorded by the existing submit endpoint. Authenticated reports group observed visitor cohorts and distinguish directly attributed requests without an observed visit.

**Tech Stack:** Next.js 16, React 19, TypeScript, Supabase/Postgres, node:test.

## Shared contract

`editorial_events` rows: `id`, `organization_id`, `event_id`, `event_name` (`advertorial_view`, `advertorial_engaged`, `advertorial_cta`, `landing_view`, `landing_engaged`, `form_start`, `lead_submitted`), `visitor_id` and `session_id` (nullable UUID), `entry_key` (nullable `blog-<slug>` or `advertorial-pochi-minuti`), `article_id`, `funnel_id`, `page_path`, `occurred_at`, `utm_source`, `utm_medium`, `utm_campaign`, `utm_content`, `utm_term`, `submission_id`, `lead_id`, `metadata` (attribution and Meta delivery status). IDs except event_id are UUIDs; record uniqueness is organization_id + event_id. Lead records may lack visitor_id when tracking is declined. Records contain no submitted contact fields.

## Tasks

- [x] 1. Domain and database. Create `lib/editorial-tracking.ts`, its tests and `supabase/migrations/20260919_editorial_events.sql`. Write failing tests for consent expiry, event validation, attribution, URL normalization, session rollover and pixel resolution. Implement explicit allowlists, 30-day attribution, 30-minute session timeout, same-origin URL normalization, separate analytics/marketing decisions. Table is private to service role; report APIs enforce existing roles and tenant isolation.
- [x] 2. Browser tracker. Create `lib/editorial-tracking-client.ts`, `components/EditorialTracking.tsx` and scoped consent CSS. Initialize the pixel before queuing events, share event IDs with server, count 30 visible seconds plus 50% article scroll as engagement, capture CTA and first form focus, send keepalive requests. Honor refusal, revocation, previews and unavailable storage. Tests use an isolated browser mock; no real Meta traffic.
- [x] 3. Server collection. Create `lib/editorial-tracking-server.ts` and `app/api/track/editorial/route.ts`. Resolve only published supported URLs into the correct organization, reject forged kinds and oversized input, filter bots and previews, retain only allowed campaign data, deduplicate inserts and Meta dispatch. Resolve pixel from organization connection and reject conflicting funnel config. Server consent follows the browser cookie; no marketing event on refusal.
- [x] 4. Wire public pages and submissions. Add tracker to `/blog/[slug]`, replace the legacy advertorial tracker and the V2 landing's tracker/pixel. Preserve the submission interface via getter functions. Save source + consent + session with the accepted request, register `lead_submitted` server-side and link it after new/existing CRM lead resolution. Normalize already absolute landing URLs. Keep commercial automations and funnel counts intact; suppress both browser and CAPI Lead for denied marketing on the new flow.
- [x] 5. Report and contact view (bounded delegated task). Create `lib/editorial-report.ts`, behavioral tests, authenticated `/api/blog/results` and `/api/leads/[id]/editorial-journey`, `BlogResults.tsx` and `LeadEditorialJourney.tsx`. Update `BlogPanel.tsx` and `CRMBoard.tsx` only for integration. Fetch paginated rows without silent Supabase limits, compute visitor cohorts with chronological 30-day windows, deduplicate global totals, distinguish requests and contacts. Reuse existing styles; loading/error/empty states and date/article filters.
- [x] 6. Verify and release. Run focused tests, regression tests, TypeScript/build, browser checks of consent/tracking with network interceptions, read-only production config checks, private migration transaction tests and independent review. Apply additive migration, deploy only reviewed files, verify published HTML/assets and unauthenticated API denial. Report test-event receipt separately from local verification; do not create commercial test leads or campaigns.

## Verification commands

```sh
node --import tsx --test lib/editorial-tracking.test.ts lib/editorial-report.test.ts
node --import tsx --test lib/blog.test.ts lib/advertorial.test.ts lib/editorial-landing.test.ts lib/landing-behavior.test.ts
npx tsc --noEmit
npm run build
git diff --check
```

Assertions include: invalid explicit source does not fall back; cross-tenant source is discarded; reading alone never generates Lead; requests with no observed article remain out of cohort conversion rates; a repeat request counts twice as requests and once as a contact; one browser reading two articles counts once globally; a blocked pixel never breaks the form; test traffic never calls production lead automations.

## Verifica eseguita il 19 settembre 2026

48 test automatici superati; TypeScript, lint mirato, build e `git diff --check` superati. Sei scenari browser e prova integrata endpoint/database superati. Revisioni indipendenti specifica e qualità approvate. Migrazione additiva applicata e accessi anonimi negati. Nessun lead commerciale di prova né invio Meta reale generato. La ricezione in Meta e il rilascio sono rendicontati separatamente nel [resoconto operativo](../../../outputs/editorial-tracking-2026-09-19/README.md).

Rilascio online completato: commit `29eeebcc`, 19 pagine con pixel e destinazione personalizzata verificate, sei scenari browser ripetuti sul sito pubblico e raccolta endpoint/database verificata. Connessione Meta valida (HTTP 200). Ricezione e deduplicazione effettive in Gestione eventi restano da confermare; non dichiarate verificate.
