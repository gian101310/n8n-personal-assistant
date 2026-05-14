# Telegram Personal Assistant Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build importable n8n workflows for a Telegram assistant that tracks expenses, todos, reminders, and weekly summaries in Google Sheets using OpenAI extraction.

**Architecture:** Use three n8n workflow JSON files: assistant inbox, reminder sender, and weekly summary. Keep API keys and OAuth secrets out of files; credentials and spreadsheet IDs are configured in n8n after import.

**Tech Stack:** n8n workflow JSON, Telegram nodes, Google Sheets nodes, HTTP/OpenAI calls, Code nodes.

---

### Task 1: Create Workflow Files

**Files:**
- Create: `C:\Users\Admin\Documents\Codex\2026-05-14\i-want-to-start-a-small\workflows\telegram-assistant-inbox.json`
- Create: `C:\Users\Admin\Documents\Codex\2026-05-14\i-want-to-start-a-small\workflows\telegram-reminder-sender.json`
- Create: `C:\Users\Admin\Documents\Codex\2026-05-14\i-want-to-start-a-small\workflows\telegram-weekly-summary.json`
- Create: `C:\Users\Admin\Documents\Codex\2026-05-14\i-want-to-start-a-small\docs\telegram-assistant-setup.md`

- [ ] **Step 1: Inspect installed n8n node schemas**

Run targeted reads of installed node definitions for Telegram Trigger, Telegram, Google Sheets, HTTP Request, Schedule Trigger, and Code nodes.

- [ ] **Step 2: Create Assistant Inbox workflow**

Create the workflow with:
- Telegram Trigger
- Code node to normalize incoming text/photo metadata
- HTTP Request node to OpenAI Responses API for text parsing
- routing for expense/todo/reminder/task_done/unknown
- Google Sheets append/update nodes
- Telegram confirmation nodes

- [ ] **Step 3: Create Reminder Sender workflow**

Create the workflow with:
- Schedule Trigger every 5 minutes
- Google Sheets read rows
- Code node to filter due reminders
- Telegram send message
- Google Sheets update status to `sent`

- [ ] **Step 4: Create Weekly Summary workflow**

Create the workflow with:
- Schedule Trigger every Sunday 7:00 PM Asia/Dubai
- Google Sheets read expenses/tasks
- Code node to summarize totals and open tasks
- Telegram send message

- [ ] **Step 5: Create setup documentation**

Document:
- Google Sheet tabs and column headers
- credentials needed
- placeholders to replace
- Telegram test messages
- local n8n runtime note

- [ ] **Step 6: Validate JSON**

Run: `Get-Content <workflow-file> -Raw | ConvertFrom-Json`

Expected: all workflow files parse without errors.
