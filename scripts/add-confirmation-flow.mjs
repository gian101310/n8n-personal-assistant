import fs from "node:fs";

const workspace = process.cwd();
const workflow = JSON.parse(fs.readFileSync(`${workspace}/workflows/current-inbox-after-voice-ogg-fix.json`, "utf8"))[0];
const SUPABASE_URL = "https://uxdueryjbfzfvyznxgax.supabase.co";

function node(name) {
  const found = workflow.nodes.find((candidate) => candidate.name === name);
  if (!found) throw new Error(`Missing node: ${name}`);
  return found;
}

function headers(json = false) {
  const parameters = [
    { name: "apikey", value: "={{ $env.SUPABASE_SERVICE_ROLE_KEY }}" },
    { name: "Authorization", value: "={{ 'Bearer ' + $env.SUPABASE_SERVICE_ROLE_KEY }}" },
  ];
  if (json) {
    parameters.push({ name: "Content-Type", value: "application/json" });
    parameters.push({ name: "Prefer", value: "return=representation" });
  }
  return { parameters };
}

function httpNode(id, name, method, url, position, bodyExpression = null) {
  const parameters = {
    method,
    url,
    sendHeaders: true,
    headerParameters: headers(method !== "GET"),
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

const telegramCredentials = node("Telegram Inbox").credentials;

node("Telegram Inbox").parameters.updates = ["message", "callback_query"];

const normalize = node("Normalize Telegram Input");
normalize.parameters.jsCode = normalize.parameters.jsCode.replace(
  'const message = update.message || update.edited_message || {};',
  `const callback = update.callback_query || null;
const message = callback?.message || update.message || update.edited_message || {};`,
);
normalize.parameters.jsCode = normalize.parameters.jsCode.replace(
  'const text = message.text || message.caption || "";',
  `const text = callback?.data || message.text || message.caption || "";
const lowerText = String(text || "").trim().toLowerCase();
const pendingCommand = lowerText === "confirm" || lowerText === "/confirm" || lowerText.startsWith("confirm ")
  ? "confirm"
  : (lowerText === "cancel" || lowerText === "/cancel" || lowerText.startsWith("cancel ") ? "cancel" : "");`,
);
normalize.parameters.jsCode = normalize.parameters.jsCode.replace(
  'needsTranscription: isVoice,',
  'needsTranscription: isVoice,\n    pendingCommand,',
);

const routeCommand = {
  parameters: {
    mode: "expression",
    output: "={{ $json.pendingCommand === 'confirm' ? 0 : ($json.pendingCommand === 'cancel' ? 1 : 2) }}",
  },
  id: "assistant-route-command",
  name: "Route Pending Command",
  type: "n8n-nodes-base.switch",
  typeVersion: 3.2,
  position: [480, 300],
};

const readPendingConfirm = httpNode(
  "assistant-read-pending-confirm",
  "Read Pending for Confirm",
  "GET",
  `=${SUPABASE_URL}/rest/v1/assistant_pending_actions?chat_id=eq.{{ $json.chatId }}&status=eq.pending&expires_at=gt.{{ encodeURIComponent($now.toISO()) }}&select=*&order=created_at.desc&limit=1`,
  [720, 80],
);

const readPendingCancel = httpNode(
  "assistant-read-pending-cancel",
  "Read Pending for Cancel",
  "GET",
  `=${SUPABASE_URL}/rest/v1/assistant_pending_actions?chat_id=eq.{{ $json.chatId }}&status=eq.pending&expires_at=gt.{{ encodeURIComponent($now.toISO()) }}&select=*&order=created_at.desc&limit=1`,
  [720, 240],
);

const prepareConfirmed = {
  parameters: {
    jsCode: `const pending = $input.first().json;
if (!pending?.id) return [{ json: { skipPending: true, confirmation: "No pending item to confirm." } }];
const payload = pending.payload || {};
if (pending.action_type === "expense" || pending.action_type === "receipt") {
  return [{
    json: {
      pending_id: pending.id,
      target: "expense",
      expense_date: payload.date || new Date().toISOString().slice(0, 10),
      merchant: payload.merchant || null,
      amount: Number(payload.amount || 0),
      currency: payload.currency || "AED",
      category: payload.category || "Other",
      payment_method: payload.payment_method || null,
      card: payload.card || null,
      notes: payload.notes || null,
      source: payload.source || "telegram_pending",
      confidence: payload.confidence || 0,
      raw_payload: payload,
      confirmation: "Confirmed expense: " + (payload.merchant || "Unknown") + " " + Number(payload.amount || 0) + " " + (payload.currency || "AED")
    }
  }];
}
return [{
  json: {
    pending_id: pending.id,
    target: "task",
    task: payload.task || payload.notes || "",
    type: payload.intent === "reminder" ? "reminder" : "todo",
    status: "open",
    priority: payload.priority || "normal",
    due_at: payload.due_at || null,
    notes: payload.notes || null,
    raw_payload: payload,
    confirmation: "Confirmed task: " + (payload.task || payload.notes || "Task")
  }
}];`,
  },
  id: "assistant-prepare-confirmed",
  name: "Prepare Confirmed Pending",
  type: "n8n-nodes-base.code",
  typeVersion: 2,
  position: [960, 80],
};

const routeConfirmed = {
  parameters: {
    mode: "expression",
    output: "={{ $json.skipPending ? 2 : ($json.target === 'expense' ? 0 : 1) }}",
  },
  id: "assistant-route-confirmed",
  name: "Route Confirmed Pending",
  type: "n8n-nodes-base.switch",
  typeVersion: 3.2,
  position: [1200, 80],
};

const appendConfirmedExpense = httpNode(
  "assistant-append-confirmed-expense",
  "Append Confirmed Expense",
  "POST",
  `${SUPABASE_URL}/rest/v1/assistant_expenses`,
  [1440, -20],
  `={{ JSON.stringify({
  expense_date: $json.expense_date,
  merchant: $json.merchant,
  amount: $json.amount,
  currency: $json.currency,
  category: $json.category,
  payment_method: $json.payment_method,
  card: $json.card,
  notes: $json.notes,
  source: $json.source,
  confidence: $json.confidence,
  raw_payload: $json.raw_payload
}) }}`,
);

const appendConfirmedTask = httpNode(
  "assistant-append-confirmed-task",
  "Append Confirmed Task",
  "POST",
  `${SUPABASE_URL}/rest/v1/assistant_tasks`,
  [1440, 120],
  `={{ JSON.stringify({
  task: $json.task,
  type: $json.type,
  status: $json.status,
  priority: $json.priority,
  due_at: $json.due_at,
  notes: $json.notes,
  raw_payload: $json.raw_payload
}) }}`,
);

const markPendingConfirmed = httpNode(
  "assistant-mark-pending-confirmed",
  "Mark Pending Confirmed",
  "PATCH",
  `=${SUPABASE_URL}/rest/v1/assistant_pending_actions?id=eq.{{ $('Prepare Confirmed Pending').item.json.pending_id }}`,
  [1680, 80],
  `={{ JSON.stringify({ status: "confirmed", resolved_at: new Date().toISOString() }) }}`,
);

const prepareCancel = {
  parameters: {
    jsCode: `const pending = $input.first().json;
if (!pending?.id) return [{ json: { skipPending: true, confirmation: "No pending item to cancel." } }];
return [{ json: { pending_id: pending.id, confirmation: "Cancelled pending " + pending.action_type + "." } }];`,
  },
  id: "assistant-prepare-cancel",
  name: "Prepare Cancel Pending",
  type: "n8n-nodes-base.code",
  typeVersion: 2,
  position: [960, 240],
};

const markPendingCancelled = httpNode(
  "assistant-mark-pending-cancelled",
  "Mark Pending Cancelled",
  "PATCH",
  `=${SUPABASE_URL}/rest/v1/assistant_pending_actions?id=eq.{{ $json.pending_id }}`,
  [1200, 240],
  `={{ JSON.stringify({ status: "cancelled", resolved_at: new Date().toISOString() }) }}`,
);

const pendingConfirmReply = {
  ...node("Confirm Unknown"),
  id: "assistant-pending-command-reply",
  name: "Confirm Pending Command",
  position: [1920, 160],
  parameters: {
    chatId: "=5379148910",
    text: "={{ $('Prepare Confirmed Pending').item.json.confirmation || $('Prepare Cancel Pending').item.json.confirmation || $json.confirmation }}",
    additionalFields: { appendAttribution: false },
  },
  credentials: telegramCredentials,
};

const preparePending = {
  parameters: {
    jsCode: `return $input.all().map((item) => {
  const j = item.json;
  const actionType = j.intent === "receipt" ? "receipt" : (j.intent === "reminder" ? "reminder" : (j.intent === "todo" ? "task" : "expense"));
  const summary = actionType === "task" || actionType === "reminder"
    ? (j.task || j.notes || "Task")
    : ((j.merchant || "Unknown") + " " + Number(j.amount || 0) + " " + (j.currency || "AED"));
  return {
    json: {
      chat_id: j.chatId || "",
      action_type: actionType,
      status: "pending",
      payload: j,
      source: j.source || "telegram",
      message_id: "",
      pendingReply: "Please confirm before I save this:\\n" + summary + "\\n\\nReply: confirm or cancel"
    }
  };
});`,
  },
  id: "assistant-prepare-pending",
  name: "Prepare Pending Action",
  type: "n8n-nodes-base.code",
  typeVersion: 2,
  position: [1540, 720],
};

const appendPending = httpNode(
  "assistant-append-pending",
  "Append Pending Action",
  "POST",
  `${SUPABASE_URL}/rest/v1/assistant_pending_actions`,
  [1780, 720],
  "={{ JSON.stringify($json) }}",
);

const confirmPendingRequest = {
  ...node("Confirm Unknown"),
  id: "assistant-confirm-pending-request",
  name: "Confirm Pending Request",
  position: [2020, 720],
  parameters: {
    chatId: "=5379148910",
    text: "={{ $('Prepare Pending Action').item.json.pendingReply }}",
    additionalFields: { appendAttribution: false },
  },
  credentials: telegramCredentials,
};

workflow.nodes = workflow.nodes.filter(
  (candidate) =>
    ![
      "Route Pending Command",
      "Read Pending for Confirm",
      "Read Pending for Cancel",
      "Prepare Confirmed Pending",
      "Route Confirmed Pending",
      "Append Confirmed Expense",
      "Append Confirmed Task",
      "Mark Pending Confirmed",
      "Prepare Cancel Pending",
      "Mark Pending Cancelled",
      "Confirm Pending Command",
      "Prepare Pending Action",
      "Append Pending Action",
      "Confirm Pending Request",
    ].includes(candidate.name),
);
workflow.nodes.push(
  routeCommand,
  readPendingConfirm,
  readPendingCancel,
  prepareConfirmed,
  routeConfirmed,
  appendConfirmedExpense,
  appendConfirmedTask,
  markPendingConfirmed,
  prepareCancel,
  markPendingCancelled,
  pendingConfirmReply,
  preparePending,
  appendPending,
  confirmPendingRequest,
);

workflow.connections["Telegram Inbox"] = {
  main: [[{ node: "Normalize Telegram Input", type: "main", index: 0 }]],
};
workflow.connections["Normalize Telegram Input"] = {
  main: [[{ node: "Route Pending Command", type: "main", index: 0 }]],
};
workflow.connections["Route Pending Command"] = {
  main: [
    [{ node: "Read Pending for Confirm", type: "main", index: 0 }],
    [{ node: "Read Pending for Cancel", type: "main", index: 0 }],
    [{ node: "Route Voice", type: "main", index: 0 }],
  ],
};
workflow.connections["Read Pending for Confirm"] = {
  main: [[{ node: "Prepare Confirmed Pending", type: "main", index: 0 }]],
};
workflow.connections["Prepare Confirmed Pending"] = {
  main: [[{ node: "Route Confirmed Pending", type: "main", index: 0 }]],
};
workflow.connections["Route Confirmed Pending"] = {
  main: [
    [{ node: "Append Confirmed Expense", type: "main", index: 0 }],
    [{ node: "Append Confirmed Task", type: "main", index: 0 }],
    [{ node: "Confirm Pending Command", type: "main", index: 0 }],
  ],
};
workflow.connections["Append Confirmed Expense"] = {
  main: [[{ node: "Mark Pending Confirmed", type: "main", index: 0 }]],
};
workflow.connections["Append Confirmed Task"] = {
  main: [[{ node: "Mark Pending Confirmed", type: "main", index: 0 }]],
};
workflow.connections["Mark Pending Confirmed"] = {
  main: [[{ node: "Confirm Pending Command", type: "main", index: 0 }]],
};
workflow.connections["Read Pending for Cancel"] = {
  main: [[{ node: "Prepare Cancel Pending", type: "main", index: 0 }]],
};
workflow.connections["Prepare Cancel Pending"] = {
  main: [[{ node: "Mark Pending Cancelled", type: "main", index: 0 }]],
};
workflow.connections["Mark Pending Cancelled"] = {
  main: [[{ node: "Confirm Pending Command", type: "main", index: 0 }]],
};

workflow.connections["Route Intent"].main[3] = [{ node: "Prepare Pending Action", type: "main", index: 0 }];
workflow.connections["Prepare Pending Action"] = {
  main: [[{ node: "Append Pending Action", type: "main", index: 0 }]],
};
workflow.connections["Append Pending Action"] = {
  main: [[{ node: "Confirm Pending Request", type: "main", index: 0 }]],
};

workflow.id = "telegram-personal-assistant-inbox";
workflow.name = "Telegram Personal Assistant - Inbox";
workflow.active = false;
fs.writeFileSync(`${workspace}/workflows/telegram-assistant-inbox-confirmation.json`, JSON.stringify(workflow, null, 2));

