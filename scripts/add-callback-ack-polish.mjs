import fs from 'node:fs';

const input = 'workflows/current-inbox-before-confirmation-polish.json';
const output = 'workflows/telegram-assistant-inbox-confirmation-polished.json';

const exported = JSON.parse(fs.readFileSync(input, 'utf8'));
const workflow = Array.isArray(exported) ? exported[0] : exported;

const normalize = workflow.nodes.find((node) => node.name === 'Normalize Telegram Input');
if (!normalize) {
  throw new Error('Normalize Telegram Input node not found');
}

normalize.parameters.jsCode = normalize.parameters.jsCode.replace(
  'const text = callback?.data || message.text || message.caption || "";',
  'const text = callback?.data || message.text || message.caption || "";\nconst isCallback = Boolean(callback?.id);\nconst callbackQueryId = callback?.id || "";',
);

normalize.parameters.jsCode = normalize.parameters.jsCode.replace(
  '    pendingCommand,\n    mediaMimeType:',
  '    pendingCommand,\n    isCallback,\n    callbackQueryId,\n    mediaMimeType:',
);

const answerCallback = workflow.nodes.find((node) => node.name === 'Answer Callback');
if (!answerCallback) {
  throw new Error('Answer Callback node not found');
}
answerCallback.parameters.queryId = '={{ $json.callbackQueryId }}';
answerCallback.parameters.additionalFields = {
  text: '={{ $json.pendingCommand === "confirm" ? "Confirmed" : "Cancelled" }}',
};

const existingPrepareAck = workflow.nodes.find((node) => node.name === 'Prepare Callback Ack');
if (!existingPrepareAck) {
  workflow.nodes.push({
    parameters: {
      jsCode: 'const item = $input.first();\nif (!item.json.callbackQueryId) return [];\nreturn [{ json: item.json }];',
    },
    id: 'prepare-callback-ack',
    name: 'Prepare Callback Ack',
    type: 'n8n-nodes-base.code',
    typeVersion: 2,
    position: [-760, -40],
  });
}

const normalizeConnections = workflow.connections['Normalize Telegram Input']?.main?.[0] || [];
if (!normalizeConnections.some((connection) => connection.node === 'Prepare Callback Ack')) {
  normalizeConnections.push({ node: 'Prepare Callback Ack', type: 'main', index: 0 });
}
workflow.connections['Normalize Telegram Input'] = { main: [normalizeConnections] };

workflow.connections['Prepare Callback Ack'] = {
  main: [[{ node: 'Answer Callback', type: 'main', index: 0 }]],
};

fs.writeFileSync(output, JSON.stringify(workflow, null, 2));
console.log(`Wrote ${output}`);
