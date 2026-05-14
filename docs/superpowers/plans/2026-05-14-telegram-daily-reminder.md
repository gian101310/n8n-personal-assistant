# Telegram Daily Reminder Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an importable n8n workflow that sends a Telegram reminder every day at 8:00 AM Asia/Dubai time.

**Architecture:** The workflow uses one Schedule Trigger node connected to one Telegram Send Message node. Telegram authentication is handled by n8n credentials after import, so the JSON does not store a bot token.

**Tech Stack:** n8n workflow JSON, Schedule Trigger node, Telegram node.

---

### Task 1: Create Importable Workflow

**Files:**
- Create: `C:\Users\Admin\Documents\Codex\2026-05-14\i-want-to-start-a-small\workflows\telegram-daily-reminder.json`

- [ ] **Step 1: Create the workflow directory**

Run: `New-Item -ItemType Directory -Force -Path 'C:\Users\Admin\Documents\Codex\2026-05-14\i-want-to-start-a-small\workflows'`

Expected: directory exists.

- [ ] **Step 2: Create the n8n workflow JSON**

Create `telegram-daily-reminder.json` with two nodes:

```json
{
  "name": "Telegram Daily Reminder",
  "nodes": [
    {
      "parameters": {
        "rule": {
          "interval": [
            {
              "field": "days",
              "triggerAtHour": 8,
              "triggerAtMinute": 0
            }
          ]
        }
      },
      "id": "7d7d7f0d-b90a-40b3-a6c7-2e4c4c4f7b1a",
      "name": "Every day at 8 AM",
      "type": "n8n-nodes-base.scheduleTrigger",
      "typeVersion": 1.2,
      "position": [
        260,
        300
      ]
    },
    {
      "parameters": {
        "chatId": "REPLACE_WITH_YOUR_TELEGRAM_CHAT_ID",
        "text": "Good morning. Time to check today's priorities and start with the most important task.",
        "additionalFields": {}
      },
      "id": "f2d5bfa6-0690-4e10-b04c-d5f54a3d9c71",
      "name": "Send Telegram Reminder",
      "type": "n8n-nodes-base.telegram",
      "typeVersion": 1.2,
      "position": [
        540,
        300
      ],
      "credentials": {
        "telegramApi": {
          "id": "",
          "name": "Telegram account"
        }
      }
    }
  ],
  "pinData": {},
  "connections": {
    "Every day at 8 AM": {
      "main": [
        [
          {
            "node": "Send Telegram Reminder",
            "type": "main",
            "index": 0
          }
        ]
      ]
    }
  },
  "active": false,
  "settings": {
    "timezone": "Asia/Dubai"
  },
  "versionId": "8ad60c99-6e67-4a6f-bc63-f61868beaf75",
  "meta": {
    "templateCredsSetupCompleted": false
  },
  "tags": []
}
```

- [ ] **Step 3: Validate JSON syntax**

Run: `Get-Content 'C:\Users\Admin\Documents\Codex\2026-05-14\i-want-to-start-a-small\workflows\telegram-daily-reminder.json' -Raw | ConvertFrom-Json | Select-Object name, active`

Expected: output includes `Telegram Daily Reminder` and `False`.
