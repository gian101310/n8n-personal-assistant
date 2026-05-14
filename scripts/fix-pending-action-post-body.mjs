import fs from 'node:fs';

const input = 'workflows/current-inbox-before-pending-post-fix.json';
const output = 'workflows/telegram-assistant-inbox-pending-post-fixed.json';

const exported = JSON.parse(fs.readFileSync(input, 'utf8'));
const workflow = Array.isArray(exported) ? exported[0] : exported;

const node = workflow.nodes.find((candidate) => candidate.name === 'Append Pending Action');
if (!node) {
  throw new Error('Append Pending Action node not found');
}

node.parameters.jsonBody = `={{ JSON.stringify({
  chat_id: $json.chat_id,
  action_type: $json.action_type,
  status: $json.status,
  payload: $json.payload,
  source: $json.source,
  message_id: $json.message_id
}) }}`;

fs.writeFileSync(output, JSON.stringify(workflow, null, 2));
console.log(`Wrote ${output}`);
