# n8n Personal Assistant Roadmap

## Phase 1 - Stabilize Current Workflow

Done:

- Strict OpenAI JSON schema.
- Required field validation.
- Clarification flow.
- Execution logs in the `Logs` tab.
- Stable Google Sheet IDs.
- Card/payment account field.

## Phase 2 - Improve Telegram Input

Done:

- Natural language expense/task/reminder parsing.
- Telegram receipt photo input through OpenAI vision.
- Unknown/missing intent clarification.

Still manual/future:

- Voice messages need a Telegram file-download plus Whisper transcription branch.
- Inline confirmation buttons need Telegram callback query handling.
- Edit/cancel flows need short-term pending-state storage.

## Phase 3 - Better Data Storage

Done:

- Sheet structure for expenses, tasks, and logs.
- Task IDs.
- Categories and payment/card capture.
- Supabase `assistant` schema created in `rtailtradr-maker's Project`.
- Public REST API views created for n8n service-role access.
- Supabase-backed n8n workflow versions imported as inactive workflows.
- Supabase card directory added with debit and credit defaults.
- Default currency set to `AED`.
- New cards from expenses auto-add to the card directory.
- Recurring payment placeholders added for credit cards and ETISALAT.
- Budget tracker schema added.

Prepared:

- Supabase SQL schema in `docs/supabase-schema.sql`.

Still manual/future:

- Add `SUPABASE_SERVICE_ROLE_KEY` to local `.env`.
- Restart n8n.
- Publish the Supabase workflow versions and unpublish the Google Sheets workflow versions.

## Phase 4 - Daily/Weekly Automation

Done:

- Daily 9 PM summary.
- Every-5-minute due reminder sender.
- Sunday 7 PM weekly summary.
- Weekly OpenAI review.

## Phase 6 - Memory System

Prepared:

- Preferences and memory tables in the Supabase schema.

Still manual/future:

- Add embeddings.
- Add retrieval before OpenAI parsing.
- Store recurring expenses/tasks.

## Phase 7 - Multi-Agent Upgrade

Prepared:

- Current parser already separates finance, task, reminder, completion, summary, and unknown intents.

Still manual/future:

- Split prompts into Finance Agent, Task Agent, Admin Agent, Trading Agent, and Research Agent.
- Add a router node that dispatches to agent-specific workflows.

## Phase 8 - Dashboard

Done:

- Dashboard spec in `docs/dashboard-spec.md`.
- Private Vercel dashboard with admin login.
- KPI cards, date/category/card filters, monthly chart, expense table, task list, logs, card breakdown, and card directory.
- Budget tracker panel with monthly category limits.

Still manual/future:

- Add editable expense rows.
- Add budget edit/delete controls and Telegram budget commands.
- Add receipt review queue.
- Add AI insights page.
