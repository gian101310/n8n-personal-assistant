# n8n Personal Assistant Status

Last updated: 2026-05-14, Asia/Dubai.

## Live Workflows

- `Telegram Personal Assistant - Inbox Budget Commands`
  - Telegram message/photo intake.
  - OpenAI strict JSON parsing.
  - Expenses, tasks, reminders, and completed-task commands.
  - Memory commands for natural-language notes.
  - Budget commands for monthly category limits.
  - Google Sheets append/update.
  - Execution logging to the `Logs` tab.
  - Clarification replies when required fields are missing.

- `Telegram Personal Assistant - Daily Summary`
  - Runs daily at 9:00 PM Asia/Dubai.
  - Sends today's expense total, category breakdown, completed task count, and open task list.

- `Telegram Personal Assistant - Reminder Sender`
  - Runs every 5 minutes.
  - Finds open reminders with `Due At` in the past.
  - Sends the reminder to Telegram, then marks it as `sent`.

- `Telegram Personal Assistant - Weekly Summary`
  - Runs every Sunday at 7:00 PM Asia/Dubai.
  - Sends weekly expense/task totals plus an OpenAI-generated weekly review.

## Supabase Upgrade

Created in `rtailtradr-maker's Project`:

- private data schema: `assistant`
- public REST views for n8n:
  - `assistant_expenses`
  - `assistant_tasks`
  - `assistant_logs`
  - `assistant_preferences`
  - `assistant_recurring_expenses`
  - `assistant_recurring_tasks`
  - `assistant_memories`
  - `assistant_weekly_reviews`
  - `assistant_cards`

Defaults:

- default currency: `AED`
- parser context preference: category defaults and card aliases for the Telegram parser
- debit cards: `ADCB Debit`, `ENBD Debit`, `DIB Debit`, `RAK Debit`, `CBD Debit`
- credit cards: `ADCB Credit`, `ENBD Credit`, `DIB Credit`, `RAK Credit`, `TABBY Credit`
- recurring payment placeholders: ADCB, ENBD, DIB, RAK, TABBY, ETISALAT
- budget tracker is enabled with `assistant.budgets`
- new card names saved on expenses auto-add to the card directory
- memory retrieval RPC: `public.assistant_match_memories(...)`
- memory command RPCs: `public.assistant_create_memory(...)`, `public.assistant_forget_memory(...)`, `public.assistant_recent_memories(...)`

Imported but not yet active:

- `Telegram Personal Assistant - Inbox Supabase`
- `Telegram Personal Assistant - Inbox Memory Preferences`
- `Telegram Personal Assistant - Inbox Memory Commands`
- `Telegram Personal Assistant - Daily Summary Supabase`
- `Telegram Personal Assistant - Reminder Sender Supabase`

Manual activation step:

1. Create `.env` from `.env.example`.
2. Add your Supabase service-role key as `SUPABASE_SERVICE_ROLE_KEY`.
3. Restart n8n with `start-n8n-with-ngrok.ps1`.
4. Publish the Supabase workflows and unpublish the Google Sheets versions.

## Dashboard

Built and deployed:

- Vercel dashboard at `https://n8n-personal-assistant-chi.vercel.app`
- Server-side Supabase reads using `.env`
- Admin password login
- KPI cards, filters, monthly chart, expense table, task list, logs, card breakdown, card directory, and budget tracker
- Task completion, expense delete, budget update, and budget delete actions from the dashboard

Verification:

- `npm test -- --run`
- `npm run build`
- live login redirect and authenticated dashboard checks

Still pending:

- Live verification of Telegram voice with OpenAI transcription.
- Expense edit modal.
- Receipt review queue.

## Memory And Preferences

Added:

- Supabase `assistant.preferences` row `parser_context` with default currency, category defaults, and card aliases.
- Supabase RPC `public.assistant_match_memories(...)`, executable by `service_role`, for pgvector cosine memory lookup.
- Supabase RPCs for memory commands:
  - `public.assistant_create_memory(...)`
  - `public.assistant_forget_memory(...)`
  - `public.assistant_recent_memories(...)`
- Schema comments on `assistant.memories` documenting natural-language recall, including "remind me everything I told you as notes to remember".
- Importable n8n workflow export `workflows/telegram-assistant-inbox-memory-preferences.json`.
- Importable n8n workflow export `workflows/telegram-assistant-inbox-memory-commands.json`.
- Local n8n inactive workflow `Telegram Personal Assistant - Inbox Memory Preferences`.
- Local n8n inactive workflow `Telegram Personal Assistant - Inbox Memory Commands`.
- Parser context injection before OpenAI parsing for both text/photo messages and transcribed voice messages.
- Telegram memory commands:
  - `remember Costa is Food`
  - `note to remember: passport is in the black drawer`
  - `forget Costa category`
  - `what do you remember?`
  - `remind me everything I told you as notes to remember`
- Telegram budget commands in the latest generated inbox:
  - `set Food budget 1200`
  - `budget Groceries AED 800`
  - `delete Food budget`
  - `list budgets`
- New remembered notes are embedded with OpenAI `text-embedding-3-small` before saving to `assistant.memories`.

Current limitation:

- The latest budget-command workflow is active; memory and budget commands still need live Telegram verification.
- Semantic matching is available, but the parser still reads recent memories until enough real memories exist for useful matching.

## Voice Support

Added to `Telegram Personal Assistant - Inbox`:

- voice routing after Telegram normalization
- OpenAI `gpt-4o-mini-transcribe` transcription node
- transcript handoff into the existing expense/task parser
- voice transcript logging through the existing Supabase log branch
- retry handling for Telegram voice download and OpenAI transcription
- fallback Telegram replies when a voice note cannot be downloaded or transcribed

Manual test needed:

- Send a Telegram voice note such as: "spent 20 dirhams at Costa with ADCB Visa"
- Expected result: bot confirms the expense and Supabase stores it with source `telegram_voice`

## Confirmation Flow

Added:

- Supabase table `assistant.pending_actions`
- REST view `public.assistant_pending_actions`
- Telegram commands:
  - `confirm` confirms the latest pending item
  - `cancel` cancels the latest pending item
- Incomplete parsed items now ask for clarification instead of being saved.
- Uncertain complete items create a pending action.
- Uncertainty words such as `maybe`, `about`, `roughly`, and `not sure` force pending confirmation.
- Telegram confirmation now uses reply-keyboard buttons for confirm/cancel, so taps arrive as normal `confirm` / `cancel` messages.
- Inline callback-query wiring is still present for old inline messages, but new prompts avoid callback-query delivery issues.
- Pending confirmations show key details, including card/payment method when available.
- Pending actions are read only while unexpired.
- Telegram commands `undo last expense`, `delete last expense`, and `remove last expense` delete the newest saved expense and reply with the removed item.

Current limitation:

- High-confidence text expenses/tasks still save immediately unless uncertainty words are present.
- `cancel` still needs one more live Telegram test after the reply-keyboard switch.
- `undo last expense` needs one live Telegram test.

## Google Sheet Tabs

- `Expenses`
  - `Date`
  - `Merchant`
  - `Amount`
  - `Currency`
  - `Category`
  - `Payment Method`
  - `Card`
  - `Notes`
  - `Source`
  - `Confidence`
  - `Created At`

- `Tasks`
  - `Task ID`
  - `Task`
  - `Type`
  - `Status`
  - `Priority`
  - `Due At`
  - `Notes`
  - `Created At`
  - `Completed At`

- `Logs`
  - `Timestamp`
  - `Workflow`
  - `Chat ID`
  - `Raw Input`
  - `Intent`
  - `Parsed JSON`
  - `Status`
  - `Message`
  - `Missing Fields`
  - `Execution Source`

## What To Test In Telegram

Send these to your bot:

```text
spent 45 at Starbucks with ADCB Visa
```

```text
todo call the bank tomorrow high priority
```

```text
remind me to pay DEWA tomorrow at 9am
```

```text
done call the bank
```

For missing information:

```text
spent at Carrefour
```

Expected result: the bot asks for the missing amount instead of saving a bad row.

## Manual Items Still Needed Later

- Voice support needs more real-world testing with Telegram voice notes.
- Receipt photo support is enabled through OpenAI vision for Telegram photos. Real-world accuracy should be tested with your receipts.
- Memory commands need one live Telegram test before the memory-command workflow replaces the older inbox workflow.
- Multi-agent routing can be added inside n8n after the data model stabilizes.

## Restart Command

If n8n feels stuck, run:

```powershell
& 'C:\Users\Admin\Documents\Codex\2026-05-14\i-want-to-start-a-small\start-n8n-with-ngrok.ps1'
```

The current public webhook base URL is:

```text
https://stewart-unsizeable-rhapsodically.ngrok-free.dev
```
