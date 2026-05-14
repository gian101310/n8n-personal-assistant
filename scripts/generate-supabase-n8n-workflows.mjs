import fs from "node:fs";

const workspace = process.cwd();
const SUPABASE_URL = "https://uxdueryjbfzfvyznxgax.supabase.co";

function readWorkflow(path) {
  const data = JSON.parse(fs.readFileSync(path, "utf8"));
  return Array.isArray(data) ? data[0] : data;
}

function writeWorkflow(path, workflow) {
  fs.writeFileSync(path, JSON.stringify(workflow, null, 2));
}

function supabaseHeaders() {
  return {
    parameters: [
      { name: "apikey", value: "={{ $env.SUPABASE_SERVICE_ROLE_KEY }}" },
      { name: "Authorization", value: "={{ 'Bearer ' + $env.SUPABASE_SERVICE_ROLE_KEY }}" },
      { name: "Content-Type", value: "application/json" },
      { name: "Prefer", value: "return=representation" },
    ],
  };
}

function supabaseGetHeaders() {
  return {
    parameters: [
      { name: "apikey", value: "={{ $env.SUPABASE_SERVICE_ROLE_KEY }}" },
      { name: "Authorization", value: "={{ 'Bearer ' + $env.SUPABASE_SERVICE_ROLE_KEY }}" },
    ],
  };
}

function httpNode(id, name, method, url, position, bodyExpression = null) {
  const parameters = {
    method,
    url,
    sendHeaders: true,
    headerParameters: method === "GET" ? supabaseGetHeaders() : supabaseHeaders(),
    options: {},
  };
  if (bodyExpression) {
    parameters.sendBody = true;
    parameters.contentType = "json";
    parameters.specifyBody = "json";
    parameters.jsonBody = bodyExpression;
  }
  return {
    parameters,
    id,
    name,
    type: "n8n-nodes-base.httpRequest",
    typeVersion: 4.4,
    position,
  };
}

const inbox = readWorkflow(`${workspace}/workflows/current-inbox-before-supabase.json`);
inbox.id = "telegram-personal-assistant-inbox-supabase";
inbox.name = "Telegram Personal Assistant - Inbox Supabase";
inbox.active = false;

function replaceNode(name, nextNode) {
  const index = inbox.nodes.findIndex((node) => node.name === name);
  if (index === -1) throw new Error(`Missing node ${name}`);
  inbox.nodes[index] = nextNode;
}

inbox.nodes.find((node) => node.name === "Prepare Expense Row").parameters.jsCode = `return $input.all().map((item) => ({
  json: {
    expense_date: item.json.date || new Date().toISOString().slice(0, 10),
    merchant: item.json.merchant || null,
    amount: Number(item.json.amount || 0),
    currency: item.json.currency || "AED",
    category: item.json.category || "Other",
    payment_method: item.json.payment_method || null,
    card: item.json.card || null,
    notes: item.json.notes || null,
    source: item.json.source || (item.json.intent === "receipt" ? "receipt" : "telegram_text"),
    confidence: item.json.confidence || 0,
    raw_payload: item.json
  }
}));`;

inbox.nodes.find((node) => node.name === "Prepare Task Row").parameters.jsCode = `return $input.all().map((item) => ({
  json: {
    task: item.json.task || item.json.notes || "",
    type: item.json.intent === "reminder" ? "reminder" : "todo",
    status: "open",
    priority: item.json.priority || "normal",
    due_at: item.json.due_at || null,
    notes: item.json.notes || null,
    raw_payload: item.json
  }
}));`;

inbox.nodes.find((node) => node.name === "Prepare Log Row").parameters.jsCode = `return $input.all().map((item) => ({
  json: {
    workflow: "Telegram Personal Assistant - Inbox Supabase",
    chat_id: item.json.chatId || "",
    raw_input: item.json.originalText || "",
    intent: item.json.intent || "unknown",
    parsed_json: item.json,
    status: item.json.valid ? "parsed" : "needs_clarification",
    message: item.json.confirmation || "",
    missing_fields: item.json.missing_fields || [],
    execution_source: item.json.source || "telegram"
  }
}));`;

inbox.nodes.find((node) => node.name === "Find Task to Complete").parameters.jsCode = `const source = $("Parse OpenAI Result").item.json;
const target = String(source.task_match_text || source.task || "").toLowerCase();
const rows = $input.all();
const openRows = rows.filter((item) => String(item.json.status || "").toLowerCase() === "open");
function score(task) {
  const words = target.split(/\\s+/).filter(Boolean);
  const value = String(task || "").toLowerCase();
  return words.filter((word) => value.includes(word)).length;
}
let best = null;
let bestScore = 0;
for (const item of openRows) {
  const current = score(item.json.task);
  if (current > bestScore) {
    best = item;
    bestScore = current;
  }
}
if (!best || bestScore === 0) {
  return [{ json: { confirmation: "I could not find a matching open task. Try: done exact task name", skipUpdate: true } }];
}
return [{
  json: {
    id: best.json.id,
    task: best.json.task,
    status: "done",
    completed_at: new Date().toISOString(),
    confirmation: "Marked done: " + best.json.task
  }
}];`;

replaceNode("Append Expense", httpNode(
  "assistant-supabase-append-expense",
  "Append Expense",
  "POST",
  `${SUPABASE_URL}/rest/v1/assistant_expenses`,
  [1540, 120],
  "={{ JSON.stringify($json) }}"
));

replaceNode("Append Task", httpNode(
  "assistant-supabase-append-task",
  "Append Task",
  "POST",
  `${SUPABASE_URL}/rest/v1/assistant_tasks`,
  [1540, 360],
  "={{ JSON.stringify($json) }}"
));

replaceNode("Append Log", httpNode(
  "assistant-supabase-append-log",
  "Append Log",
  "POST",
  `${SUPABASE_URL}/rest/v1/assistant_logs`,
  [1200, 300],
  "={{ JSON.stringify($json) }}"
));

replaceNode("Read Tasks for Done", httpNode(
  "assistant-supabase-read-tasks",
  "Read Tasks for Done",
  "GET",
  `${SUPABASE_URL}/rest/v1/assistant_tasks?status=eq.open&select=*`,
  [1540, 560]
));

replaceNode("Update Completed Task", httpNode(
  "assistant-supabase-update-task",
  "Update Completed Task",
  "PATCH",
  `=${SUPABASE_URL}/rest/v1/assistant_tasks?id=eq.{{ $json.id }}`,
  [2200, 520],
  `={{ JSON.stringify({ status: "done", completed_at: $json.completed_at }) }}`
));

inbox.settings = { ...(inbox.settings || {}), timezone: "Asia/Dubai" };
inbox.meta = { ...(inbox.meta || {}), templateCredsSetupCompleted: true };
writeWorkflow(`${workspace}/workflows/telegram-assistant-inbox-supabase.json`, inbox);

inbox.connections["Parse OpenAI Result"] = {
  main: [[
    { node: "Prepare Log Row", type: "main", index: 0 },
    { node: "Route Intent", type: "main", index: 0 },
  ]],
};
inbox.connections["Append Log"] = { main: [[]] };
writeWorkflow(`${workspace}/workflows/telegram-assistant-inbox-supabase.json`, inbox);

const daily = {
  id: "telegram-personal-assistant-daily-summary-supabase",
  name: "Telegram Personal Assistant - Daily Summary Supabase",
  active: false,
  nodes: [
    {
      parameters: { rule: { interval: [{ field: "days", daysInterval: 1, triggerAtHour: 21, triggerAtMinute: 0 }] } },
      id: "daily-summary-trigger",
      name: "Every Day 9 PM",
      type: "n8n-nodes-base.scheduleTrigger",
      typeVersion: 1.2,
      position: [240, 300],
    },
    httpNode("daily-dashboard-metrics", "Read Dashboard Metrics", "GET", `${SUPABASE_URL}/rest/v1/assistant_dashboard_metrics?select=*`, [520, 300]),
    httpNode("daily-open-tasks", "Read Open Tasks", "GET", `${SUPABASE_URL}/rest/v1/assistant_tasks?status=eq.open&select=task,due_at,priority&order=due_at.asc.nullslast&limit=8`, [760, 300]),
    {
      parameters: {
        mode: "runOnceForAllItems",
        language: "javaScript",
        jsCode: `const items = $input.all().map((item) => item.json);
const metrics = items.find((item) => item.today_expense_total !== undefined) || {};
const tasks = items.filter((item) => item.task);
const taskLines = tasks.map((task, index) => (index + 1) + ". " + task.task + (task.due_at ? " - " + task.due_at : "")).join("\\n");
const today = new Date().toISOString().slice(0, 10);
const text = [
  "Daily summary - " + today,
  "",
  "Expenses today: " + Number(metrics.today_expense_total || 0).toFixed(2) + " AED (" + (metrics.today_expense_count || 0) + " entries)",
  "Open tasks: " + (metrics.open_task_count || 0),
  "Completed today: " + (metrics.completed_today_count || 0),
  "Due reminders: " + (metrics.due_reminder_count || 0),
  "",
  taskLines || "No open tasks."
].join("\\n");
return [{ json: { summaryText: text } }];`,
      },
      id: "daily-build-summary",
      name: "Build Daily Summary",
      type: "n8n-nodes-base.code",
      typeVersion: 2,
      position: [1000, 300],
    },
    inbox.nodes.find((node) => node.name === "Confirm Task") && {
      ...inbox.nodes.find((node) => node.name === "Confirm Task"),
      id: "daily-send-summary",
      name: "Send Daily Summary",
      position: [1240, 300],
      parameters: {
        resource: "message",
        operation: "sendMessage",
        chatId: "=5379148910",
        text: "={{ $json.summaryText }}",
        additionalFields: { appendAttribution: false },
      },
    },
  ].filter(Boolean),
  connections: {
    "Every Day 9 PM": { main: [[{ node: "Read Dashboard Metrics", type: "main", index: 0 }, { node: "Read Open Tasks", type: "main", index: 0 }]] },
    "Read Dashboard Metrics": { main: [[{ node: "Build Daily Summary", type: "main", index: 0 }]] },
    "Read Open Tasks": { main: [[{ node: "Build Daily Summary", type: "main", index: 0 }]] },
    "Build Daily Summary": { main: [[{ node: "Send Daily Summary", type: "main", index: 0 }]] },
  },
  settings: { timezone: "Asia/Dubai" },
  meta: { templateCredsSetupCompleted: true },
  tags: [],
};
writeWorkflow(`${workspace}/workflows/telegram-daily-summary-supabase.json`, daily);

const reminders = {
  id: "telegram-personal-assistant-reminders-supabase",
  name: "Telegram Personal Assistant - Reminder Sender Supabase",
  active: false,
  nodes: [
    {
      parameters: { rule: { interval: [{ field: "minutes", minutesInterval: 5 }] } },
      id: "reminder-trigger",
      name: "Every 5 Minutes",
      type: "n8n-nodes-base.scheduleTrigger",
      typeVersion: 1.2,
      position: [240, 300],
    },
    httpNode("read-due-reminders", "Read Due Reminders", "GET", `={{ '${SUPABASE_URL}/rest/v1/assistant_tasks?type=eq.reminder&status=eq.open&due_at=lte.' + encodeURIComponent($now.toISO()) + '&select=*' }}`, [500, 300]),
    {
      parameters: {
        jsCode: `return $input.all().map((item) => ({
  json: {
    ...item.json,
    reminderText: "Reminder: " + item.json.task + (item.json.due_at ? "\\nDue: " + item.json.due_at : "")
  }
}));`,
      },
      id: "prepare-reminder",
      name: "Prepare Reminder Message",
      type: "n8n-nodes-base.code",
      typeVersion: 2,
      position: [740, 300],
    },
    {
      ...inbox.nodes.find((node) => node.name === "Confirm Task"),
      id: "send-reminder",
      name: "Send Reminder",
      position: [980, 300],
      parameters: {
        resource: "message",
        operation: "sendMessage",
        chatId: "=5379148910",
        text: "={{ $json.reminderText }}",
        additionalFields: { appendAttribution: false },
      },
    },
    httpNode("mark-reminder-sent", "Mark Reminder Sent", "PATCH", `=${SUPABASE_URL}/rest/v1/assistant_tasks?id=eq.{{ $json.id }}`, [1220, 300], `={{ JSON.stringify({ status: "sent" }) }}`),
  ],
  connections: {
    "Every 5 Minutes": { main: [[{ node: "Read Due Reminders", type: "main", index: 0 }]] },
    "Read Due Reminders": { main: [[{ node: "Prepare Reminder Message", type: "main", index: 0 }]] },
    "Prepare Reminder Message": { main: [[{ node: "Send Reminder", type: "main", index: 0 }]] },
    "Send Reminder": { main: [[{ node: "Mark Reminder Sent", type: "main", index: 0 }]] },
  },
  settings: { timezone: "Asia/Dubai" },
  meta: { templateCredsSetupCompleted: true },
  tags: [],
};
writeWorkflow(`${workspace}/workflows/telegram-reminder-sender-supabase.json`, reminders);

const weekly = readWorkflow(`${workspace}/workflows/current-weekly-summary-published.json`);
weekly.id = "telegram-personal-assistant-weekly-summary-supabase";
weekly.name = "Telegram Personal Assistant - Weekly Summary Supabase";
weekly.active = false;
for (const node of weekly.nodes) {
  if (node.name === "Read Expenses") {
    Object.assign(node, httpNode("weekly-read-expenses", "Read Expenses", "GET", `={{ '${SUPABASE_URL}/rest/v1/assistant_expenses?select=*&expense_date=gte.' + $now.minus({ days: 7 }).toISODate() }}`, node.position));
  }
  if (node.name === "Read Tasks") {
    Object.assign(node, httpNode("weekly-read-tasks", "Read Tasks", "GET", `${SUPABASE_URL}/rest/v1/assistant_tasks?select=*`, node.position));
  }
  if (node.name === "Send Weekly Summary") {
    node.parameters.chatId = "=5379148910";
    node.parameters.additionalFields = { appendAttribution: false };
  }
}
const buildWeekly = weekly.nodes.find((node) => node.name === "Build Weekly Summary");
buildWeekly.parameters.jsCode = `const items = $input.all().map((item) => item.json);
const oneWeekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
const expenses = items.filter((row) => row.amount !== undefined && row.expense_date);
const tasks = items.filter((row) => row.task !== undefined);
const recent = expenses.filter((row) => {
  const t = new Date(row.expense_date).getTime();
  return Number.isNaN(t) || t >= oneWeekAgo;
});
const byCategory = {};
let total = 0;
let highest = null;
for (const expense of recent) {
  const amount = Number(expense.amount || 0);
  total += amount;
  const category = expense.category || "Other";
  byCategory[category] = (byCategory[category] || 0) + amount;
  if (!highest || amount > Number(highest.amount || 0)) highest = expense;
}
const openTasks = tasks.filter((task) => String(task.status || "").toLowerCase() === "open");
const doneTasks = tasks.filter((task) => {
  const completed = new Date(task.completed_at || "").getTime();
  return String(task.status || "").toLowerCase() === "done" && !Number.isNaN(completed) && completed >= oneWeekAgo;
});
const categories = Object.entries(byCategory)
  .sort((a, b) => b[1] - a[1])
  .map(([category, amount]) => category + ": " + amount.toFixed(2) + " AED")
  .join("\\n");
const openTaskLines = openTasks.slice(0, 8).map((task) => "- " + task.task + (task.due_at ? " (" + task.due_at + ")" : "")).join("\\n");
const baseSummary = [
  "Weekly summary",
  "",
  "Total spend: " + total.toFixed(2) + " AED",
  categories || "No expenses logged this week.",
  highest ? "\\nHighest: " + (highest.merchant || "Unknown") + " - " + Number(highest.amount || 0).toFixed(2) + " AED" : "",
  "",
  "Tasks completed: " + doneTasks.length,
  "Open tasks: " + openTasks.length,
  openTaskLines || "No open tasks."
].filter(Boolean).join("\\n");
return [{
  json: {
    summaryText: baseSummary,
    openaiBody: {
      model: "gpt-4.1-mini",
      input: [
        {
          role: "system",
          content: [{ type: "input_text", text: "You are a concise weekly review assistant. Give 3 practical recommendations based on the user's expense and task summary. No markdown table." }]
        },
        {
          role: "user",
          content: [{ type: "input_text", text: baseSummary }]
        }
      ]
    }
  }
}];`;
writeWorkflow(`${workspace}/workflows/telegram-weekly-summary-supabase.json`, weekly);
