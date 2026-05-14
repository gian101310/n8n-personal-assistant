# n8n Personal Assistant

Telegram personal assistant powered by n8n, OpenAI, Supabase, and a private Next.js/Vercel dashboard.

## Current Status

The core assistant is working:

- Telegram text expenses and tasks.
- Supabase storage.
- OpenAI parsing.
- Daily and weekly summary workflows.
- Reminder sender.
- Basic voice transcription path.
- Private Vercel dashboard with admin login.
- Pending confirmation flow with `confirm` / `cancel`.
- Card directory defaults and auto-add for new card names.
- AED default currency.

## Important URLs

- n8n editor: `http://localhost:5678`
- Local dashboard: `http://127.0.0.1:3000`
- Live dashboard: `https://n8n-personal-assistant-chi.vercel.app`
- Supabase project: `https://supabase.com/dashboard/project/uxdueryjbfzfvyznxgax`
- Current ngrok URL is managed by `start-n8n-with-ngrok.ps1`

## Restart n8n

```powershell
& 'C:\Users\Admin\Documents\Codex\2026-05-14\i-want-to-start-a-small\start-n8n-with-ngrok.ps1'
```

## Start Dashboard

```powershell
npm run dev -- --hostname 127.0.0.1 --port 3000
```

## Secrets

Runtime secrets are loaded from `.env`.

Required:

```env
SUPABASE_URL=https://uxdueryjbfzfvyznxgax.supabase.co
SUPABASE_SERVICE_ROLE_KEY=...
DASHBOARD_ADMIN_PASSWORD=...
DASHBOARD_SESSION_TOKEN=...
```

Do not paste the service-role key into chat or commit it.

## Active n8n Workflows

- `Telegram Personal Assistant - Inbox`
- `Telegram Personal Assistant - Reminder Sender`
- `Telegram Personal Assistant - Weekly Summary`
- `Telegram Personal Assistant - Daily Summary`

## Main Local Files

- `start-n8n-with-ngrok.ps1` - starts ngrok and n8n with environment variables.
- `docs/personal-assistant-phase-status.md` - full implementation status.
- `docs/n8n-personal-assistant-pending-phases.md` - next build phases.
- `supabase/migrations/` - Supabase schema migrations.
- `workflows/` - exported n8n workflows and snapshots.
- `src/app/` - local Next.js dashboard proof-of-concept.
- `scripts/` - workflow generation/patch scripts.
