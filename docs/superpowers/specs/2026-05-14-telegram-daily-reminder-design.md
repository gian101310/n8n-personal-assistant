# Telegram Daily Reminder n8n Workflow Design

## Goal

Create a beginner-friendly n8n workflow that sends one Telegram reminder every day at 8:00 AM in the Asia/Dubai timezone.

## Workflow

The workflow has two nodes:

1. Schedule Trigger
   - Runs every day at 8:00 AM.
   - Uses the Asia/Dubai timezone.

2. Telegram Send Message
   - Sends a short daily reminder to one Telegram chat.
   - Uses n8n Telegram credentials, so the exported workflow does not contain a bot token.
   - Uses a placeholder chat ID that the user replaces after import.

## Reminder Text

Default message:

```text
Good morning. Time to check today's priorities and start with the most important task.
```

## Configuration Needed After Import

The user will need to:

1. Create a Telegram bot with BotFather.
2. Add the bot token to n8n as Telegram credentials.
3. Replace the placeholder chat ID in the Telegram node.
4. Activate the workflow.

## Error Handling

For this first small project, no extra error branch is included. n8n will show failed executions in the workflow execution history if the Telegram token, credential, or chat ID is wrong.

## Testing

The workflow can be tested by manually running the Telegram node after credentials and chat ID are configured. The schedule can be verified by temporarily changing the trigger time or using n8n's manual execution controls.
