import fs from "node:fs";

const WORKSPACE = process.cwd();
const SHEET_ID = "162DpKJTcJROOaCVN7r5gUdOv3q1X17VvYvgMt-Du20Y";
const EXPENSES_GID = "gid=0";
const TASKS_GID = "337884673";
const CHAT_ID = "5379148910";

const inbox = JSON.parse(fs.readFileSync(`${WORKSPACE}/workflows/telegram-assistant-inbox-phase1.json`, "utf8"));
const googleCred = inbox.nodes.find((node) => node.name === "Append Expense").credentials;
const telegramCred = inbox.nodes.find((node) => node.name === "Telegram Inbox").credentials;
const openAiCred = inbox.nodes.find((node) => node.name === "OpenAI Parse Message").credentials;

function sheetRef(gid) {
  return { __rl: true, mode: "id", value: gid };
}

function patchGoogle(node, gid) {
  node.parameters.documentId = { mode: "id", value: SHEET_ID };
  node.parameters.sheetName = sheetRef(gid);
  delete node.parameters.authentication;
  delete node.parameters.resource;
  node.credentials = googleCred;
}

function patchTelegram(node) {
  node.parameters.chatId = `=${CHAT_ID}`;
  node.parameters.additionalFields = { appendAttribution: false };
  node.credentials = telegramCred;
}

const reminders = JSON.parse(fs.readFileSync(`${WORKSPACE}/workflows/telegram-reminder-sender.json`, "utf8"));
for (const node of reminders.nodes) {
  if (node.name === "Read Tasks" || node.name === "Mark Reminder Sent") patchGoogle(node, TASKS_GID);
  if (node.name === "Send Reminder") patchTelegram(node);
}
reminders.settings = { ...(reminders.settings || {}), timezone: "Asia/Dubai" };
reminders.meta = { ...(reminders.meta || {}), templateCredsSetupCompleted: true };
fs.writeFileSync(`${WORKSPACE}/workflows/telegram-reminder-sender-active.json`, JSON.stringify(reminders, null, 2));

const weekly = JSON.parse(fs.readFileSync(`${WORKSPACE}/workflows/telegram-weekly-summary.json`, "utf8"));
for (const node of weekly.nodes) {
  if (node.name === "Read Expenses") patchGoogle(node, EXPENSES_GID);
  if (node.name === "Read Tasks") patchGoogle(node, TASKS_GID);
  if (node.name === "Send Weekly Summary") patchTelegram(node);
}

const buildNode = weekly.nodes.find((node) => node.name === "Build Weekly Summary");
buildNode.parameters.jsCode = `const items = $input.all().map((item) => item.json);
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
const openTasks = tasks.filter((task) => String(task.Status || "").toLowerCase() === "open");
const doneTasks = tasks.filter((task) => {
  const completed = new Date(task["Completed At"] || "").getTime();
  return String(task.Status || "").toLowerCase() === "done" && !Number.isNaN(completed) && completed >= oneWeekAgo;
});
const categories = Object.entries(byCategory)
  .sort((a, b) => b[1] - a[1])
  .map(([category, amount]) => category + ": " + amount.toFixed(2) + " AED")
  .join("\\n");
const openTaskLines = openTasks.slice(0, 8).map((task) => "- " + task.Task + (task["Due At"] ? " (" + task["Due At"] + ")" : "")).join("\\n");
const baseSummary = [
  "Weekly summary",
  "",
  "Total spend: " + total.toFixed(2) + " AED",
  categories || "No expenses logged this week.",
  highest ? "\\nHighest: " + (highest.Merchant || "Unknown") + " - " + Number(highest.Amount || 0).toFixed(2) + " AED" : "",
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

const aiNode = {
  parameters: {
    method: "POST",
    url: "https://api.openai.com/v1/responses",
    authentication: "predefinedCredentialType",
    nodeCredentialType: "openAiApi",
    sendBody: true,
    specifyBody: "json",
    jsonBody: "={{ JSON.stringify($json.openaiBody) }}",
    options: {},
  },
  id: "weekly-openai-review",
  name: "OpenAI Weekly Review",
  type: "n8n-nodes-base.httpRequest",
  typeVersion: 4.4,
  position: [1200, 300],
  credentials: openAiCred,
};

const parseAiNode = {
  parameters: {
    jsCode: `const response = $input.first().json;
const summary = $("Build Weekly Summary").item.json.summaryText;
let review = response.output_text;
if (!review && Array.isArray(response.output)) {
  for (const output of response.output) {
    for (const content of output.content || []) {
      if (content.type === "output_text" && content.text) review = content.text;
    }
  }
}
return [{ json: { summaryText: summary + "\\n\\nAI weekly review:\\n" + (review || "No AI review returned.") } }];`,
  },
  id: "weekly-parse-ai-review",
  name: "Parse Weekly AI Review",
  type: "n8n-nodes-base.code",
  typeVersion: 2,
  position: [1440, 300],
};

weekly.nodes = weekly.nodes.filter((node) => !["OpenAI Weekly Review", "Parse Weekly AI Review"].includes(node.name));
weekly.nodes.push(aiNode, parseAiNode);
weekly.connections["Build Weekly Summary"] = {
  main: [[{ node: "OpenAI Weekly Review", type: "main", index: 0 }]],
};
weekly.connections["OpenAI Weekly Review"] = {
  main: [[{ node: "Parse Weekly AI Review", type: "main", index: 0 }]],
};
weekly.connections["Parse Weekly AI Review"] = {
  main: [[{ node: "Send Weekly Summary", type: "main", index: 0 }]],
};
weekly.settings = { ...(weekly.settings || {}), timezone: "Asia/Dubai" };
weekly.meta = { ...(weekly.meta || {}), templateCredsSetupCompleted: true };
fs.writeFileSync(`${WORKSPACE}/workflows/telegram-weekly-summary-ai.json`, JSON.stringify(weekly, null, 2));

