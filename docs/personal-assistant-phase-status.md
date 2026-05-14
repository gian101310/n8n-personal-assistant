# n8n Personal Assistant Status

Last updated: 2026-05-14, Asia/Dubai.

## Live Workflows

- `Telegram Personal Assistant - Inbox`
  - Telegram message/photo intake.
  - OpenAI strict JSON parsing.
  - Expenses, tasks, reminders, and completed-task commands.
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

Imported but not yet active:

- `Telegram Personal Assistant - Inbox Supabase`
- `Telegram Personal Assistant - Daily Summary Supabase`
- `Telegram Personal Assistant - Reminder Sender Supabase`

Manual activation step:

1. Create `.env` from `.env.example`.
2. Add your Supabase service-role key as `SUPABASE_SERVICE_ROLE_KEY`.
3. Restart n8n with `start-n8n-with-ngrok.ps1`.
4. Publish the Supabase workflows and unpublish the Google Sheets versions.

## Dashboard

Built locally:

- Next.js dashboard at `http://127.0.0.1:3000`
- Server-side Supabase reads using `.env`
- Today metrics, recent expenses, open tasks, category/card breakdowns, and recent logs
- Task completion action from the dashboard

Verification:

- `npm test -- --run`
- `npm run build`
- local dashboard HTTP check returned `200 OK`

Still pending:

- Live verification of Telegram voice with OpenAI transcription.
- Hosted dashboard deployment.

## Voice Support

Added to `Telegram Personal Assistant - Inbox`:

- voice routing after Telegram normalization
- OpenAI `gpt-4o-mini-transcribe` transcription node
- transcript handoff into the existing expense/task parser
- voice transcript logging through the existing Supabase log branch

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

Current limitation:

- High-confidence text expenses/tasks still save immediately unless uncertainty words are present.
- `cancel` still needs one more live Telegram test after the reply-keyboard switch.

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

- Voice support needs Telegram file download plus Whisper transcription. The current workflow detects voice input, but does not yet transcribe it.
- Receipt photo support is enabled through OpenAI vision for Telegram photos. Real-world accuracy should be tested with your receipts.
- Supabase needs a Supabase project before the Sheets database can be migrated.
- Memory and semantic search need a database table plus embeddings storage.
- Dashboard needs a hosting choice. Good options: Vercel for a lightweight web dashboard, or Supabase + Vercel when the database phase starts.
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
