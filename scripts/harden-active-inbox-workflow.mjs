import fs from "node:fs";
import path from "node:path";

const workspace = process.cwd();
const workflowPaths = [
  path.join(workspace, "workflows/current-inbox-after-budget-commands.json"),
  path.join(workspace, "workflows/telegram-assistant-inbox-budget-commands.json"),
];
const SUPABASE_URL = "https://uxdueryjbfzfvyznxgax.supabase.co";
const SAFE_CHAT_ID = "={{ $('Normalize Telegram Input').item.json.chatId || '5379148910' }}";

function readWorkflow(filePath) {
  const data = JSON.parse(fs.readFileSync(filePath, "utf8"));
  return Array.isArray(data) ? data[0] : data;
}

function writeWorkflow(filePath, workflow) {
  fs.writeFileSync(filePath, JSON.stringify([workflow], null, 2));
}

function headers(prefer = "return=representation") {
  return {
    parameters: [
      { name: "apikey", value: "={{ $env.SUPABASE_SERVICE_ROLE_KEY }}" },
      { name: "Authorization", value: "={{ 'Bearer ' + $env.SUPABASE_SERVICE_ROLE_KEY }}" },
      { name: "Content-Type", value: "application/json" },
      { name: "Prefer", value: prefer },
    ],
  };
}

function getHeaders() {
  return {
    parameters: [
      { name: "apikey", value: "={{ $env.SUPABASE_SERVICE_ROLE_KEY }}" },
      { name: "Authorization", value: "={{ 'Bearer ' + $env.SUPABASE_SERVICE_ROLE_KEY }}" },
    ],
  };
}

function upsertNode(workflow, nextNode) {
  const index = workflow.nodes.findIndex((item) => item.name === nextNode.name);
  if (index === -1) workflow.nodes.push(nextNode);
  else workflow.nodes[index] = { ...workflow.nodes[index], ...nextNode };
}

function findNode(workflow, name) {
  const found = workflow.nodes.find((item) => item.name === name);
  if (!found) throw new Error(`Missing node: ${name}`);
  return found;
}

function httpNode(id, name, method, url, position, bodyExpression = null, extra = {}) {
  const prefer = extra.prefer;
  delete extra.prefer;
  const parameters = {
    method,
    url,
    sendHeaders: true,
    headerParameters: method === "GET" ? getHeaders() : headers(prefer),
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

function telegramReply(workflow, id, name, position, text) {
  const base = findNode(workflow, "Confirm Unknown");
  return {
    ...base,
    id,
    name,
    position,
    parameters: {
      resource: "message",
      operation: "sendMessage",
      chatId: SAFE_CHAT_ID,
      text,
      additionalFields: { appendAttribution: false },
    },
  };
}

const normalizeCode = String.raw`const item = $input.first();
const update = item.json || {};
const callback = update.callback_query || null;
const message = callback?.message || update.message || update.edited_message || {};
const chatId = message.chat?.id ? String(message.chat.id) : "";
const callbackData = String(callback?.data || "");
const text = callbackData || message.text || message.caption || "";
const isCallback = Boolean(callback?.id);
const callbackQueryId = callback?.id || "";
const telegramUpdateId = update.update_id ?? null;
const pendingActionMatch = callbackData.match(/^(?:confirm|cancel)[:|]([0-9a-f-]{36})$/i);
const pendingActionId = pendingActionMatch ? pendingActionMatch[1] : "";
const lowerText = String(text || "").trim().toLowerCase();
function cleanMemoryValue(value) {
  return String(value || "").trim().replace(/^[:\-\s]+/, "").replace(/[?.!\s]+$/, "").trim();
}
function parseMemoryCommand(value) {
  const textValue = String(value || "").trim();
  if (!textValue) return { command: "" };
  if (/^(what do you remember|what have i told you to remember|show memories|list memories|list my memories)\??$/i.test(textValue)
    || (/^remind me/i.test(textValue) && /\b(notes? to remember|told you.*remember|everything.*remember)\b/i.test(textValue))) {
    return { command: "recall" };
  }
  const forgetMatch = textValue.match(/^(?:forget|delete memory|remove memory)\s+(.+)$/i);
  if (forgetMatch) {
    const query = cleanMemoryValue(forgetMatch[1]);
    return query ? { command: "forget", query } : { command: "" };
  }
  const rememberMatch = textValue.match(/^(?:remember|note to remember|save memory|memorize)\b\s*:?\s*(.+)$/i);
  if (rememberMatch) {
    const content = cleanMemoryValue(rememberMatch[1]);
    return content ? { command: "remember", content, memoryType: "note" } : { command: "" };
  }
  const politeRemember = textValue.match(/^(?:please\s+)?remember\b\s*(.+)$/i);
  if (politeRemember) {
    const content = cleanMemoryValue(politeRemember[1]);
    return content ? { command: "remember", content, memoryType: "note" } : { command: "" };
  }
  return { command: "" };
}
function cleanBudgetCategory(value) {
  return String(value || "").trim().replace(/^[:\-\s]+/, "").replace(/[?.!\s]+$/, "").trim();
}
function parseBudgetAmount(value) {
  const cleaned = String(value || "").toLowerCase().replace(/,/g, "").replace(/\s*aed\s*$/i, "").trim();
  const kMatch = cleaned.match(/^(\d+(?:\.\d+)?)\s*k$/);
  const amount = kMatch ? Number(kMatch[1]) * 1000 : Number(cleaned);
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
  const amountPattern = "([\\d,]+(?:\\.\\d{1,2})?\\s*k?|\\d+(?:\\.\\d+)?k|[\\d,]+(?:\\.\\d{1,2})?\\s*aed)";
  const setMatch =
    textValue.match(new RegExp("^(?:set|make)\\s+(.+?)\\s+budget\\s+(?:to\\s+)?(?:aed\\s*)?" + amountPattern + "(?:\\s+(weekly|monthly))?$", "i")) ||
    textValue.match(new RegExp("^budget\\s+(.+?)\\s+(?:to\\s+)?(?:aed\\s*)?" + amountPattern + "(?:\\s+(weekly|monthly))?$", "i")) ||
    textValue.match(new RegExp("^(.+?)\\s+budget\\s+(?:is\\s+|=|to\\s+)?(?:aed\\s*)?" + amountPattern + "(?:\\s+(weekly|monthly))?$", "i")) ||
    textValue.match(new RegExp("^(.+?)\\s+limit\\s+(?:aed\\s*)?" + amountPattern + "(?:\\s+(weekly|monthly))?$", "i")) ||
    textValue.match(new RegExp("^set\\s+(weekly|monthly)\\s+(.+?)\\s+cap\\s+(?:aed\\s*)?" + amountPattern + "$", "i")) ||
    textValue.match(new RegExp("^(.+?)\\s+(?:aed\\s*)?" + amountPattern + "(?:\\s+(weekly|monthly))?$", "i"));
  if (setMatch) {
    const periodFirst = setMatch[1] === "weekly" || setMatch[1] === "monthly";
    const category = cleanBudgetCategory(periodFirst ? setMatch[2] : setMatch[1]);
    const amount = parseBudgetAmount(periodFirst ? setMatch[3] : setMatch[2]);
    const period = periodFirst ? setMatch[1] : (setMatch[3] || "monthly");
    return category && amount ? { command: "set", category, amount, period } : { command: "" };
  }
  return { command: "" };
}
const memoryCommand = parseMemoryCommand(text);
const budgetCommand = parseBudgetCommand(text);
const pendingCommand = lowerText === "confirm" || lowerText === "/confirm" || lowerText.startsWith("confirm") || lowerText.startsWith("confirm:")
  ? "confirm"
  : (lowerText === "cancel" || lowerText === "/cancel" || lowerText.startsWith("cancel") || lowerText.startsWith("cancel:")
    ? "cancel"
    : (/^(undo|undo last|delete last|remove last)( expense)?$/.test(lowerText) ? "undo_expense" : (memoryCommand.command ? "memory_" + memoryCommand.command : (budgetCommand.command ? "budget_" + budgetCommand.command : ""))));
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
].join("\n");

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
    telegramUpdateId,
    createdAt,
    source: isVoice ? "telegram_voice" : (isPhoto ? "telegram_photo" : "telegram_text"),
    originalText: text,
    needsTranscription: isVoice,
    pendingCommand,
    pendingActionId,
    memoryCommand,
    budgetCommand,
    isCallback,
    callbackQueryId,
    mediaMimeType: media?.mimeType || "",
    binaryKey: firstBinaryKey || "",
    voiceFileId: message.voice?.file_id || "",
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

const appendBudgetWarningCode = String.raw`const budget = $("Read Budget After Expense").item.json || {};
const rows = $input.all().map((item) => item.json).filter((row) => row.amount !== undefined);
const base = $("Parse OpenAI Result").item.json;
const confirmation = base.confirmation || "Saved expense.";
const limit = Number(budget.amount || 0);

if (!limit) return [{ json: { ...base, confirmation } }];

const spend = rows.reduce((total, row) => total + Number(row.amount || 0), 0);
const percent = spend / limit;
let warning = "";
if (percent >= 1) {
  warning = "\nBudget alert: " + (budget.category || base.category || "This category") + " is over budget at AED " + spend.toLocaleString("en-US") + " of AED " + limit.toLocaleString("en-US") + ".";
} else if (percent >= 0.8) {
  warning = "\nBudget alert: " + (budget.category || base.category || "This category") + " is at " + Math.round(percent * 100) + "% of the monthly budget.";
}

return [{ json: { ...base, monthlySpend: spend, monthlyBudget: limit, confirmation: confirmation + warning } }];`;

const appendConfirmedBudgetWarningCode = String.raw`const budget = $("Read Budget After Confirmed Expense").item.json || {};
const rows = $input.all().map((item) => item.json).filter((row) => row.amount !== undefined);
const base = $("Prepare Confirmed Pending").item.json;
const limit = Number(budget.amount || 0);

if (!limit) return [{ json: base }];

const spend = rows.reduce((total, row) => total + Number(row.amount || 0), 0);
const percent = spend / limit;
let warning = "";
if (percent >= 1) {
  warning = "\nBudget alert: " + (budget.category || base.category || "This category") + " is over budget at AED " + spend.toLocaleString("en-US") + " of AED " + limit.toLocaleString("en-US") + ".";
} else if (percent >= 0.8) {
  warning = "\nBudget alert: " + (budget.category || base.category || "This category") + " is at " + Math.round(percent * 100) + "% of the monthly budget.";
}

return [{ json: { ...base, monthlySpend: spend, monthlyBudget: limit, confirmation: (base.confirmation || "Confirmed expense.") + warning } }];`;

for (const workflowPath of workflowPaths) {
  const workflow = readWorkflow(workflowPath);

  findNode(workflow, "Normalize Telegram Input").parameters.jsCode = normalizeCode;

  for (const current of workflow.nodes) {
    if (current.type === "n8n-nodes-base.telegram" && ["=5379148910", "5379148910"].includes(current.parameters?.chatId)) {
      current.parameters.chatId = SAFE_CHAT_ID;
    }
  }

  findNode(workflow, "Read Pending for Confirm").parameters.url =
    `={{ '${SUPABASE_URL}/rest/v1/assistant_pending_actions?select=*&status=eq.pending&expires_at=gt.' + encodeURIComponent($now.toISO()) + '&chat_id=eq.' + encodeURIComponent($json.chatId) + ($json.pendingActionId ? '&id=eq.' + encodeURIComponent($json.pendingActionId) : '&order=created_at.desc&limit=1') }}`;
  findNode(workflow, "Read Pending for Cancel").parameters.url =
    `={{ '${SUPABASE_URL}/rest/v1/assistant_pending_actions?select=*&status=eq.pending&expires_at=gt.' + encodeURIComponent($now.toISO()) + '&chat_id=eq.' + encodeURIComponent($json.chatId) + ($json.pendingActionId ? '&id=eq.' + encodeURIComponent($json.pendingActionId) : '&order=created_at.desc&limit=1') }}`;
  findNode(workflow, "Route Pending Command").parameters.numberOutputs = 10;

  findNode(workflow, "Prepare Budget Upsert").parameters.jsCode = String.raw`const source = $("Normalize Telegram Input").item.json;
const command = source.budgetCommand || {};
const category = String(command.category || "").trim();
const amount = Number(command.amount || 0);
const period = command.period || "monthly";
return [{
  json: {
    category,
    amount,
    currency: "AED",
    period,
    active: true,
    confirmation: "Budget set: " + category + " at AED " + amount.toLocaleString("en-US") + " " + period + "."
  }
}];`;

  upsertNode(workflow, httpNode(
    "assistant-check-telegram-update-dedupe",
    "Check Telegram Update Dedupe",
    "POST",
    `${SUPABASE_URL}/rest/v1/assistant_processed_telegram_updates?on_conflict=telegram_update_id`,
    [340, 304],
    "={{ JSON.stringify({ telegram_update_id: $json.telegramUpdateId, chat_id: $json.chatId, update_type: $json.isCallback ? 'callback_query' : $json.source, received_at: $json.createdAt, raw_payload: { source: $json.source, original_text: $json.originalText } }) }}",
    { prefer: "resolution=ignore-duplicates,return=representation", alwaysOutputData: true },
  ));

  upsertNode(workflow, {
    parameters: { mode: "expression", output: "={{ $json.telegram_update_id ? 1 : 0 }}" },
    id: "assistant-route-telegram-update-dedupe",
    name: "Route Telegram Update Dedupe",
    type: "n8n-nodes-base.switch",
    typeVersion: 3.2,
    position: [560, 304],
  });

  upsertNode(workflow, codeNode(
    "assistant-mark-telegram-update-processed",
    "Mark Telegram Update Processed",
    [760, 304],
    "return $items(\"Normalize Telegram Input\").map((item) => ({ json: item.json, binary: item.binary || {} }));",
  ));

  upsertNode(workflow, telegramReply(
    workflow,
    "assistant-reply-duplicate-telegram-update",
    "Reply Duplicate Telegram Update",
    [760, 40],
    "I already processed that Telegram update.",
  ));

  upsertNode(workflow, httpNode(
    "assistant-read-budget-after-expense",
    "Read Budget After Expense",
    "GET",
    `={{ '${SUPABASE_URL}/rest/v1/assistant_budgets?select=category,amount,currency,period,active&active=eq.true&period=eq.monthly&limit=1&category=eq.' + encodeURIComponent($json.category || 'Other') }}`,
    [1740, 120],
    null,
    { alwaysOutputData: true },
  ));

  upsertNode(workflow, httpNode(
    "assistant-read-monthly-spend-after-expense",
    "Read Monthly Spend After Expense",
    "GET",
    `={{ '${SUPABASE_URL}/rest/v1/assistant_expenses?select=amount&category=eq.' + encodeURIComponent($('Append Expense').item.json.category || 'Other') + '&expense_date=gte.' + $now.startOf('month').toISODate() + '&expense_date=lte.' + $now.endOf('month').toISODate() }}`,
    [1960, 120],
    null,
    { alwaysOutputData: true },
  ));

  upsertNode(workflow, codeNode(
    "assistant-append-budget-warning",
    "Append Budget Warning",
    [2180, 120],
    appendBudgetWarningCode,
  ));

  upsertNode(workflow, httpNode(
    "assistant-read-budget-after-confirmed-expense",
    "Read Budget After Confirmed Expense",
    "GET",
    `={{ '${SUPABASE_URL}/rest/v1/assistant_budgets?select=category,amount,currency,period,active&active=eq.true&period=eq.monthly&limit=1&category=eq.' + encodeURIComponent($json.category || 'Other') }}`,
    [1500, -120],
    null,
    { alwaysOutputData: true },
  ));

  upsertNode(workflow, httpNode(
    "assistant-read-monthly-spend-after-confirmed-expense",
    "Read Monthly Spend After Confirmed Expense",
    "GET",
    `={{ '${SUPABASE_URL}/rest/v1/assistant_expenses?select=amount&category=eq.' + encodeURIComponent($('Prepare Confirmed Pending').item.json.category || 'Other') + '&expense_date=gte.' + $now.startOf('month').toISODate() + '&expense_date=lte.' + $now.endOf('month').toISODate() }}`,
    [1720, -120],
    null,
    { alwaysOutputData: true },
  ));

  upsertNode(workflow, codeNode(
    "assistant-append-confirmed-budget-warning",
    "Append Confirmed Budget Warning",
    [1940, -120],
    appendConfirmedBudgetWarningCode,
  ));

  findNode(workflow, "Confirm Expense").parameters.text = "={{ $json.confirmation || $('Parse OpenAI Result').item.json.confirmation }}";
  findNode(workflow, "Confirm Pending Command").parameters.text = "={{ (() => { try { const warning = $('Append Confirmed Budget Warning').item.json.confirmation; if (warning) return warning; } catch (error) {} try { return $('Prepare Confirmed Pending').item.json.confirmation; } catch (error) {} try { return $('Prepare Cancel Pending').item.json.confirmation; } catch (error) {} return $json.confirmation; })() }}";

  workflow.connections["Normalize Telegram Input"] = {
    main: [[{ node: "Check Telegram Update Dedupe", type: "main", index: 0 }]],
  };
  workflow.connections["Check Telegram Update Dedupe"] = {
    main: [[{ node: "Route Telegram Update Dedupe", type: "main", index: 0 }]],
  };
  workflow.connections["Route Telegram Update Dedupe"] = {
    main: [
      [{ node: "Reply Duplicate Telegram Update", type: "main", index: 0 }],
      [{ node: "Mark Telegram Update Processed", type: "main", index: 0 }],
    ],
  };
  workflow.connections["Mark Telegram Update Processed"] = {
    main: [[
      { node: "Route Pending Command", type: "main", index: 0 },
      { node: "Prepare Callback Ack", type: "main", index: 0 },
    ]],
  };
  workflow.connections["Append Expense"] = {
    main: [[{ node: "Read Budget After Expense", type: "main", index: 0 }]],
  };
  workflow.connections["Read Budget After Expense"] = {
    main: [[{ node: "Read Monthly Spend After Expense", type: "main", index: 0 }]],
  };
  workflow.connections["Read Monthly Spend After Expense"] = {
    main: [[{ node: "Append Budget Warning", type: "main", index: 0 }]],
  };
  workflow.connections["Append Budget Warning"] = {
    main: [[{ node: "Confirm Expense", type: "main", index: 0 }]],
  };
  workflow.connections["Append Confirmed Expense"] = {
    main: [[{ node: "Read Budget After Confirmed Expense", type: "main", index: 0 }]],
  };
  workflow.connections["Read Budget After Confirmed Expense"] = {
    main: [[{ node: "Read Monthly Spend After Confirmed Expense", type: "main", index: 0 }]],
  };
  workflow.connections["Read Monthly Spend After Confirmed Expense"] = {
    main: [[{ node: "Append Confirmed Budget Warning", type: "main", index: 0 }]],
  };
  workflow.connections["Append Confirmed Budget Warning"] = {
    main: [[{ node: "Mark Pending Confirmed", type: "main", index: 0 }]],
  };

  workflow.updatedAt = new Date().toISOString();
  writeWorkflow(workflowPath, workflow);
  console.log(`Hardened ${path.relative(workspace, workflowPath)}`);
}
