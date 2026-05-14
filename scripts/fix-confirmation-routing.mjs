import fs from "node:fs";

const workspace = process.cwd();
const workflow = JSON.parse(fs.readFileSync(`${workspace}/workflows/current-inbox-after-inline-buttons.json`, "utf8"))[0];

function node(name) {
  const found = workflow.nodes.find((candidate) => candidate.name === name);
  if (!found) throw new Error(`Missing node: ${name}`);
  return found;
}

const parse = node("Parse OpenAI Result");
parse.parameters.jsCode = parse.parameters.jsCode.replace(
  "const valid = missing.length === 0 && intent !== \"unknown\";",
  `const uncertaintyPattern = /\\b(maybe|probably|i think|not sure|roughly|around|about|approx|approximately)\\b/i;
const requires_confirmation = missing.length === 0 && uncertaintyPattern.test(String(original.originalText || parsed.notes || ""));
const valid = missing.length === 0 && intent !== "unknown";`,
);
parse.parameters.jsCode = parse.parameters.jsCode.replace(
  "missing_fields: missing,\n    valid,",
  "missing_fields: missing,\n    requires_confirmation,\n    valid,",
);

node("Route Intent").parameters.output =
  "={{ ($json.missing_fields && $json.missing_fields.length) || $json.requires_confirmation || !$json.valid ? 3 : (($json.intent === 'expense' || $json.intent === 'receipt') ? 0 : (($json.intent === 'todo' || $json.intent === 'reminder') ? 1 : ($json.intent === 'task_done' ? 2 : 3))) }}";

const routeClarifyPending = {
  parameters: {
    mode: "expression",
    output: "={{ ($json.missing_fields && $json.missing_fields.length) ? 0 : 1 }}",
  },
  id: "assistant-route-clarify-pending",
  name: "Route Clarify or Pending",
  type: "n8n-nodes-base.switch",
  typeVersion: 3.2,
  position: [1320, 700],
};

workflow.nodes = workflow.nodes.filter((candidate) => candidate.name !== "Route Clarify or Pending");
workflow.nodes.push(routeClarifyPending);

workflow.connections["Route Intent"].main = workflow.connections["Route Intent"].main.slice(0, 4);
workflow.connections["Route Intent"].main[3] = [{ node: "Route Clarify or Pending", type: "main", index: 0 }];
workflow.connections["Route Clarify or Pending"] = {
  main: [
    [{ node: "Confirm Unknown", type: "main", index: 0 }],
    [{ node: "Prepare Pending Action", type: "main", index: 0 }],
  ],
};

workflow.id = "telegram-personal-assistant-inbox";
workflow.name = "Telegram Personal Assistant - Inbox";
workflow.active = false;

fs.writeFileSync(`${workspace}/workflows/telegram-assistant-inbox-confirmation-fixed.json`, JSON.stringify(workflow, null, 2));
console.log("wrote workflows/telegram-assistant-inbox-confirmation-fixed.json");
