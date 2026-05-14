# Telegram Personal Assistant Setup

## 1. Google Sheet

Create one Google Sheet with two tabs.

Expenses headers:

```text
Date,Merchant,Amount,Currency,Category,Payment Method,Card,Notes,Source,Confidence,Created At
```

Tasks headers:

```text
Task,Type,Status,Due At,Notes,Created At,Completed At
```

Copy the spreadsheet ID from the URL and replace `162DpKJTcJROOaCVN7r5gUdOv3q1X17VvYvgMt-Du20Y` in each imported Google Sheets node.

## 2. n8n Credentials

Create or select these credentials in n8n:

- Telegram account
- Google Sheets account
- OpenAI account

No workflow file contains your secret tokens or API keys.

## 3. Telegram Chat ID

Replace `REPLACE_WITH_YOUR_TELEGRAM_CHAT_ID` in Telegram nodes and the Telegram Trigger chat restriction.

## 4. Import Workflows

Import:

- `workflows/telegram-assistant-inbox.json`
- `workflows/telegram-reminder-sender.json`
- `workflows/telegram-weekly-summary.json`

After import, open each workflow and confirm the credentials, spreadsheet ID, chat ID, and sheet names.

## 5. Test Messages

Send these to your Telegram bot:

```text
paid 42 AED for lunch at KFC
todo buy printer ink
remind me tomorrow 9am to call supplier
done buy printer ink
```

You can also send a receipt photo. The Telegram Trigger node must have Download Images/Files enabled.

## 6. Keep n8n Running

Because this is local hosting, reminders and weekly summaries only run while n8n is running on your computer.
