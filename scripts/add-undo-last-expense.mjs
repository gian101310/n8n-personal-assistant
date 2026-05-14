import fs from 'node:fs';

const input = 'workflows/current-inbox-before-undo-expense.json';
const output = 'workflows/telegram-assistant-inbox-undo-expense.json';

const exported = JSON.parse(fs.readFileSync(input, 'utf8'));
const workflow = Array.isArray(exported) ? exported[0] : exported;

const normalize = workflow.nodes.find((node) => node.name === 'Normalize Telegram Input');
if (!normalize) throw new Error('Normalize Telegram Input node not found');

normalize.parameters.jsCode = normalize.parameters.jsCode.replace(
  `const pendingCommand = lowerText === "confirm" || lowerText === "/confirm" || lowerText.startsWith("confirm ")
  ? "confirm"
  : (lowerText === "cancel" || lowerText === "/cancel" || lowerText.startsWith("cancel ") ? "cancel" : "");`,
  `const pendingCommand = lowerText === "confirm" || lowerText === "/confirm" || lowerText.startsWith("confirm ")
  ? "confirm"
  : (lowerText === "cancel" || lowerText === "/cancel" || lowerText.startsWith("cancel ")
    ? "cancel"
    : (/^(undo|undo last|delete last|remove last)( expense)?$/.test(lowerText) ? "undo_expense" : ""));`,
);

const route = workflow.nodes.find((node) => node.name === 'Route Pending Command');
if (!route) throw new Error('Route Pending Command node not found');
route.parameters.output = `={{ $json.pendingCommand === 'confirm' ? 0 : ($json.pendingCommand === 'cancel' ? 1 : ($json.pendingCommand === 'undo_expense' ? 2 : 3)) }}`;

const supabaseHeaders = {
  parameters: [
    { name: 'apikey', value: '={{ $env.SUPABASE_SERVICE_ROLE_KEY }}' },
    { name: 'Authorization', value: "={{ 'Bearer ' + $env.SUPABASE_SERVICE_ROLE_KEY }}" },
  ],
};

const nodesToAdd = [
  {
    parameters: {
      method: 'GET',
      url: 'https://uxdueryjbfzfvyznxgax.supabase.co/rest/v1/assistant_expenses?select=*&order=created_at.desc&limit=1',
      sendHeaders: true,
      headerParameters: supabaseHeaders,
      options: {},
    },
    id: 'assistant-read-last-expense-for-undo',
    name: 'Read Last Expense for Undo',
    type: 'n8n-nodes-base.httpRequest',
    typeVersion: 4.4,
    position: [384, -240],
    alwaysOutputData: true,
  },
  {
    parameters: {
      jsCode: `const expense = $input.first()?.json || {};
if (!expense.id) {
  return [{ json: { skipUndo: true, confirmation: "No expense found to undo." } }];
}

const amount = Number(expense.amount || 0);
const currency = expense.currency || "AED";
const merchant = expense.merchant || "Unknown";
const card = expense.card ? " using " + expense.card : "";

return [{
  json: {
    expense_id: expense.id,
    skipUndo: false,
    confirmation: "Removed last expense: " + merchant + " " + amount + " " + currency + card,
    removed_expense: expense
  }
}];`,
    },
    id: 'assistant-prepare-undo-expense',
    name: 'Prepare Undo Expense',
    type: 'n8n-nodes-base.code',
    typeVersion: 2,
    position: [608, -240],
  },
  {
    parameters: {
      mode: 'expression',
      output: '={{ $json.skipUndo ? 1 : 0 }}',
    },
    id: 'assistant-route-undo-expense',
    name: 'Route Undo Expense',
    type: 'n8n-nodes-base.switch',
    typeVersion: 3.4,
    position: [832, -240],
  },
  {
    parameters: {
      method: 'DELETE',
      url: '=https://uxdueryjbfzfvyznxgax.supabase.co/rest/v1/assistant_expenses?id=eq.{{ $json.expense_id }}',
      sendHeaders: true,
      headerParameters: {
        parameters: [
          ...supabaseHeaders.parameters,
          { name: 'Prefer', value: 'return=minimal' },
        ],
      },
      options: {},
    },
    id: 'assistant-delete-last-expense',
    name: 'Delete Last Expense',
    type: 'n8n-nodes-base.httpRequest',
    typeVersion: 4.4,
    position: [1056, -288],
  },
  {
    parameters: {
      chatId: '=5379148910',
      text: "={{ $('Prepare Undo Expense').item.json.confirmation }}",
      additionalFields: { appendAttribution: false },
      replyMarkup: 'replyKeyboardRemove',
      replyKeyboardRemove: { remove_keyboard: true },
    },
    id: 'assistant-confirm-undo-expense',
    name: 'Confirm Undo Expense',
    type: 'n8n-nodes-base.telegram',
    typeVersion: 1.2,
    position: [1280, -240],
    credentials: {
      telegramApi: {
        id: 'TREgfHj7rs4L3NDE',
        name: 'Telegram account',
      },
    },
  },
];

for (const node of nodesToAdd) {
  const existingIndex = workflow.nodes.findIndex((candidate) => candidate.name === node.name);
  if (existingIndex >= 0) workflow.nodes.splice(existingIndex, 1, node);
  else workflow.nodes.push(node);
}

workflow.connections['Route Pending Command'] = {
  main: [
    [{ node: 'Read Pending for Confirm', type: 'main', index: 0 }],
    [{ node: 'Read Pending for Cancel', type: 'main', index: 0 }],
    [{ node: 'Read Last Expense for Undo', type: 'main', index: 0 }],
    [{ node: 'Route Voice', type: 'main', index: 0 }],
  ],
};
workflow.connections['Read Last Expense for Undo'] = {
  main: [[{ node: 'Prepare Undo Expense', type: 'main', index: 0 }]],
};
workflow.connections['Prepare Undo Expense'] = {
  main: [[{ node: 'Route Undo Expense', type: 'main', index: 0 }]],
};
workflow.connections['Route Undo Expense'] = {
  main: [
    [{ node: 'Delete Last Expense', type: 'main', index: 0 }],
    [{ node: 'Confirm Undo Expense', type: 'main', index: 0 }],
  ],
};
workflow.connections['Delete Last Expense'] = {
  main: [[{ node: 'Confirm Undo Expense', type: 'main', index: 0 }]],
};

fs.writeFileSync(output, JSON.stringify(workflow, null, 2));
console.log(`Wrote ${output}`);
