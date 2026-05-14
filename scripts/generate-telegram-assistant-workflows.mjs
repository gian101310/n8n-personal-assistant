import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const workflowsDir = join(root, "workflows");
const docsDir = join(root, "docs");

const SPREADSHEET_ID = "162DpKJTcJROOaCVN7r5gUdOv3q1X17VvYvgMt-Du20Y";
const TELEGRAM_CHAT_ID = "REPLACE_WITH_YOUR_TELEGRAM_CHAT_ID";

function baseWorkflow(id, name, nodes, connections, settings = {}) {
  return {
    id,
    name,
    nodes,
    pinData: {},
    connections,
    active: false,
    settings: {
      timezone: "Asia/Dubai",
      ...settings,
    },
    versionId: id,
    meta: {
      templateCredsSetupCompleted: false,
    },
    tags: [],
  };
}

function telegramSendNode(id, name, position, textExpression) {
  return {
    parameters: {
      resource: "message",
      operation: "sendMessage",
      chatId: TELEGRAM_CHAT_ID,
      text: textExpression,
      additionalFields: {
        appendAttribution: false,
      },
    },
    id,
    name,
    type: "n8n-nodes-base.telegram",
    typeVersion: 1.2,
    position,
    credentials: {
      telegramApi: {
        id: "",
        name: "Telegram account",
      },
    },
  };
}

function googleSheetNode(id, name, operation, sheetName, position, extra = {}) {
  return {
    parameters: {
      authentication: "oAuth2",
      resource: "sheet",
      operation,
      documentId: {
        mode: "id",
        value: SPREADSHEET_ID,
      },
      sheetName: {
        mode: "name",
        value: sheetName,
      },
      ...extra,
    },
    id,
    name,
    type: "n8n-nodes-base.googleSheets",
    typeVersion: 3,
    position,
    credentials: {
      googleSheetsOAuth2Api: {
        id: "",
        name: "Google Sheets account",
      },
    },
  };
}

function codeNode(id, name, position, jsCode, mode = "runOnceForAllItems") {
  return {
    parameters: {
      mode,
      language: "javaScript",
      jsCode,
    },
    id,
    name,
    type: "n8n-nodes-base.code",
    typeVersion: 2,
    position,
  };
}

function scheduleNode(id, name, position, interval) {
  return {
    parameters: {
      rule: {
        interval: [interval],
      },
    },
    id,
    name,
    type: "n8n-nodes-base.scheduleTrigger",
    typeVersion: 1.3,
    position,
  };
}

const normalizeIncomingCode = String.raw`const item = $input.first();
const update = item.json || {};
const message = update.message || update.edited_message || {};
const chatId = message.chat?.id ? String(message.chat.id) : "";
const text = message.text || message.caption || "";
const createdAt = new Date().toISOString();
const binary = item.binary || {};
const firstBinaryKey = Object.keys(binary)[0];
const image = firstBinaryKey ? binary[firstBinaryKey] : null;

const schema = {
  type: "object",
  additionalProperties: false,
  properties: {
    intent: { type: "string", enum: ["expense", "receipt", "todo", "reminder", "task_done", "unknown"] },
    date: { type: "string" },
    merchant: { type: "string" },
    amount: { type: "number" },
    currency: { type: "string" },
    category: { type: "string", enum: ["Food", "Transport", "Groceries", "Bills", "Shopping", "Business", "Health", "Entertainment", "Travel", "Other"] },
    payment_method: { type: "string" },
    card: { type: "string" },
    notes: { type: "string" },
    task: { type: "string" },
    type: { type: "string", enum: ["todo", "reminder", ""] },
    due_at: { type: "string" },
    task_match_text: { type: "string" },
    confidence: { type: "number" }
  },
  required: ["intent", "date", "merchant", "amount", "currency", "category", "payment_method", "card", "notes", "task", "type", "due_at", "task_match_text", "confidence"]
};

const systemPrompt = [
  "You are a personal assistant that extracts expenses, todos, reminders, and completed-task commands from Telegram messages.",
  "Use Asia/Dubai timezone. Today's date/time is " + createdAt + ".",
  "Default currency is AED. For unknown values, use empty strings, category Other, amount 0, and confidence below 0.6.",
  "If the user mentions a specific card or account, put the broad method in payment_method and the specific name in card. Examples: payment_method card, card ADCB Visa; payment_method cash, card empty string.",
  "Known debit cards: ADCB Debit, ENBD Debit, DIB Debit, RAK Debit, CBD Debit.",
  "Known credit cards: ADCB Credit, ENBD Credit, DIB Credit, RAK Credit, TABBY Credit.",
  "Recurring payment names: ADCB Credit Card Payment, ENBD Credit Card Payment, DIB Credit Card Payment, RAK Credit Card Payment, TABBY Payment, ETISALAT Payment.",
  "If the user says a bank plus debit or credit, normalize card to the matching known card name. If a new card name is mentioned, preserve it exactly in card so it can be auto-added later.",
  "For receipt photos, extract the most likely merchant, date, total amount, currency, and category.",
  "For reminders, resolve relative dates such as tomorrow morning into ISO 8601 with timezone offset when possible.",
  "For task completion messages like 'done buy printer ink', set intent task_done and task_match_text to the task phrase."
].join("\n");

const content = [{ type: "input_text", text: text || "Parse this receipt image." }];
if (image?.data) {
  content.push({
    type: "input_image",
    image_url: "data:" + (image.mimeType || "image/jpeg") + ";base64," + image.data
  });
}

return [{
  json: {
    chatId,
    createdAt,
    source: image ? "telegram_photo" : "telegram_text",
    originalText: text,
    openaiBody: {
      model: "gpt-4.1-mini",
      input: [
        { role: "system", content: [{ type: "input_text", text: systemPrompt }] },
        { role: "user", content }
      ],
      text: {
        format: {
          type: "json_schema",
          name: "telegram_assistant_parse",
          strict: true,
          schema
        }
      }
    }
  }
}];`;

const parseOpenAiCode = String.raw`const response = $input.first().json;
let text = response.output_text;
if (!text && Array.isArray(response.output)) {
  for (const output of response.output) {
    for (const content of output.content || []) {
      if (content.type === "output_text" && content.text) text = content.text;
    }
  }
}
let parsed;
try {
  parsed = JSON.parse(text || "{}");
} catch (error) {
  parsed = { intent: "unknown", notes: "OpenAI returned invalid JSON", confidence: 0 };
}
const now = new Date().toISOString();
const amount = Number(parsed.amount || 0);
const intent = parsed.intent || "unknown";
const confidence = Number(parsed.confidence || 0);

return [{
  json: {
    ...parsed,
    intent,
    amount,
    confidence,
    CreatedAt: now,
    confirmation:
      intent === "expense" || intent === "receipt"
        ? "Saved expense: " + (parsed.merchant || "Unknown merchant") + " " + amount + " " + (parsed.currency || "AED") + " (" + (parsed.category || "Other") + ")" + (confidence < 0.7 ? "\nLow confidence - please check the sheet." : "")
        : intent === "todo"
          ? "Saved todo: " + (parsed.task || parsed.notes || "Task")
          : intent === "reminder"
            ? "Saved reminder: " + (parsed.task || "Reminder") + (parsed.due_at ? "\nDue: " + parsed.due_at : "")
            : intent === "task_done"
              ? "I'll mark this done if I find a matching open task: " + (parsed.task_match_text || parsed.task || "")
              : "I could not understand that yet. Try sending an expense, todo, reminder, or receipt photo."
  }
}];`;

const expenseRowCode = String.raw`return $input.all().map((item) => ({
  json: {
    Date: item.json.date || new Date().toISOString().slice(0, 10),
    Merchant: item.json.merchant || "",
    Amount: Number(item.json.amount || 0),
    Currency: item.json.currency || "AED",
    Category: item.json.category || "Other",
    "Payment Method": item.json.payment_method || "",
    Card: item.json.card || "",
    Notes: item.json.notes || "",
    Source: item.json.intent === "receipt" ? "receipt" : "telegram_text",
    Confidence: item.json.confidence || 0,
    "Created At": item.json.CreatedAt || new Date().toISOString()
  }
}));`;

const taskRowCode = String.raw`return $input.all().map((item) => ({
  json: {
    Task: item.json.task || item.json.notes || "",
    Type: item.json.intent === "reminder" ? "reminder" : "todo",
    Status: "open",
    "Due At": item.json.due_at || "",
    Notes: item.json.notes || "",
    "Created At": item.json.CreatedAt || new Date().toISOString(),
    "Completed At": ""
  }
}));`;

const findTaskToCompleteCode = String.raw`const target = ($node["Parse OpenAI Result"].json.task_match_text || "").toLowerCase();
const rows = $input.all();
const openRows = rows.filter((item) => String(item.json.Status || "").toLowerCase() === "open");
function score(task) {
  const words = target.split(/\s+/).filter(Boolean);
  const value = String(task || "").toLowerCase();
  return words.filter((word) => value.includes(word)).length;
}
let best = null;
let bestScore = 0;
for (const item of openRows) {
  const current = score(item.json.Task);
  if (current > bestScore) {
    best = item;
    bestScore = current;
  }
}
if (!best || bestScore === 0) {
  return [{ json: { confirmation: "I could not find a matching open task. Try: done exact task name" } }];
}
return [{
  json: {
    row_number: best.json.row_number,
    Task: best.json.Task,
    Type: best.json.Type,
    Status: "done",
    "Due At": best.json["Due At"] || "",
    Notes: best.json.Notes || "",
    "Created At": best.json["Created At"] || "",
    "Completed At": new Date().toISOString(),
    confirmation: "Marked done: " + best.json.Task
  }
}];`;

const dueReminderCode = String.raw`const now = new Date();
return $input.all()
  .filter((item) => {
    const j = item.json;
    if (String(j.Type || "").toLowerCase() !== "reminder") return false;
    if (String(j.Status || "").toLowerCase() !== "open") return false;
    if (!j["Due At"]) return false;
    const due = new Date(j["Due At"]);
    return !Number.isNaN(due.getTime()) && due <= now;
  })
  .map((item) => ({
    json: {
      ...item.json,
      reminderText: "Reminder: " + item.json.Task,
      row_number: item.json.row_number
    }
  }));`;

const weeklySummaryCode = String.raw`const items = $input.all().map((item) => item.json);
const oneWeekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
const expenses = items.filter((row) => row.Amount !== undefined && row.Date);
const tasks = items.filter((row) => row.Task !== undefined);
const recent = expenses.filter((row) => {
  const t = new Date(row.Date).getTime();
  return Number.isNaN(t) || t >= oneWeekAgo;
});
const byCategory = {};
let total = 0;
let highest = null;
for (const expense of recent) {
  const amount = Number(expense.Amount || 0);
  total += amount;
  const category = expense.Category || "Other";
  byCategory[category] = (byCategory[category] || 0) + amount;
  if (!highest || amount > Number(highest.Amount || 0)) highest = expense;
}
const lines = ["Weekly summary", "", "Total spend: " + total.toFixed(2) + " AED"];
for (const [category, amount] of Object.entries(byCategory).sort((a, b) => b[1] - a[1])) {
  lines.push("- " + category + ": " + amount.toFixed(2) + " AED");
}
if (highest) lines.push("", "Highest: " + (highest.Merchant || "Unknown") + " - " + Number(highest.Amount || 0).toFixed(2) + " AED");
const openTasks = tasks.filter((task) => String(task.Status || "").toLowerCase() === "open").slice(0, 8);
lines.push("", "Open tasks: " + openTasks.length);
for (const task of openTasks) lines.push("- " + task.Task + (task["Due At"] ? " (" + task["Due At"] + ")" : ""));
return [{ json: { summaryText: lines.join("\n") } }];`;

const openAiNode = {
  parameters: {
    authentication: "predefinedCredentialType",
    nodeCredentialType: "openAiApi",
    method: "POST",
    url: "https://api.openai.com/v1/responses",
    sendBody: true,
    contentType: "json",
    specifyBody: "json",
    jsonBody: "={{ JSON.stringify($json.openaiBody) }}",
    options: {},
  },
  id: "assistant-openai-parse",
  name: "OpenAI Parse Message",
  type: "n8n-nodes-base.httpRequest",
  typeVersion: 4.4,
  position: [680, 300],
  credentials: {
    openAiApi: {
      id: "",
      name: "OpenAI account",
    },
  },
};

const inboxWorkflow = baseWorkflow(
  "telegram-personal-assistant-inbox",
  "Telegram Personal Assistant - Inbox",
  [
    {
      parameters: {
        updates: ["message"],
        additionalFields: {
          download: true,
          imageSize: "large",
          chatIds: TELEGRAM_CHAT_ID,
        },
      },
      id: "assistant-telegram-trigger",
      name: "Telegram Inbox",
      type: "n8n-nodes-base.telegramTrigger",
      typeVersion: 1.3,
      position: [220, 300],
      credentials: {
        telegramApi: {
          id: "",
          name: "Telegram account",
        },
      },
    },
    codeNode("assistant-normalize", "Normalize Telegram Input", [450, 300], normalizeIncomingCode),
    openAiNode,
    codeNode("assistant-parse-openai", "Parse OpenAI Result", [910, 300], parseOpenAiCode),
    {
      parameters: {
        mode: "expression",
        numberOutputs: 4,
        output: "={{ ($json.intent === 'expense' || $json.intent === 'receipt') ? 0 : (($json.intent === 'todo' || $json.intent === 'reminder') ? 1 : ($json.intent === 'task_done' ? 2 : 3)) }}",
      },
      id: "assistant-route-intent",
      name: "Route Intent",
      type: "n8n-nodes-base.switch",
      typeVersion: 3.4,
      position: [1140, 300],
    },
    codeNode("assistant-expense-row", "Prepare Expense Row", [1380, 80], expenseRowCode),
    googleSheetNode("assistant-append-expense", "Append Expense", "append", "Expenses", [1620, 80], {
      dataMode: "autoMapInputData",
      options: { useAppend: true, handlingExtraData: "insertInNewColumn" },
    }),
    telegramSendNode("assistant-expense-confirm", "Confirm Expense", [1860, 80], "={{ $('Parse OpenAI Result').item.json.confirmation }}"),
    codeNode("assistant-task-row", "Prepare Task Row", [1380, 260], taskRowCode),
    googleSheetNode("assistant-append-task", "Append Task", "append", "Tasks", [1620, 260], {
      dataMode: "autoMapInputData",
      options: { useAppend: true, handlingExtraData: "insertInNewColumn" },
    }),
    telegramSendNode("assistant-task-confirm", "Confirm Task", [1860, 260], "={{ $('Parse OpenAI Result').item.json.confirmation }}"),
    googleSheetNode("assistant-read-tasks", "Read Tasks for Done", "read", "Tasks", [1380, 460], {
      filtersUI: {},
      combineFilters: "AND",
      options: {},
    }),
    codeNode("assistant-find-task", "Find Task to Complete", [1620, 460], findTaskToCompleteCode),
    googleSheetNode("assistant-update-task", "Update Completed Task", "update", "Tasks", [1860, 460], {
      dataMode: "defineBelow",
      columnToMatchOn: "row_number",
      valueToMatchOn: "={{ $json.row_number }}",
      fieldsUi: {
        values: [
          { column: "Status", fieldValue: "done" },
          { column: "Completed At", fieldValue: "={{ $json['Completed At'] }}" },
        ],
      },
      options: {},
    }),
    telegramSendNode("assistant-done-confirm", "Confirm Done", [2100, 460], "={{ $json.confirmation || $('Find Task to Complete').item.json.confirmation }}"),
    telegramSendNode("assistant-unknown-confirm", "Confirm Unknown", [1380, 660], "={{ $json.confirmation }}"),
  ],
  {
    "Telegram Inbox": { main: [[{ node: "Normalize Telegram Input", type: "main", index: 0 }]] },
    "Normalize Telegram Input": { main: [[{ node: "OpenAI Parse Message", type: "main", index: 0 }]] },
    "OpenAI Parse Message": { main: [[{ node: "Parse OpenAI Result", type: "main", index: 0 }]] },
    "Parse OpenAI Result": { main: [[{ node: "Route Intent", type: "main", index: 0 }]] },
    "Route Intent": {
      main: [
        [{ node: "Prepare Expense Row", type: "main", index: 0 }],
        [{ node: "Prepare Task Row", type: "main", index: 0 }],
        [{ node: "Read Tasks for Done", type: "main", index: 0 }],
        [{ node: "Confirm Unknown", type: "main", index: 0 }],
      ],
    },
    "Prepare Expense Row": { main: [[{ node: "Append Expense", type: "main", index: 0 }]] },
    "Append Expense": { main: [[{ node: "Confirm Expense", type: "main", index: 0 }]] },
    "Prepare Task Row": { main: [[{ node: "Append Task", type: "main", index: 0 }]] },
    "Append Task": { main: [[{ node: "Confirm Task", type: "main", index: 0 }]] },
    "Read Tasks for Done": { main: [[{ node: "Find Task to Complete", type: "main", index: 0 }]] },
    "Find Task to Complete": { main: [[{ node: "Update Completed Task", type: "main", index: 0 }]] },
    "Update Completed Task": { main: [[{ node: "Confirm Done", type: "main", index: 0 }]] },
  }
);

const reminderWorkflow = baseWorkflow(
  "telegram-personal-assistant-reminders",
  "Telegram Personal Assistant - Reminder Sender",
  [
    scheduleNode("reminder-schedule", "Every 5 Minutes", [220, 300], { field: "minutes", minutesInterval: 5 }),
    googleSheetNode("reminder-read-tasks", "Read Tasks", "read", "Tasks", [460, 300], {
      filtersUI: {},
      combineFilters: "AND",
      options: {},
    }),
    codeNode("reminder-filter-due", "Filter Due Reminders", [700, 300], dueReminderCode),
    telegramSendNode("reminder-send", "Send Reminder", [940, 300], "={{ $json.reminderText }}"),
    googleSheetNode("reminder-mark-sent", "Mark Reminder Sent", "update", "Tasks", [1180, 300], {
      dataMode: "defineBelow",
      columnToMatchOn: "row_number",
      valueToMatchOn: "={{ $json.row_number }}",
      fieldsUi: {
        values: [
          { column: "Status", fieldValue: "sent" },
        ],
      },
      options: {},
    }),
  ],
  {
    "Every 5 Minutes": { main: [[{ node: "Read Tasks", type: "main", index: 0 }]] },
    "Read Tasks": { main: [[{ node: "Filter Due Reminders", type: "main", index: 0 }]] },
    "Filter Due Reminders": { main: [[{ node: "Send Reminder", type: "main", index: 0 }]] },
    "Send Reminder": { main: [[{ node: "Mark Reminder Sent", type: "main", index: 0 }]] },
  }
);

const weeklyWorkflow = baseWorkflow(
  "telegram-personal-assistant-weekly-summary",
  "Telegram Personal Assistant - Weekly Summary",
  [
    scheduleNode("weekly-schedule", "Sunday 7 PM", [220, 300], {
      field: "weeks",
      weeksInterval: 1,
      triggerAtDay: [0],
      triggerAtHour: 19,
      triggerAtMinute: 0,
    }),
    googleSheetNode("weekly-read-expenses", "Read Expenses", "read", "Expenses", [460, 180], {
      filtersUI: {},
      combineFilters: "AND",
      options: {},
    }),
    googleSheetNode("weekly-read-tasks", "Read Tasks", "read", "Tasks", [460, 420], {
      filtersUI: {},
      combineFilters: "AND",
      options: {},
    }),
    {
      parameters: {
        mode: "append",
        numberInputs: 2,
      },
      id: "weekly-merge",
      name: "Merge Expenses and Tasks",
      type: "n8n-nodes-base.merge",
      typeVersion: 3.2,
      position: [720, 300],
    },
    codeNode("weekly-build-summary", "Build Weekly Summary", [960, 300], weeklySummaryCode),
    telegramSendNode("weekly-send-summary", "Send Weekly Summary", [1200, 300], "={{ $json.summaryText }}"),
  ],
  {
    "Sunday 7 PM": {
      main: [
        [
          { node: "Read Expenses", type: "main", index: 0 },
          { node: "Read Tasks", type: "main", index: 0 },
        ],
      ],
    },
    "Read Expenses": { main: [[{ node: "Merge Expenses and Tasks", type: "main", index: 0 }]] },
    "Read Tasks": { main: [[{ node: "Merge Expenses and Tasks", type: "main", index: 1 }]] },
    "Merge Expenses and Tasks": { main: [[{ node: "Build Weekly Summary", type: "main", index: 0 }]] },
    "Build Weekly Summary": { main: [[{ node: "Send Weekly Summary", type: "main", index: 0 }]] },
  }
);

const setupDoc = `# Telegram Personal Assistant Setup

## 1. Google Sheet

Create one Google Sheet with two tabs.

Expenses headers:

\`\`\`text
Date,Merchant,Amount,Currency,Category,Payment Method,Card,Notes,Source,Confidence,Created At
\`\`\`

Tasks headers:

\`\`\`text
Task,Type,Status,Due At,Notes,Created At,Completed At
\`\`\`

Copy the spreadsheet ID from the URL and replace \`${SPREADSHEET_ID}\` in each imported Google Sheets node.

## 2. n8n Credentials

Create or select these credentials in n8n:

- Telegram account
- Google Sheets account
- OpenAI account

No workflow file contains your secret tokens or API keys.

## 3. Telegram Chat ID

Replace \`${TELEGRAM_CHAT_ID}\` in Telegram nodes and the Telegram Trigger chat restriction.

## 4. Import Workflows

Import:

- \`workflows/telegram-assistant-inbox.json\`
- \`workflows/telegram-reminder-sender.json\`
- \`workflows/telegram-weekly-summary.json\`

After import, open each workflow and confirm the credentials, spreadsheet ID, chat ID, and sheet names.

## 5. Test Messages

Send these to your Telegram bot:

\`\`\`text
paid 42 AED for lunch at KFC
todo buy printer ink
remind me tomorrow 9am to call supplier
done buy printer ink
\`\`\`

You can also send a receipt photo. The Telegram Trigger node must have Download Images/Files enabled.

## 6. Keep n8n Running

Because this is local hosting, reminders and weekly summaries only run while n8n is running on your computer.
`;

await mkdir(workflowsDir, { recursive: true });
await mkdir(docsDir, { recursive: true });
await writeFile(join(workflowsDir, "telegram-assistant-inbox.json"), JSON.stringify(inboxWorkflow, null, 2));
await writeFile(join(workflowsDir, "telegram-reminder-sender.json"), JSON.stringify(reminderWorkflow, null, 2));
await writeFile(join(workflowsDir, "telegram-weekly-summary.json"), JSON.stringify(weeklyWorkflow, null, 2));
await writeFile(join(docsDir, "telegram-assistant-setup.md"), setupDoc);

console.log("Generated Telegram assistant workflows.");
