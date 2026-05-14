# Telegram Personal Assistant n8n Workflow Design

## Goal

Create a practical Telegram-based n8n assistant for personal expenses, todos, reminders, and weekly summaries. The first version should be useful immediately, easy to inspect in Google Sheets, and simple enough to maintain.

## User Experience

The user sends natural Telegram messages to one bot.

Supported examples:

```text
paid 42 AED for lunch at KFC
todo buy printer ink
remind me tomorrow 9am to call supplier
done buy printer ink
```

The user can also send a receipt photo. The assistant replies with a short confirmation after saving the item.

## Storage

Use one Google Sheet with two tabs.

### Expenses Tab

Columns:

1. Date
2. Merchant
3. Amount
4. Currency
5. Category
6. Payment Method
7. Card
8. Notes
9. Source
10. Confidence
11. Created At

### Tasks Tab

Columns:

1. Task
2. Type
3. Status
4. Due At
5. Notes
6. Created At
7. Completed At

Allowed `Type` values:

- `todo`
- `reminder`

Allowed `Status` values:

- `open`
- `done`
- `sent`

## Workflow 1: Telegram Assistant Inbox

Trigger: Telegram message or photo sent to the bot.

Flow:

1. Receive the Telegram update.
2. If the update contains text, send the text to OpenAI for classification and extraction.
3. If the update contains a photo or document image, download the file from Telegram and send it to OpenAI vision for receipt extraction.
4. OpenAI returns structured JSON.
5. n8n routes by `intent`.
6. Expense or receipt data is appended to the `Expenses` tab.
7. Todo or reminder data is appended to the `Tasks` tab.
8. Telegram sends a concise confirmation.

Supported `intent` values:

- `expense`
- `receipt`
- `todo`
- `reminder`
- `task_done`
- `unknown`

If the intent is `unknown`, the workflow asks the user to rephrase.

If the intent is `task_done`, the workflow searches the `Tasks` tab for the closest matching open todo or reminder and updates its status to `done`. If no close match is found, it asks the user to be more specific.

## Workflow 2: Reminder Sender

Trigger: Schedule every 5 minutes.

Flow:

1. Read the `Tasks` tab.
2. Find rows where:
   - `Type` is `reminder`
   - `Status` is `open`
   - `Due At` is earlier than or equal to the current time
3. Send each reminder by Telegram.
4. Update each sent row to `Status = sent`.

All reminder due times use the Asia/Dubai timezone.

## Workflow 3: Weekly Summary

Trigger: Every Sunday at 7:00 PM Asia/Dubai time.

Flow:

1. Read the `Expenses` tab.
2. Filter expenses from the last 7 days.
3. Group totals by category.
4. Calculate total spend.
5. Read open tasks from the `Tasks` tab.
6. Send a Telegram summary with:
   - total weekly spend
   - category totals
   - highest expense if available
   - open todos and pending reminders

## OpenAI Behavior

OpenAI should return structured JSON so the workflow can route and save data reliably.

Expense output fields:

- `intent`
- `date`
- `merchant`
- `amount`
- `currency`
- `category`
- `payment_method`
- `card`
- `notes`
- `confidence`

Task output fields:

- `intent`
- `task`
- `type`
- `due_at`
- `notes`
- `confidence`

Task completion output fields:

- `intent`
- `task_match_text`
- `confidence`

Categories for version 1:

- Food
- Transport
- Groceries
- Bills
- Shopping
- Business
- Health
- Entertainment
- Travel
- Other

If a value is unknown, OpenAI should return an empty string or `Other` for category. For reminders with relative dates like "tomorrow morning", OpenAI should resolve the date using Asia/Dubai local time.

## Credentials Needed

The user must configure these credentials in n8n:

1. Telegram bot credential
2. Google Sheets credential
3. OpenAI API credential

The exported workflow files must not contain API keys, bot tokens, or OAuth secrets.

The workflows also need these user-configured values:

- Google Sheets spreadsheet ID
- Telegram chat ID for confirmations, reminders, and summaries
- Default currency: `AED`
- Timezone: `Asia/Dubai`

## Error Handling

For version 1:

- Unknown messages get a Telegram reply asking the user to rephrase.
- Low-confidence AI extraction is still saved, but the confirmation includes a note to check the sheet.
- If Google Sheets append fails, n8n execution history records the failure.
- If Telegram sending fails, n8n execution history records the failure.

## Testing

Manual test messages:

```text
paid 42 AED for lunch at KFC
todo buy printer ink
remind me tomorrow 9am to call supplier
done buy printer ink
```

Expected results:

- Expense text creates one row in `Expenses`.
- Todo text creates one row in `Tasks` with `Type = todo` and `Status = open`.
- Reminder text creates one row in `Tasks` with `Type = reminder`, `Status = open`, and a resolved `Due At`.
- Done text updates one matching open task to `Status = done` and sets `Completed At`.
- Receipt photo creates one row in `Expenses`.
- Weekly summary can be tested by temporarily changing its schedule or manually running the workflow.
