import fs from "node:fs";
import path from "node:path";

const workspace = process.cwd();
const sourcePath = path.join(workspace, "workflows/current-inbox-after-budget-commands.json");
const workflow = readWorkflow(sourcePath);

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

const downloadVoice = node("Download Voice");
downloadVoice.retryOnFail = true;
downloadVoice.maxTries = 3;
downloadVoice.waitBetweenTries = 3000;
downloadVoice.continueOnFail = true;

const transcribeVoice = node("Transcribe Voice");
transcribeVoice.retryOnFail = true;
transcribeVoice.maxTries = 3;
transcribeVoice.waitBetweenTries = 3000;
transcribeVoice.continueOnFail = true;

node("Prepare Voice File").parameters.jsCode = String.raw`const item = $input.first();
const original = $("Normalize Telegram Input").item.json;
const binary = item.binary || {};
const data = binary.data;
const errorMessage = item.json?.error?.message || item.json?.message || "";

if (errorMessage || !data) {
  return [{
    json: {
      ...original,
      source: "telegram_voice",
      voiceProcessingError: true,
      confirmation: "I received your voice note, but I could not download the audio from Telegram. Please resend it or type the message."
    }
  }];
}

data.fileName = "telegram-voice.ogg";
data.fileExtension = "ogg";
data.mimeType = "audio/ogg";
return [{ json: item.json, binary }];`;

node("Apply Voice Transcript").parameters.jsCode = String.raw`const transcription = $input.first().json || {};
const original = $("Normalize Telegram Input").item.json;
const errorMessage = transcription.error?.message || transcription.message || "";
const transcript = String(transcription.text || "").trim();

if (errorMessage || !transcript) {
  return [{
    json: {
      ...original,
      source: "telegram_voice",
      voiceProcessingError: true,
      voiceTranscript: transcript,
      transcriptionModel: "gpt-4o-mini-transcribe",
      confirmation: "I received your voice note, but I could not transcribe it clearly. Please resend a clearer voice note or type the message."
    }
  }];
}

const openaiBody = JSON.parse(JSON.stringify(original.openaiBody));
const userMessage = openaiBody.input.find((entry) => entry.role === "user");
if (userMessage?.content?.[0]) {
  userMessage.content[0].text = transcript;
}
return [{
  json: {
    ...original,
    source: "telegram_voice",
    originalText: transcript,
    voiceTranscript: transcript,
    transcriptionModel: "gpt-4o-mini-transcribe",
    openaiBody
  }
}];`;

upsertNode({
  parameters: {
    mode: "expression",
    output: "={{ $json.voiceProcessingError ? 1 : 0 }}",
  },
  id: "assistant-route-voice-file",
  name: "Route Voice File",
  type: "n8n-nodes-base.switch",
  typeVersion: 3.2,
  position: [1180, 180],
});

upsertNode({
  parameters: {
    mode: "expression",
    output: "={{ $json.voiceProcessingError ? 1 : 0 }}",
  },
  id: "assistant-route-voice-transcript",
  name: "Route Voice Transcript",
  type: "n8n-nodes-base.switch",
  typeVersion: 3.2,
  position: [1420, 180],
});

upsertNode(telegramNode(
  "assistant-confirm-voice-problem",
  "Confirm Voice Problem",
  [1660, 40],
  "={{ $json.confirmation || 'I received your voice note, but I could not process it. Please resend it or type the message.' }}",
));

workflow.connections["Prepare Voice File"] = {
  main: [[{ node: "Route Voice File", type: "main", index: 0 }]],
};
workflow.connections["Route Voice File"] = {
  main: [
    [{ node: "Transcribe Voice", type: "main", index: 0 }],
    [{ node: "Confirm Voice Problem", type: "main", index: 0 }],
  ],
};
workflow.connections["Transcribe Voice"] = {
  main: [[{ node: "Apply Voice Transcript", type: "main", index: 0 }]],
};
workflow.connections["Apply Voice Transcript"] = {
  main: [[{ node: "Route Voice Transcript", type: "main", index: 0 }]],
};
workflow.connections["Route Voice Transcript"] = {
  main: [
    [{ node: "Read Parser Context", type: "main", index: 0 }],
    [{ node: "Confirm Voice Problem", type: "main", index: 0 }],
  ],
};

workflow.name = "Telegram Personal Assistant - Inbox Budget Commands";
workflow.id = "telegram-personal-assistant-inbox-budget-commands";
workflow.active = false;
workflow.updatedAt = new Date().toISOString();

writeWorkflow(path.join(workspace, "workflows/telegram-assistant-inbox-voice-confirmation-fix.json"), workflow);
writeWorkflow(path.join(workspace, "workflows/current-inbox-after-voice-confirmation-fix.json"), workflow);
writeWorkflow(path.join(workspace, "workflows/telegram-assistant-inbox-budget-commands.json"), workflow);
writeWorkflow(path.join(workspace, "workflows/current-inbox-after-budget-commands.json"), workflow);

console.log("Wrote voice confirmation hardened workflow exports.");
