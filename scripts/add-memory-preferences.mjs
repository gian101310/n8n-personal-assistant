import fs from "node:fs";
import path from "node:path";

const workspace = process.cwd();
const sourcePath = path.join(workspace, "workflows/current-inbox-after-card-defaults-published.json");
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

function supabaseGetHeaders() {
  return {
    parameters: [
      { name: "apikey", value: "={{ $env.SUPABASE_SERVICE_ROLE_KEY }}" },
      { name: "Authorization", value: "={{ 'Bearer ' + $env.SUPABASE_SERVICE_ROLE_KEY }}" },
    ],
  };
}

function httpGetNode(id, name, url, position) {
  return {
    parameters: {
      method: "GET",
      url,
      sendHeaders: true,
      headerParameters: supabaseGetHeaders(),
      options: {},
    },
    id,
    name,
    type: "n8n-nodes-base.httpRequest",
    typeVersion: 4.4,
    position,
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

const applyMemoryContextCode = String.raw`let original = $("Normalize Telegram Input").item.json;
try {
  const voiceInput = $("Apply Voice Transcript").item.json;
  if (voiceInput?.voiceTranscript) original = voiceInput;
} catch (error) {}

let parserContext = {};
try {
  parserContext = $("Read Parser Context").first().json.value || {};
} catch (error) {}

const memories = $input.all()
  .map((item) => item.json)
  .filter((memory) => String(memory.content || "").trim())
  .slice(0, 8);

function formatMap(title, values) {
  const rows = Object.entries(values || {}).filter(([key, value]) => String(key).trim() && String(value).trim());
  return rows.length ? [title, ...rows.map(([key, value]) => key + " -> " + value)] : [];
}

const lines = [
  parserContext.default_currency ? "Default currency: " + parserContext.default_currency : "",
  ...formatMap("Category defaults:", parserContext.category_defaults),
  ...formatMap("Card aliases:", parserContext.card_aliases),
  ...memories.map((memory) => "- [" + (memory.memory_type || "memory") + "] " + String(memory.content || "").trim())
].filter(Boolean);

const openaiBody = JSON.parse(JSON.stringify(original.openaiBody));
if (lines.length) {
  const contextPrompt = [
    "User preferences and memories:",
    ...lines,
    "Use these hints only when the current Telegram message does not clearly override them."
  ].join("\n");
  const systemMessage = openaiBody.input.find((entry) => entry.role === "system");
  const systemText = systemMessage?.content?.find((entry) => entry.type === "input_text");
  if (systemText) {
    systemText.text = systemText.text + "\n\n" + contextPrompt;
  }
}

return [{
  json: {
    ...original,
    parserContext,
    memoryContext: memories,
    openaiBody
  }
}];`;

upsertNode(httpGetNode(
  "assistant-read-parser-context",
  "Read Parser Context",
  `${SUPABASE_URL}/rest/v1/assistant_preferences?key=eq.parser_context&select=value&limit=1`,
  [900, 420],
));

upsertNode(httpGetNode(
  "assistant-read-recent-memories",
  "Read Recent Memories",
  `${SUPABASE_URL}/rest/v1/assistant_memories?select=memory_type,content,metadata,created_at&order=created_at.desc&limit=8`,
  [1120, 420],
));

upsertNode(codeNode(
  "assistant-apply-memory-context",
  "Apply Memory Context",
  [1340, 420],
  applyMemoryContextCode,
));

node("OpenAI Parse Message").position = [1580, 420];
node("Parse OpenAI Result").position = [1820, 420];

workflow.connections["Route Voice"].main[1] = [{ node: "Read Parser Context", type: "main", index: 0 }];
workflow.connections["Apply Voice Transcript"] = {
  main: [[{ node: "Read Parser Context", type: "main", index: 0 }]],
};
connect("Read Parser Context", ["Read Recent Memories"]);
connect("Read Recent Memories", ["Apply Memory Context"]);
connect("Apply Memory Context", ["OpenAI Parse Message"]);

workflow.id = "telegram-personal-assistant-inbox-memory-preferences";
workflow.name = "Telegram Personal Assistant - Inbox Memory Preferences";
workflow.active = false;
workflow.updatedAt = new Date().toISOString();

writeWorkflow(path.join(workspace, "workflows/telegram-assistant-inbox-memory-preferences.json"), workflow);
writeWorkflow(path.join(workspace, "workflows/current-inbox-after-memory-preferences.json"), workflow);

console.log("Wrote memory-aware inbox workflow exports.");
