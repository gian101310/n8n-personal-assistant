import fs from "node:fs";

const WORKSPACE = process.cwd();
const SHEET_ID = "162DpKJTcJROOaCVN7r5gUdOv3q1X17VvYvgMt-Du20Y";
const EXPENSES_GID = "gid=0";
const TASKS_GID = "337884673";
const LOGS_GID = "1642933471";
const CHAT_ID = "5379148910";

const currentPath = `${WORKSPACE}/workflows/current-inbox-phase1-start.json`;
const raw = JSON.parse(fs.readFileSync(currentPath, "utf8"));
const inbox = Array.isArray(raw) ? raw[0] : raw;

function node(name) {
  const found = inbox.nodes.find((candidate) => candidate.name === name);
  if (!found) throw new Error(`Missing node: ${name}`);
  return found;
}

function sheetsCredential() {
  return node("Append Expense").credentials;
}

function telegramCredential() {
  return node("Telegram Inbox").credentials;
}

function openAiCredential() {
  return node("OpenAI Parse Message").credentials;
}

function sheetRef(gid) {
  return { __rl: true, mode: "id", value: gid };
}

node("Telegram Inbox").parameters = {
  updates: ["message"],
  additionalFields: {
    download: true,
    imageSize: "large",
  },
};

node("Normalize Telegram Input").parameters.jsCode = `const item = $input.first();
const update = item.json || {};
const message = update.message || update.edited_message || {};
const chatId = message.chat?.id ? String(message.chat.id) : "";
const text = message.text || message.caption || "";
const createdAt = new Date().toISOString();
const binary = item.binary || {};
const firstBinaryKey = Object.keys(binary)[0];
const media = firstBinaryKey ? binary[firstBinaryKey] : null;
const isVoice = Boolean(message.voice || (media?.mimeType || "").startsWith("audio/"));
const isPhoto = Boolean(message.photo || (media?.mimeType || "").startsWith("image/"));

const schema = {
  type: "object",
  additionalProperties: false,
  properties: {
    intent: { type: "string", enum: ["expense", "receipt", "todo", "reminder", "task_done", "daily_summary", "weekly_summary", "unknown"] },
    date: { type: "string" },
    merchant: { type: "string" },
    amount: { type: "number" },
    currency: { type: "string" },
    category: { type: "string", enum: ["Food", "Transport", "Groceries", "Bills", "Shopping", "Business", "Health", "Entertainment", "Travel", "Trading", "Other"] },
    payment_method: { type: "string" },
    card: { type: "string" },
    notes: { type: "string" },
    task: { type: "string" },
    type: { type: "string", enum: ["todo", "reminder", ""] },
    priority: { type: "string", enum: ["low", "normal", "high", ""] },
    due_at: { type: "string" },
    task_match_text: { type: "string" },
    missing_fields: { type: "array", items: { type: "string" } },
    confidence: { type: "number" }
  },
  required: ["intent", "date", "merchant", "amount", "currency", "category", "payment_method", "card", "notes", "task", "type", "priority", "due_at", "task_match_text", "missing_fields", "confidence"]
};

const systemPrompt = [
  "You are a strict JSON parser for a Telegram personal assistant.",
  "Extract expenses, receipt totals, todos, reminders, task completion commands, and summary requests.",
  "Return only JSON that matches the provided schema. No prose, markdown, comments, or extra keys.",
  "Use Asia/Dubai timezone. Current timestamp: " + createdAt + ".",
  "Default currency is AED.",
  "If the amount, task text, due time, or completion target is missing, include the missing key in missing_fields and keep confidence below 0.7.",
  "For expenses, merchant can be a best guess from context; amount is required. Put specific card/account names in card, for example ADCB Visa, Wio, Mashreq, cash, Apple Pay.",
  "Known debit cards: ADCB Debit, ENBD Debit, DIB Debit, RAK Debit, CBD Debit.",
  "Known credit cards: ADCB Credit, ENBD Credit, DIB Credit, RAK Credit, TABBY Credit.",
  "Recurring payment names: ADCB Credit Card Payment, ENBD Credit Card Payment, DIB Credit Card Payment, RAK Credit Card Payment, TABBY Payment, ETISALAT Payment.",
  "If the user says a bank plus debit or credit, normalize card to the matching known card name. If a new card name is mentioned, preserve it exactly in card so Supabase can auto-add it.",
  "For receipt photos, extract merchant/date/total/currency/category/payment card if visible.",
  "For reminders, due_at must be ISO 8601 if the user gave a due date/time. If not, put due_at empty and include due_at in missing_fields.",
  "For task completion messages like 'done buy printer ink', set intent task_done and task_match_text to the target phrase.",
  "For 'summary today', 'weekly report', or similar, set intent daily_summary or weekly_summary."
].join("\\n");

const content = [{ type: "input_text", text: text || (isPhoto ? "Parse this receipt image." : "Parse this Telegram message.") }];
if (media?.data && isPhoto) {
  content.push({
    type: "input_image",
    image_url: "data:" + (media.mimeType || "image/jpeg") + ";base64," + media.data
  });
}

return [{
  json: {
    chatId,
    createdAt,
    source: isVoice ? "telegram_voice" : (isPhoto ? "telegram_photo" : "telegram_text"),
    originalText: text,
    needsTranscription: isVoice,
    mediaMimeType: media?.mimeType || "",
    openaiBody: {
      model: "gpt-4.1-mini",
      input: [
        { role: "system", content: [{ type: "input_text", text: systemPrompt }] },
        { role: "user", content }
      ],
      text: {
        format: {
          type: "json_schema",
          name: "assistant_parse",
          strict: true,
          schema
        }
      }
    }
  },
  binary
}];`;

node("Parse OpenAI Result").parameters.jsCode = `const response = $input.first().json;
const original = $("Normalize Telegram Input").item.json;
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
  parsed = {
    intent: "unknown",
    notes: "OpenAI returned invalid JSON",
    missing_fields: ["intent"],
    confidence: 0
  };
}

const now = new Date().toISOString();
const intent = parsed.intent || "unknown";
const amount = Number(parsed.amount || 0);
const confidence = Number(parsed.confidence || 0);
const missing = Array.isArray(parsed.missing_fields) ? parsed.missing_fields.filter(Boolean) : [];
if ((intent === "expense" || intent === "receipt") && amount <= 0 && !missing.includes("amount")) missing.push("amount");
if ((intent === "todo" || intent === "reminder") && !String(parsed.task || "").trim() && !missing.includes("task")) missing.push("task");
if (intent === "reminder" && !String(parsed.due_at || "").trim() && !missing.includes("due_at")) missing.push("due_at");
if (intent === "task_done" && !String(parsed.task_match_text || parsed.task || "").trim() && !missing.includes("task_match_text")) missing.push("task_match_text");

const valid = missing.length === 0 && intent !== "unknown";
let confirmation = "";
if (!valid) {
  const human = missing.join(", ") || "details";
  confirmation = "I need a little more info before saving this. Missing: " + human + ".";
} else if (intent === "expense" || intent === "receipt") {
  confirmation = "Saved expense: " + (parsed.merchant || "Unknown merchant") + " " + amount + " " + (parsed.currency || "AED") + " (" + (parsed.category || "Other") + ")" + (parsed.card ? "\\nCard: " + parsed.card : "") + (confidence < 0.7 ? "\\nLow confidence - please check the sheet." : "");
} else if (intent === "todo") {
  confirmation = "Saved todo: " + parsed.task;
} else if (intent === "reminder") {
  confirmation = "Saved reminder: " + parsed.task + "\\nDue: " + parsed.due_at;
} else if (intent === "task_done") {
  confirmation = "I'll mark this done if I find a matching open task: " + (parsed.task_match_text || parsed.task || "");
} else if (intent === "daily_summary" || intent === "weekly_summary") {
  confirmation = "Summary requests are handled by the scheduled summary workflow for now.";
}

return [{
  json: {
    ...parsed,
    intent,
    amount,
    confidence,
    missing_fields: missing,
    valid,
    chatId: original.chatId,
    originalText: original.originalText,
    source: original.source,
    CreatedAt: now,
    confirmation
  }
}];`;

node("Route Intent").parameters = {
  mode: "expression",
  output: "={{ !$json.valid ? 3 : (($json.intent === 'expense' || $json.intent === 'receipt') ? 0 : (($json.intent === 'todo' || $json.intent === 'reminder') ? 1 : ($json.intent === 'task_done' ? 2 : 3))) }}",
};

node("Prepare Expense Row").parameters.jsCode = `return $input.all().map((item) => ({
  json: {
    Date: item.json.date || new Date().toISOString().slice(0, 10),
    Merchant: item.json.merchant || "",
    Amount: Number(item.json.amount || 0),
    Currency: item.json.currency || "AED",
    Category: item.json.category || "Other",
    "Payment Method": item.json.payment_method || "",
    Card: item.json.card || "",
    Notes: item.json.notes || "",
    Source: item.json.source || (item.json.intent === "receipt" ? "receipt" : "telegram_text"),
    Confidence: item.json.confidence || 0,
    "Created At": item.json.CreatedAt || new Date().toISOString()
  }
}));`;

node("Prepare Task Row").parameters.jsCode = `return $input.all().map((item) => {
  const id = "task_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 8);
  return {
    json: {
      "Task ID": id,
      Task: item.json.task || item.json.notes || "",
      Type: item.json.intent === "reminder" ? "reminder" : "todo",
      Status: "open",
      Priority: item.json.priority || "normal",
      "Due At": item.json.due_at || "",
      Notes: item.json.notes || "",
      "Created At": item.json.CreatedAt || new Date().toISOString(),
      "Completed At": ""
    }
  };
});`;

node("Find Task to Complete").parameters.jsCode = `const source = $("Parse OpenAI Result").item.json;
const target = String(source.task_match_text || source.task || "").toLowerCase();
const rows = $input.all();
const openRows = rows.filter((item) => String(item.json.Status || "").toLowerCase() === "open");
function score(task) {
  const words = target.split(/\\s+/).filter(Boolean);
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
  return [{
    json: {
      confirmation: "I could not find a matching open task. Try: done exact task name",
      skipUpdate: true
    }
  }];
}
return [{
  json: {
    row_number: best.json.row_number,
    "Task ID": best.json["Task ID"] || "",
    Task: best.json.Task,
    Type: best.json.Type || "todo",
    Status: "done",
    Priority: best.json.Priority || "normal",
    "Due At": best.json["Due At"] || "",
    Notes: best.json.Notes || "",
    "Created At": best.json["Created At"] || "",
    "Completed At": new Date().toISOString(),
    confirmation: "Marked done: " + best.json.Task
  }
}];`;

for (const name of ["Append Expense", "Append Task", "Read Tasks for Done", "Update Completed Task"]) {
  const target = node(name);
  target.parameters.documentId = { mode: "id", value: SHEET_ID };
  target.parameters.sheetName = sheetRef(name === "Append Expense" ? EXPENSES_GID : TASKS_GID);
  target.credentials = sheetsCredential();
}

for (const name of ["Confirm Expense", "Confirm Task", "Confirm Done", "Confirm Unknown"]) {
  const target = node(name);
  target.parameters.chatId = `=${CHAT_ID}`;
  target.parameters.additionalFields = { appendAttribution: false };
  target.credentials = telegramCredential();
}

const prepareLog = {
  parameters: {
    jsCode: `return $input.all().map((item) => ({
  json: {
    Timestamp: item.json.CreatedAt || new Date().toISOString(),
    Workflow: "Telegram Personal Assistant - Inbox",
    "Chat ID": item.json.chatId || "",
    "Raw Input": item.json.originalText || "",
    Intent: item.json.intent || "unknown",
    "Parsed JSON": JSON.stringify(item.json),
    Status: item.json.valid ? "parsed" : "needs_clarification",
    Message: item.json.confirmation || "",
    "Missing Fields": (item.json.missing_fields || []).join(", "),
    "Execution Source": item.json.source || "telegram"
  }
}));`,
  },
  id: "assistant-prepare-log-row",
  name: "Prepare Log Row",
  type: "n8n-nodes-base.code",
  typeVersion: 2,
  position: [980, 300],
};

const appendLog = {
  parameters: {
    operation: "append",
    documentId: { mode: "id", value: SHEET_ID },
    sheetName: sheetRef(LOGS_GID),
    dataMode: "autoMapInputData",
    options: {
      handlingExtraData: "insertInNewColumn",
      useAppend: true,
    },
  },
  id: "assistant-append-log",
  name: "Append Log",
  type: "n8n-nodes-base.googleSheets",
  typeVersion: 4.7,
  position: [1200, 300],
  credentials: sheetsCredential(),
};

const routeTaskMatch = {
  parameters: {
    mode: "expression",
    output: "={{ $json.skipUpdate ? 1 : 0 }}",
  },
  id: "assistant-route-task-match",
  name: "Route Task Match",
  type: "n8n-nodes-base.switch",
  typeVersion: 3.2,
  position: [1960, 560],
};

inbox.nodes = inbox.nodes.filter((candidate) => !["Prepare Log Row", "Append Log", "Route Task Match"].includes(candidate.name));
inbox.nodes.push(prepareLog, appendLog, routeTaskMatch);

inbox.connections["Parse OpenAI Result"] = {
  main: [[{ node: "Prepare Log Row", type: "main", index: 0 }]],
};
inbox.connections["Prepare Log Row"] = {
  main: [[{ node: "Append Log", type: "main", index: 0 }]],
};
inbox.connections["Append Log"] = {
  main: [[{ node: "Route Intent", type: "main", index: 0 }]],
};
inbox.connections["Find Task to Complete"] = {
  main: [[{ node: "Route Task Match", type: "main", index: 0 }]],
};
inbox.connections["Route Task Match"] = {
  main: [
    [{ node: "Update Completed Task", type: "main", index: 0 }],
    [{ node: "Confirm Done", type: "main", index: 0 }],
  ],
};

inbox.settings = { ...(inbox.settings || {}), timezone: "Asia/Dubai" };
inbox.meta = { ...(inbox.meta || {}), templateCredsSetupCompleted: true };

fs.writeFileSync(`${WORKSPACE}/workflows/telegram-assistant-inbox-phase1.json`, JSON.stringify(inbox, null, 2));

const dailySummary = {
  id: "telegram-personal-assistant-daily-summary",
  name: "Telegram Personal Assistant - Daily Summary",
  nodes: [
    {
      parameters: {
        rule: {
          interval: [
            {
              field: "days",
              daysInterval: 1,
              triggerAtHour: 21,
              triggerAtMinute: 0,
            },
          ],
        },
      },
      id: "daily-summary-trigger",
      name: "Every Day 9 PM",
      type: "n8n-nodes-base.scheduleTrigger",
      typeVersion: 1.2,
      position: [240, 300],
    },
    {
      parameters: {
        documentId: { mode: "id", value: SHEET_ID },
        sheetName: sheetRef(EXPENSES_GID),
        combineFilters: "AND",
        options: {},
      },
      id: "daily-read-expenses",
      name: "Read Expenses",
      type: "n8n-nodes-base.googleSheets",
      typeVersion: 4.7,
      position: [480, 220],
      credentials: sheetsCredential(),
    },
    {
      parameters: {
        documentId: { mode: "id", value: SHEET_ID },
        sheetName: sheetRef(TASKS_GID),
        combineFilters: "AND",
        options: {},
      },
      id: "daily-read-tasks",
      name: "Read Tasks",
      type: "n8n-nodes-base.googleSheets",
      typeVersion: 4.7,
      position: [480, 380],
      credentials: sheetsCredential(),
    },
    {
      parameters: {
        mode: "append",
        numberInputs: 2,
      },
      id: "daily-merge",
      name: "Merge Expenses and Tasks",
      type: "n8n-nodes-base.merge",
      typeVersion: 3.2,
      position: [720, 300],
    },
    {
      parameters: {
        jsCode: `const rows = $input.all().map((item) => item.json);
const now = new Date();
const today = now.toISOString().slice(0, 10);
const expenses = rows.filter((row) => row.Amount !== undefined && String(row.Date || "").slice(0, 10) === today);
const tasks = rows.filter((row) => row.Task !== undefined);
const openTasks = tasks.filter((row) => String(row.Status || "").toLowerCase() === "open");
const doneToday = tasks.filter((row) => String(row.Status || "").toLowerCase() === "done" && String(row["Completed At"] || "").slice(0, 10) === today);
const total = expenses.reduce((sum, row) => sum + Number(row.Amount || 0), 0);
const byCategory = {};
for (const expense of expenses) {
  const category = expense.Category || "Other";
  byCategory[category] = (byCategory[category] || 0) + Number(expense.Amount || 0);
}
const categories = Object.entries(byCategory)
  .sort((a, b) => b[1] - a[1])
  .map(([category, value]) => category + ": " + value.toFixed(2) + " AED")
  .join("\\n");
const topTasks = openTasks.slice(0, 5).map((row, index) => (index + 1) + ". " + row.Task + (row["Due At"] ? " - " + row["Due At"] : "")).join("\\n");
const text = [
  "Daily summary - " + today,
  "",
  "Expenses: " + expenses.length + " entries, " + total.toFixed(2) + " AED",
  categories || "No expenses logged today.",
  "",
  "Tasks completed today: " + doneToday.length,
  "Open tasks: " + openTasks.length,
  topTasks || "No open tasks."
].join("\\n");
return [{ json: { summaryText: text } }];`,
      },
      id: "daily-build-summary",
      name: "Build Daily Summary",
      type: "n8n-nodes-base.code",
      typeVersion: 2,
      position: [960, 300],
    },
    {
      parameters: {
        resource: "message",
        operation: "sendMessage",
        chatId: `=${CHAT_ID}`,
        text: "={{ $json.summaryText }}",
        additionalFields: {
          appendAttribution: false,
        },
      },
      id: "daily-send-summary",
      name: "Send Daily Summary",
      type: "n8n-nodes-base.telegram",
      typeVersion: 1.2,
      position: [1200, 300],
      credentials: telegramCredential(),
    },
  ],
  connections: {
    "Every Day 9 PM": {
      main: [
        [
          { node: "Read Expenses", type: "main", index: 0 },
          { node: "Read Tasks", type: "main", index: 0 },
        ],
      ],
    },
    "Read Expenses": {
      main: [[{ node: "Merge Expenses and Tasks", type: "main", index: 0 }]],
    },
    "Read Tasks": {
      main: [[{ node: "Merge Expenses and Tasks", type: "main", index: 1 }]],
    },
    "Merge Expenses and Tasks": {
      main: [[{ node: "Build Daily Summary", type: "main", index: 0 }]],
    },
    "Build Daily Summary": {
      main: [[{ node: "Send Daily Summary", type: "main", index: 0 }]],
    },
  },
  settings: {
    timezone: "Asia/Dubai",
  },
  active: false,
  meta: {
    templateCredsSetupCompleted: true,
  },
  tags: [],
};

fs.writeFileSync(`${WORKSPACE}/workflows/telegram-daily-summary.json`, JSON.stringify(dailySummary, null, 2));
