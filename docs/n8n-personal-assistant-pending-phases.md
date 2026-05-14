# n8n Personal Assistant Pending Phases

Use this as the roadmap whenever continuing this project.

## Phase 1 - Stabilize Confirmation Flow

Status: built and mostly verified.

Current:

- `assistant.pending_actions` exists.
- Text commands `confirm` and `cancel` are wired.
- Unclear/incomplete parses create pending actions.
- Pending confirmations now include Telegram reply-keyboard buttons.
- Missing required fields route to clarification instead of pending save.
- Inline button confirmation has been verified end to end.
- Confirm/cancel reads ignore expired pending actions.
- New confirm/cancel button taps arrive as normal Telegram text messages, avoiding callback-query delivery issues.
- Pending messages show merchant, amount, category, card/payment method, and notes when available.
- `undo last expense`, `delete last expense`, and `remove last expense` are wired as Telegram commands.

Needed:

- Test `cancel`.
- Test reply-keyboard `cancel` in Telegram after the latest polish.
- Live-test `undo last expense` from Telegram.

## Phase 2 - Receipt Hardening

Status: basic receipt/photo path exists, but needs real-world testing.

Needed:

- Test several real receipt photos.
- Improve extraction for:
  - merchant
  - total
  - currency
  - VAT/tax
  - card/payment method
  - date
- Route low-confidence receipt parses to pending confirmation.
- Store receipt raw payload and maybe file metadata.

## Phase 3 - Voice Support Polish

Status: basic voice pipeline works, but transcription quality may vary.

Current:

- Telegram voice file download works.
- `.oga` file is renamed to `.ogg`.
- OpenAI transcription runs.
- Transcript goes into the existing parser.

Needed:

- Test more voice samples.
- If transcription is weak, switch from `gpt-4o-mini-transcribe` to `gpt-4o-transcribe`.
- Add fallback message when transcript is too short or unclear.
- Consider keeping voice lower priority because text is reliable.

## Phase 4 - Memory And Preferences

Status: database tables exist.

Current:

- `assistant.preferences`
- `assistant.recurring_expenses`
- `assistant.recurring_tasks`
- `assistant.memories`
- `assistant.cards`
- pgvector enabled.
- Default currency is `AED`.
- Default card directory:
  - debit: ADCB, ENBD, DIB, RAK, CBD
  - credit: ADCB, ENBD, DIB, RAK, TABBY
- New card names saved on expenses are auto-added to the card directory.
- Recurring payment placeholders exist for ADCB, ENBD, DIB, RAK, TABBY, and ETISALAT.
- Budget tracker is saved as the next dashboard/assistant suggestion.
- Budget tracker schema and Vercel dashboard panel are built.

Needed:

- Store default category preferences.
- Build recurring-payment generation workflow.
- Add Telegram commands for setting budgets.
- Add semantic memory with embeddings.
- Retrieve memory before OpenAI parsing so it can infer defaults.

## Phase 5 - Recurring Expenses And Tasks

Status: schema exists, workflow not built.

Needed:

- Workflow to create due recurring expenses.
- Workflow to create due recurring tasks.
- Telegram command examples:
  - `add recurring rent 5000 monthly`
  - `add habit gym every Monday`
  - `list recurring`
  - `pause recurring Netflix`

## Phase 6 - Multi-Agent Routing

Status: not built.

Needed:

- Finance Agent for expenses, budgets, summaries.
- Task Agent for todos, reminders, priorities.
- Trading Agent for journal/review later.
- Research Agent for market/news summaries later.
- Admin Agent for unknown commands and corrections.

Recommended after memory works.

## Phase 7 - Proper Dashboard On Vercel

Status: deployed private dashboard exists.

Current:

- Live Vercel dashboard.
- Admin password login.
- Reads Supabase server-side.
- Shows KPIs, filters, monthly chart, expenses, tasks, logs, category/card breakdown, and card directory.
- Includes a Budget Tracker panel for monthly category limits.

Needed:

- Expense edit modal.
- Budget edit/delete controls.
- Task dashboard.
- Receipt review queue.
- AI insights page.

## Phase 8 - Production Hosting

Status: local n8n plus ngrok.

Needed:

- Pick hosting:
  - n8n Cloud
  - Railway
  - Render
  - VPS/Docker
- Replace temporary ngrok with stable public URL.
- Move secrets to hosted environment.
- Add error notifications.
- Add backup/export process.

## Next Recommended Work

1. Test `cancel` and callback acknowledgement.
2. Add `undo last expense` / correction commands.
3. Harden receipts.
4. Build memory/preferences.
5. Later, rebuild dashboard properly on Vercel.
