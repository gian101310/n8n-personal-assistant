import fs from 'node:fs';

const input = 'workflows/current-inbox-after-confirmation-copy.json';
const output = 'workflows/telegram-assistant-inbox-reply-keyboard-confirmation.json';

const exported = JSON.parse(fs.readFileSync(input, 'utf8'));
const workflow = Array.isArray(exported) ? exported[0] : exported;

const confirmPendingRequest = workflow.nodes.find((node) => node.name === 'Confirm Pending Request');
if (!confirmPendingRequest) {
  throw new Error('Confirm Pending Request node not found');
}

delete confirmPendingRequest.parameters.inlineKeyboard;
confirmPendingRequest.parameters.replyMarkup = 'replyKeyboard';
confirmPendingRequest.parameters.replyKeyboard = {
  rows: [
    {
      row: {
        buttons: [
          { text: 'confirm' },
          { text: 'cancel' },
        ],
      },
    },
  ],
};
confirmPendingRequest.parameters.replyKeyboardOptions = {
  resize_keyboard: true,
  one_time_keyboard: true,
};

const pending = workflow.nodes.find((node) => node.name === 'Prepare Pending Action');
if (pending) {
  pending.parameters.jsCode = pending.parameters.jsCode.replace(
    'Use the buttons below, or reply: confirm / cancel',
    'Tap confirm/cancel below, or type: confirm / cancel',
  );
}

const confirmPendingCommand = workflow.nodes.find((node) => node.name === 'Confirm Pending Command');
if (confirmPendingCommand) {
  confirmPendingCommand.parameters.replyMarkup = 'replyKeyboardRemove';
  confirmPendingCommand.parameters.replyKeyboardRemove = {
    remove_keyboard: true,
  };
}

// Keep the callback-query path in place for old inline messages, but new prompts use
// normal reply-keyboard buttons that arrive as plain Telegram text messages.
fs.writeFileSync(output, JSON.stringify(workflow, null, 2));
console.log(`Wrote ${output}`);
