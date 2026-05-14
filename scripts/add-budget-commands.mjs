import fs from "node:fs";
import path from "node:path";

const workspace = process.cwd();
const sourcePath = path.join(workspace, "workflows/current-inbox-after-memory-commands.json");
const workflow = readWorkflow(sourcePath);
const SUPABASE_URL = "https://uxdueryjbfzfvyznxgax.supabase.co";

function readWorkflow(filePath) {
  const data = JSON.parse(fs.readFileSync(filePath, "utf8"));
  return Array.isArray(data) ? data[0] : data;
}

function writeWorkflow(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify([data], null, 2));
}

function node(name) {
  const found = workflow.nodes.find((item) => item.name === name);
  if (!found) throw new Error(`Missing node: ${name}`);
  return found;
}

function upsertNode(nextNode) {
  const index = workflow.nodes.findIndex((item) => item.name === nextNode.name);
  if (index === -1) workflow.nodes.push(nextNode);
  else workflow.nodes[index] = nextNode;
}

function connect(from, targets) {
  workflow.connections[from] = {
    main: [targets.map((target) => ({ node: target, type: "main", index: 0 }))],
  };
}

function supabaseHeaders(prefer = "return=representation") {
  return {
    parameters: [
      { name: "apikey", value: "={{ $env.SUPABASE_SERVICE_ROLE_KEY }}" },
      { name: "Authorization", value: "={{ 'Bearer ' + $env.SUPABASE_SERVICE_ROLE_KEY }}" },
      { name: "Content-Type", value: "application/json" },
      { name: "Prefer", value: prefer },
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

function httpNode(id, name, method, url, position, bodyExpression = null, extra = {}) {
  const parameters = {
    method,
    url,
    sendHeaders: true,
    headerParameters: method === "GET" ? supabaseGetHeaders() : supabaseHeaders(extra.prefer),
    options: {},
  };
  if (bodyExpression) {
    parameters.sendBody = true;
    parameters.contentType = "json";
    parameters.specifyBody = "json";
    parameters.jsonBody = bodyExpression;
  }
  delete extra.prefer;
  return {
    parameters,
    id,
    name,
    type: "n8n-nodes-base.httpRequest",
    typeVersion: 4.4,
    position,
    ...extra,
  };
}

function codeNode(id, name, position, jsCode) {
  return {
    parameters: { jsCode },
    id,
    name,
    type: "n8n-nodes-base.code",
    typeVersion: 2,
    position,
  };
}

function telegramNode(id, name, position, textExpression) {
  const base = node("Confirm Unknown");
  return {
    ...base,
    id,
    name,
    position,
    parameters: {
      resource: "message",
      operation: "sendMessage",
      chatId: "={{ $('Normalize Telegram Input').item.json.chatId || '5379148910' }}",
      text: textExpression,
      additionalFields: { appendAttribution: false },
    },
  };
}

const normalize = node("Normalize Telegram Input");
normalize.parameters.jsCode = normalize.parameters.jsCode.replace(
  "const memoryCommand = parseMemoryCommand(text);",
  String.raw`function cleanBudgetCategory(value) {
  return String(value || "").trim().replace(/^[:\-\s]+/, "").replace(/[?.!\s]+$/, "").trim();
}
function parseBudgetAmount(value) {
  const amount = Number(String(value || "").replace(/,/g, ""));
  return Number.isFinite(amount) && amount > 0 ? amount : 0;
}
function parseBudgetCommand(value) {
  const textValue = String(value || "").trim();
  if (/^(?:list|show|view)\s+(?:my\s+)?budgets\??$/i.test(textValue) || /^what(?:'s| is)?\s+my\s+budgets?\??$/i.test(textValue)) {
    return { command: "list" };
  }
  const deleteMatch = textValue.match(/^(?:delete|remove|clear)\s+(.+?)\s+budget$/i) || textValue.match(/^budget\s+delete\s+(.+)$/i);
  if (deleteMatch) {
    const category = cleanBudgetCategory(deleteMatch[1]);
    return category ? { command: "delete", category } : { command: "" };
  }
  const setMatch =
    textValue.match(/^(?:set|make)\s+(.+?)\s+budget\s+(?:to\s+)?(?:aed\s*)?([\d,]+(?:\.\d{1,2})?)$/i) ||
    textValue.match(/^budget\s+(.+?)\s+(?:to\s+)?(?:aed\s*)?([\d,]+(?:\.\d{1,2})?)$/i) ||
    textValue.match(/^(.+?)\s+budget\s+(?:is\s+|=|to\s+)?(?:aed\s*)?([\d,]+(?:\.\d{1,2})?)$/i);
  if (setMatch) {
    const category = cleanBudgetCategory(setMatch[1]);
    const amount = parseBudgetAmount(setMatch[2]);
    return category && amount ? { command: "set", category, amount } : { command: "" };
  }
  return { command: "" };
}
const memoryCommand = parseMemoryCommand(text);
const budgetCommand = parseBudgetCommand(text);`,
);
normalize.parameters.jsCode = normalize.parameters.jsCode.replace(
  ': (/^(undo|undo last|delete last|remove last)( expense)?$/.test(lowerText) ? "undo_expense" : (memoryCommand.command ? "memory_" + memoryCommand.command : "")));',
  ': (/^(undo|undo last|delete last|remove last)( expense)?$/.test(lowerText) ? "undo_expense" : (memoryCommand.command ? "memory_" + memoryCommand.command : (budgetCommand.command ? "budget_" + budgetCommand.command : ""))));',
);
normalize.parameters.jsCode = normalize.parameters.jsCode.replace(
  "pendingCommand,\n    memoryCommand,\n    isCallback,",
  "pendingCommand,\n    memoryCommand,\n    budgetCommand,\n    isCallback,",
);

node("Route Pending Command").parameters.output =
  "={{ $json.pendingCommand === 'confirm' ? 0 : ($json.pendingCommand === 'cancel' ? 1 : ($json.pendingCommand === 'undo_expense' ? 2 : ($json.pendingCommand === 'memory_remember' ? 3 : ($json.pendingCommand === 'memory_forget' ? 4 : ($json.pendingCommand === 'memory_recall' ? 5 : ($json.pendingCommand === 'budget_set' ? 6 : ($json.pendingCommand === 'budget_delete' ? 7 : ($json.pendingCommand === 'budget_list' ? 8 : 9)))))))) }}";

upsertNode(codeNode(
  "assistant-prepare-budget-upsert",
  "Prepare Budget Upsert",
  [700, -680],
  String.raw`const source = $("Normalize Telegram Input").item.json;
const command = source.budgetCommand || {};
const category = String(command.category || "").trim();
const amount = Number(command.amount || 0);
return [{
  json: {
    category,
    amount,
    currency: "AED",
    period: "monthly",
    active: true,
    confirmation: "Budget set: " + category + " at AED " + amount.toLocaleString("en-US") + " monthly."
  }
}];`,
));

upsertNode(httpNode(
  "assistant-upsert-budget",
  "Upsert Budget",
  "POST",
  `${SUPABASE_URL}/rest/v1/assistant_budgets?on_conflict=category,period`,
  [940, -680],
  "={{ JSON.stringify({ category: $json.category, amount: $json.amount, currency: $json.currency, period: $json.period, active: $json.active }) }}",
  { prefer: "resolution=merge-duplicates,return=representation" },
));

upsertNode(telegramNode(
  "assistant-confirm-budget",
  "Confirm Budget Command",
  [1180, -600],
  "={{ $json.confirmation || 'Budget command completed.' }}",
));

upsertNode(codeNode(
  "assistant-prepare-budget-delete",
  "Prepare Budget Delete",
  [700, -820],
  String.raw`const source = $("Normalize Telegram Input").item.json;
const command = source.budgetCommand || {};
return [{
  json: {
    category: String(command.category || "").trim(),
    confirmation: "Deleted budget: " + String(command.category || "").trim()
  }
}];`,
));

upsertNode(httpNode(
  "assistant-delete-budget",
  "Delete Budget",
  "DELETE",
  `={{ '${SUPABASE_URL}/rest/v1/assistant_budgets?category=eq.' + encodeURIComponent($json.category) + '&period=eq.monthly' }}`,
  [940, -820],
  null,
  { prefer: "return=minimal" },
));

upsertNode(httpNode(
  "assistant-read-budgets",
  "Read Budgets",
  "GET",
  `${SUPABASE_URL}/rest/v1/assistant_budgets?select=category,amount,currency,period,active&active=eq.true&period=eq.monthly&order=category.asc`,
  [700, -980],
  null,
  { alwaysOutputData: true },
));

upsertNode(codeNode(
  "assistant-format-budget-list",
  "Format Budget List",
  [940, -980],
  String.raw`const rows = $input.all().map((item) => item.json).filter((row) => row.category);
if (!rows.length) {
  return [{ json: { confirmation: "No monthly budgets yet. Send: set Food budget 1200." } }];
}
const lines = rows.map((row, index) => {
  const amount = Number(row.amount || 0).toLocaleString("en-US");
  return (index + 1) + ". " + row.category + ": " + (row.currency || "AED") + " " + amount;
});
return [{ json: { confirmation: "Monthly budgets:\n" + lines.join("\n") } }];`,
));

connect("Prepare Budget Upsert", ["Upsert Budget"]);
connect("Upsert Budget", ["Confirm Budget Command"]);
connect("Prepare Budget Delete", ["Delete Budget"]);
connect("Delete Budget", ["Confirm Budget Command"]);
connect("Read Budgets", ["Format Budget List"]);
connect("Format Budget List", ["Confirm Budget Command"]);

workflow.connections["Route Pending Command"].main = [
  [{ node: "Read Pending for Confirm", type: "main", index: 0 }],
  [{ node: "Read Pending for Cancel", type: "main", index: 0 }],
  [{ node: "Read Last Expense for Undo", type: "main", index: 0 }],
  [{ node: "Prepare Memory Embedding", type: "main", index: 0 }],
  [{ node: "Read Memories for Forget", type: "main", index: 0 }],
  [{ node: "Read Memories for Recall", type: "main", index: 0 }],
  [{ node: "Prepare Budget Upsert", type: "main", index: 0 }],
  [{ node: "Prepare Budget Delete", type: "main", index: 0 }],
  [{ node: "Read Budgets", type: "main", index: 0 }],
  [{ node: "Route Voice", type: "main", index: 0 }],
];

workflow.id = "telegram-personal-assistant-inbox-budget-commands";
workflow.name = "Telegram Personal Assistant - Inbox Budget Commands";
workflow.active = false;
workflow.updatedAt = new Date().toISOString();

writeWorkflow(path.join(workspace, "workflows/telegram-assistant-inbox-budget-commands.json"), workflow);
writeWorkflow(path.join(workspace, "workflows/current-inbox-after-budget-commands.json"), workflow);

console.log("Wrote budget command inbox workflow exports.");
