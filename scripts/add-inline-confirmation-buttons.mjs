import fs from "node:fs";

const workspace = process.cwd();
const workflow = JSON.parse(fs.readFileSync(`${workspace}/workflows/current-inbox-before-inline-buttons.json`, "utf8"))[0];

function node(name) {
  const found = workflow.nodes.find((candidate) => candidate.name === name);
  if (!found) throw new Error(`Missing node: ${name}`);
  return found;
}

const routeIntent = node("Route Intent");
routeIntent.parameters.output =
  "={{ ($json.missing_fields && $json.missing_fields.length) ? 4 : (!$json.valid ? 3 : (($json.intent === 'expense' || $json.intent === 'receipt') ? 0 : (($json.intent === 'todo' || $json.intent === 'reminder') ? 1 : ($json.intent === 'task_done' ? 2 : 3)))) }}";

workflow.connections["Route Intent"].main[3] = [{ node: "Prepare Pending Action", type: "main", index: 0 }];
workflow.connections["Route Intent"].main[4] = [{ node: "Confirm Unknown", type: "main", index: 0 }];

node("Prepare Pending Action").parameters.jsCode = `return $input.all().map((item) => {
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
      pendingReply: "Please confirm before I save this:\\n" + summary + "\\n\\nUse the buttons below, or reply: confirm / cancel"
    }
  };
});`;

node("Confirm Pending Request").parameters = {
  chatId: "=5379148910",
  text: "={{ $('Prepare Pending Action').item.json.pendingReply }}",
  replyMarkup: "inlineKeyboard",
  inlineKeyboard: {
    rows: [
      {
        row: {
          buttons: [
            {
              text: "Confirm",
              additionalFields: {
                callback_data: "confirm",
              },
            },
            {
              text: "Cancel",
              additionalFields: {
                callback_data: "cancel",
              },
            },
          ],
        },
      },
    ],
  },
  additionalFields: { appendAttribution: false },
};

const answerCallback = {
  parameters: {
    resource: "callback",
    operation: "answerQuery",
    queryId: "={{ $json.callback_query?.id || '' }}",
    additionalFields: {
      text: "={{ $json.callback_query?.data === 'confirm' ? 'Confirmed' : 'Cancelled' }}",
    },
  },
  id: "assistant-answer-callback",
  name: "Answer Callback",
  type: "n8n-nodes-base.telegram",
  typeVersion: 1.2,
  position: [720, -100],
  credentials: node("Telegram Inbox").credentials,
};

workflow.nodes = workflow.nodes.filter((candidate) => candidate.name !== "Answer Callback");
workflow.nodes.push(answerCallback);

workflow.id = "telegram-personal-assistant-inbox";
workflow.name = "Telegram Personal Assistant - Inbox";
workflow.active = false;

fs.writeFileSync(`${workspace}/workflows/telegram-assistant-inbox-inline-buttons.json`, JSON.stringify(workflow, null, 2));
console.log("wrote workflows/telegram-assistant-inbox-inline-buttons.json");
