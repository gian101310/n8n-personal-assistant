import fs from "node:fs";
import path from "node:path";

const workspace = process.cwd();
const sourcePath = path.join(workspace, "workflows/current-inbox-after-memory-preferences.json");
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

function httpNode(id, name, method, url, position, bodyExpression = null, extra = {}) {
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
  'const pendingCommand = lowerText === "confirm" || lowerText === "/confirm" || lowerText.startsWith("confirm ")\n  ? "confirm"\n  : (lowerText === "cancel" || lowerText === "/cancel" || lowerText.startsWith("cancel ")\n    ? "cancel"\n    : (/^(undo|undo last|delete last|remove last)( expense)?$/.test(lowerText) ? "undo_expense" : ""));',
  `function cleanMemoryValue(value) {
  return String(value || "").trim().replace(/^[:\\-\\s]+/, "").replace(/[?.!\\s]+$/, "").trim();
}
function parseMemoryCommand(value) {
  const textValue = String(value || "").trim();
  if (!textValue) return { command: "" };
  if (/^(what do you remember|what have i told you to remember|show memories|list memories|list my memories)\\??$/i.test(textValue)
    || (/^remind me/i.test(textValue) && /\\b(notes? to remember|told you.*remember|everything.*remember)\\b/i.test(textValue))) {
    return { command: "recall" };
  }
  const forgetMatch = textValue.match(/^(?:forget|delete memory|remove memory)\\s+(.+)$/i);
  if (forgetMatch) {
    const query = cleanMemoryValue(forgetMatch[1]);
    return query ? { command: "forget", query } : { command: "" };
  }
  const rememberMatch = textValue.match(/^(?:remember|note to remember|save memory|memorize)\\b\\s*:?\\s*(.+)$/i);
  if (rememberMatch) {
    const content = cleanMemoryValue(rememberMatch[1]);
    return content ? { command: "remember", content, memoryType: "note" } : { command: "" };
  }
  const politeRemember = textValue.match(/^(?:please\\s+)?remember\\b\\s*(.+)$/i);
  if (politeRemember) {
    const content = cleanMemoryValue(politeRemember[1]);
    return content ? { command: "remember", content, memoryType: "note" } : { command: "" };
  }
  return { command: "" };
}
const memoryCommand = parseMemoryCommand(text);
const pendingCommand = lowerText === "confirm" || lowerText === "/confirm" || lowerText.startsWith("confirm ")
  ? "confirm"
  : (lowerText === "cancel" || lowerText === "/cancel" || lowerText.startsWith("cancel ")
    ? "cancel"
    : (/^(undo|undo last|delete last|remove last)( expense)?$/.test(lowerText) ? "undo_expense" : (memoryCommand.command ? "memory_" + memoryCommand.command : "")));`,
);
normalize.parameters.jsCode = normalize.parameters.jsCode.replace(
  "pendingCommand,\n    isCallback,",
  "pendingCommand,\n    memoryCommand,\n    isCallback,",
);

node("Route Pending Command").parameters.output =
  "={{ $json.pendingCommand === 'confirm' ? 0 : ($json.pendingCommand === 'cancel' ? 1 : ($json.pendingCommand === 'undo_expense' ? 2 : ($json.pendingCommand === 'memory_remember' ? 3 : ($json.pendingCommand === 'memory_forget' ? 4 : ($json.pendingCommand === 'memory_recall' ? 5 : 6))))) }}";

const openAiCredentials = node("OpenAI Parse Message").credentials;

upsertNode(codeNode(
  "assistant-prepare-memory-embedding",
  "Prepare Memory Embedding",
  [700, -520],
  String.raw`const source = $("Normalize Telegram Input").item.json;
const command = source.memoryCommand || {};
return [{
  json: {
    chatId: source.chatId,
    content: String(command.content || "").trim(),
    memory_type: command.memoryType || "note",
    metadata: {
      source: "telegram",
      chat_id: source.chatId,
      original_text: source.originalText,
      command: "remember"
    },
    embeddingBody: {
      model: "text-embedding-3-small",
      input: String(command.content || "").trim(),
      encoding_format: "float"
    }
  }
}];`,
));

upsertNode({
  parameters: {
    method: "POST",
    url: "https://api.openai.com/v1/embeddings",
    authentication: "predefinedCredentialType",
    nodeCredentialType: "openAiApi",
    sendBody: true,
    specifyBody: "json",
    jsonBody: "={{ JSON.stringify($json.embeddingBody) }}",
    options: {},
  },
  id: "assistant-create-memory-embedding",
  name: "Create Memory Embedding",
  type: "n8n-nodes-base.httpRequest",
  typeVersion: 4.4,
  position: [940, -520],
  credentials: openAiCredentials,
});

upsertNode(codeNode(
  "assistant-prepare-create-memory",
  "Prepare Create Memory",
  [1180, -520],
  String.raw`const source = $("Prepare Memory Embedding").item.json;
const embedding = $input.first().json?.data?.[0]?.embedding || null;
return [{
  json: {
    memory_type: source.memory_type,
    content: source.content,
    metadata: source.metadata,
    memory_embedding: embedding,
    confirmation: "Remembered: " + source.content
  }
}];`,
));

upsertNode(httpNode(
  "assistant-create-memory",
  "Create Memory",
  "POST",
  `${SUPABASE_URL}/rest/v1/rpc/assistant_create_memory`,
  [1420, -520],
  "={{ JSON.stringify({ memory_type: $json.memory_type, content: $json.content, metadata: $json.metadata, memory_embedding: $json.memory_embedding }) }}",
));

upsertNode(telegramNode(
  "assistant-confirm-memory",
  "Confirm Memory Command",
  [1660, -420],
  "={{ $json.confirmation || ($json.saved_content ? 'Remembered: ' + $json.saved_content : ($json.forgotten_content ? 'Forgot: ' + $json.forgotten_content : 'Memory command completed.')) }}",
));

upsertNode(httpNode(
  "assistant-read-memories-for-forget",
  "Read Memories for Forget",
  "GET",
  `${SUPABASE_URL}/rest/v1/assistant_memories?select=id,memory_type,content,metadata,created_at&order=created_at.desc&limit=50`,
  [700, -360],
  null,
  { alwaysOutputData: true },
));

upsertNode(codeNode(
  "assistant-prepare-forget-memory",
  "Prepare Forget Memory",
  [940, -360],
  String.raw`const source = $("Normalize Telegram Input").item.json;
const query = String(source.memoryCommand?.query || "").toLowerCase();
const rows = $input.all().map((item) => item.json).filter((row) => row.id);
function score(row) {
  const content = String(row.content || "").toLowerCase();
  const words = query.split(/\s+/).filter(Boolean);
  return (content.includes(query) ? 10 : 0) + words.filter((word) => content.includes(word)).length;
}
let best = null;
let bestScore = 0;
for (const row of rows) {
  const current = score(row);
  if (current > bestScore) {
    best = row;
    bestScore = current;
  }
}
if (!best || bestScore === 0) {
  return [{ json: { skipForget: true, confirmation: "I could not find a remembered note matching: " + (source.memoryCommand?.query || "") } }];
}
return [{ json: { memory_id: best.id, forgotten_content: best.content, confirmation: "Forgot: " + best.content } }];`,
));

upsertNode({
  parameters: {
    mode: "expression",
    output: "={{ $json.skipForget ? 1 : 0 }}",
  },
  id: "assistant-route-forget-memory",
  name: "Route Forget Memory",
  type: "n8n-nodes-base.switch",
  typeVersion: 3.2,
  position: [1180, -360],
});

upsertNode(httpNode(
  "assistant-forget-memory",
  "Forget Memory",
  "POST",
  `${SUPABASE_URL}/rest/v1/rpc/assistant_forget_memory`,
  [1420, -400],
  "={{ JSON.stringify({ memory_id: $json.memory_id }) }}",
));

upsertNode(httpNode(
  "assistant-read-memories-for-recall",
  "Read Memories for Recall",
  "POST",
  `${SUPABASE_URL}/rest/v1/rpc/assistant_recent_memories`,
  [700, -200],
  "={{ JSON.stringify({ memory_count: 30 }) }}",
  { alwaysOutputData: true },
));

upsertNode(codeNode(
  "assistant-prepare-memory-recall",
  "Prepare Memory Recall",
  [940, -200],
  String.raw`const rows = $input.all().map((item) => item.json).filter((row) => String(row.content || "").trim());
if (!rows.length) {
  return [{ json: { confirmation: "I do not have any remembered notes yet. Send: remember <thing to remember>." } }];
}
const lines = rows.slice(0, 30).map((row, index) => (index + 1) + ". " + row.content);
return [{ json: { confirmation: "Here is what you told me to remember:\n" + lines.join("\n") } }];`,
));

connect("Prepare Memory Embedding", ["Create Memory Embedding"]);
connect("Create Memory Embedding", ["Prepare Create Memory"]);
connect("Prepare Create Memory", ["Create Memory"]);
connect("Create Memory", ["Confirm Memory Command"]);
connect("Read Memories for Forget", ["Prepare Forget Memory"]);
connect("Prepare Forget Memory", ["Route Forget Memory"]);
workflow.connections["Route Forget Memory"] = {
  main: [
    [{ node: "Forget Memory", type: "main", index: 0 }],
    [{ node: "Confirm Memory Command", type: "main", index: 0 }],
  ],
};
connect("Forget Memory", ["Confirm Memory Command"]);
connect("Read Memories for Recall", ["Prepare Memory Recall"]);
connect("Prepare Memory Recall", ["Confirm Memory Command"]);

workflow.connections["Route Pending Command"].main = [
  [{ node: "Read Pending for Confirm", type: "main", index: 0 }],
  [{ node: "Read Pending for Cancel", type: "main", index: 0 }],
  [{ node: "Read Last Expense for Undo", type: "main", index: 0 }],
  [{ node: "Prepare Memory Embedding", type: "main", index: 0 }],
  [{ node: "Read Memories for Forget", type: "main", index: 0 }],
  [{ node: "Read Memories for Recall", type: "main", index: 0 }],
  [{ node: "Route Voice", type: "main", index: 0 }],
];

workflow.id = "telegram-personal-assistant-inbox-memory-commands";
workflow.name = "Telegram Personal Assistant - Inbox Memory Commands";
workflow.active = false;
workflow.updatedAt = new Date().toISOString();

writeWorkflow(path.join(workspace, "workflows/telegram-assistant-inbox-memory-commands.json"), workflow);
writeWorkflow(path.join(workspace, "workflows/current-inbox-after-memory-commands.json"), workflow);

console.log("Wrote memory command inbox workflow exports.");
