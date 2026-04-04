# Infrastruttura Sincro / AdPilotik

## Stack & Deploy Pipeline

```
Codice (locale) → GitHub → Vercel (auto-deploy) → Produzione
                     ↕              ↕
                  MCP Server    MCP Server
                  (github)      (supabase)
```

## Servizi

| Servizio | Ruolo | Accesso |
|---|---|---|
| **GitHub** | Repository codice | `antoniovalente1982/sincro` — MCP `github-mcp-server` |
| **Vercel** | Hosting & deploy | Auto-deploy su push a `main` — progetto `adpilotik` |
| **Supabase** | Database & Auth | Project ID: `jbcfcfigfvllhsviuvrl` — MCP `supabase-mcp-server` |
| **Google** | Sheets API, Analytics | Integrato via API keys in env vars |
| **Meta** | Ads API, CAPI, Pixel | Graph API v21.0 — token in Supabase `organization_settings` |
| **Telegram** | Notifiche lead | Bot token in `organization_settings` |

## Deploy Flow

1. Modifica codice locale (`/Users/antoniovalente/Desktop/sincro`)
2. `git add` + `git commit` + `git push origin main`
3. Vercel rileva il push e builda automaticamente (~30s)
4. Live su `landing.metodosincro.com` + dashboard `adpilotik`

**NON serve** accedere a Vercel manualmente. Push su GitHub = deploy.

## MCP Server Connessi

- **`github-mcp-server`** → Gestione repo, PR, issues, file, branches
- **`supabase-mcp-server`** → Query SQL, migrazioni, edge functions, tipi TypeScript

## Nota per AI

- Per deployare: **git push**, non servono altri strumenti
- Per query database: usa MCP Supabase (`execute_sql`, `apply_migration`)
- Per operazioni GitHub: usa MCP GitHub (`push_files`, `create_pull_request`)
- Il `.agents/` è in `.gitignore` — i workflow non vanno committati
- Il branch di produzione è `main`
