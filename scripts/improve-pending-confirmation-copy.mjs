import fs from 'node:fs';

const input = 'workflows/current-inbox-after-confirmation-polish.json';
const output = 'workflows/telegram-assistant-inbox-confirmation-copy.json';

const exported = JSON.parse(fs.readFileSync(input, 'utf8'));
const workflow = Array.isArray(exported) ? exported[0] : exported;

const preparePending = workflow.nodes.find((node) => node.name === 'Prepare Pending Action');
if (!preparePending) {
  throw new Error('Prepare Pending Action node not found');
}

preparePending.parameters.jsCode = `return $input.all().map((item) => {
  const j = item.json;
  const actionType = j.intent === "receipt" ? "receipt" : (j.intent === "reminder" ? "reminder" : (j.intent === "todo" ? "task" : "expense"));
  const lines = ["Please confirm before I save this:"];

  if (actionType === "task" || actionType === "reminder") {
    lines.push("Task: " + (j.task || j.notes || "Task"));
    if (j.priority) lines.push("Priority: " + j.priority);
    if (j.due_at) lines.push("Due: " + j.due_at);
  } else {
    lines.push("Merchant: " + (j.merchant || "Unknown"));
    lines.push("Amount: " + Number(j.amount || 0) + " " + (j.currency || "AED"));
    lines.push("Category: " + (j.category || "Other"));
    if (j.card) lines.push("Card: " + j.card);
    if (j.payment_method && j.payment_method !== j.card) lines.push("Payment: " + j.payment_method);
    if (j.notes) lines.push("Notes: " + j.notes);
  }

  lines.push("");
  lines.push("Use the buttons below, or reply: confirm / cancel");

  return {
    json: {
      chat_id: j.chatId || "",
      action_type: actionType,
      status: "pending",
      payload: j,
      source: j.source || "telegram",
      message_id: "",
      pendingReply: lines.join("\\n")
    }
  };
});`;

const prepareConfirmed = workflow.nodes.find((node) => node.name === 'Prepare Confirmed Pending');
if (!prepareConfirmed) {
  throw new Error('Prepare Confirmed Pending node not found');
}

prepareConfirmed.parameters.jsCode = prepareConfirmed.parameters.jsCode
  .replace(
    'confirmation: "Confirmed expense: " + (payload.merchant || "Unknown") + " " + Number(payload.amount || 0) + " " + (payload.currency || "AED")',
    'confirmation: "Confirmed expense: " + (payload.merchant || "Unknown") + " " + Number(payload.amount || 0) + " " + (payload.currency || "AED") + (payload.card ? " using " + payload.card : "")',
  );

fs.writeFileSync(output, JSON.stringify(workflow, null, 2));
console.log(`Wrote ${output}`);
