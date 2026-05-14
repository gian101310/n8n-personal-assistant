import fs from "node:fs";

const workspace = process.cwd();
const input = `${workspace}/workflows/current-inbox-before-voice.json`;
const output = `${workspace}/workflows/telegram-assistant-inbox-voice.json`;
const data = JSON.parse(fs.readFileSync(input, "utf8"));
const workflow = Array.isArray(data) ? data[0] : data;

function node(name) {
  const found = workflow.nodes.find((candidate) => candidate.name === name);
  if (!found) throw new Error(`Missing node: ${name}`);
  return found;
}

const openAiCredentials = node("OpenAI Parse Message").credentials;
const telegramCredentials = node("Telegram Inbox").credentials;

const normalize = node("Normalize Telegram Input");
normalize.parameters.jsCode = normalize.parameters.jsCode.replace(
  "mediaMimeType: media?.mimeType || \"\",",
  "mediaMimeType: media?.mimeType || \"\",\n    binaryKey: firstBinaryKey || \"\",",
);

normalize.parameters.jsCode = normalize.parameters.jsCode.replace(
  "binaryKey: firstBinaryKey || \"\",",
  "binaryKey: firstBinaryKey || \"\",\n    voiceFileId: message.voice?.file_id || \"\",",
);

const parse = node("Parse OpenAI Result");
parse.parameters.jsCode = parse.parameters.jsCode.replace(
  'const original = $("Normalize Telegram Input").item.json;',
  `let original = $("Normalize Telegram Input").item.json;
try {
  const voiceInput = $("Apply Voice Transcript").item.json;
  if (voiceInput?.voiceTranscript) original = voiceInput;
} catch (error) {}`,
);

const routeVoice = {
  parameters: {
    mode: "expression",
    output: "={{ $json.needsTranscription ? 0 : 1 }}",
  },
  id: "assistant-route-voice",
  name: "Route Voice",
  type: "n8n-nodes-base.switch",
  typeVersion: 3.2,
  position: [700, 300],
};

const downloadVoice = {
  parameters: {
    resource: "file",
    fileId: "={{ $json.voiceFileId }}",
    additionalFields: {
      mimeType: "audio/ogg",
    },
  },
  id: "assistant-download-voice",
  name: "Download Voice",
  type: "n8n-nodes-base.telegram",
  typeVersion: 1.2,
  position: [940, 180],
  credentials: telegramCredentials,
};

const transcribeVoice = {
  parameters: {
    method: "POST",
    url: "https://api.openai.com/v1/audio/transcriptions",
    authentication: "predefinedCredentialType",
    nodeCredentialType: "openAiApi",
    sendBody: true,
    contentType: "multipart-form-data",
    bodyParameters: {
      parameters: [
        {
          parameterType: "formData",
          name: "model",
          value: "gpt-4o-mini-transcribe",
        },
        {
          parameterType: "formData",
          name: "response_format",
          value: "json",
        },
        {
          parameterType: "formData",
          name: "prompt",
          value: "Personal assistant voice note about expenses, todos, reminders, cards, merchants, trading, errands, or productivity. Preserve merchant names, card names, amounts, currencies, and due dates.",
        },
        {
          parameterType: "formBinaryData",
          name: "file",
          inputDataFieldName: "={{ $json.binaryKey || 'data' }}",
        },
      ],
    },
    options: {},
  },
  id: "assistant-transcribe-voice",
  name: "Transcribe Voice",
  type: "n8n-nodes-base.httpRequest",
  typeVersion: 4.4,
  position: [1180, 180],
  credentials: openAiCredentials,
};

const prepareVoiceFile = {
  parameters: {
    jsCode: `const item = $input.first();
const binary = item.binary || {};
const data = binary.data;
if (data) {
  data.fileName = "telegram-voice.ogg";
  data.fileExtension = "ogg";
  data.mimeType = "audio/ogg";
}
return [{ json: item.json, binary }];`,
  },
  id: "assistant-prepare-voice-file",
  name: "Prepare Voice File",
  type: "n8n-nodes-base.code",
  typeVersion: 2,
  position: [1180, 180],
};

const applyVoiceTranscript = {
  parameters: {
    jsCode: `const transcription = $input.first().json || {};
const original = $("Normalize Telegram Input").item.json;
const transcript = String(transcription.text || "").trim();
const openaiBody = JSON.parse(JSON.stringify(original.openaiBody));
const userMessage = openaiBody.input.find((entry) => entry.role === "user");
if (userMessage?.content?.[0]) {
  userMessage.content[0].text = transcript || "Voice message could not be transcribed. Ask for clarification.";
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
}];`,
  },
  id: "assistant-apply-voice-transcript",
  name: "Apply Voice Transcript",
  type: "n8n-nodes-base.code",
  typeVersion: 2,
  position: [1660, 180],
};

workflow.nodes = workflow.nodes.filter(
  (candidate) => !["Route Voice", "Download Voice", "Prepare Voice File", "Transcribe Voice", "Apply Voice Transcript"].includes(candidate.name),
);
workflow.nodes.push(routeVoice, downloadVoice, prepareVoiceFile, transcribeVoice, applyVoiceTranscript);

workflow.connections["Normalize Telegram Input"] = {
  main: [[{ node: "Route Voice", type: "main", index: 0 }]],
};
workflow.connections["Route Voice"] = {
  main: [
    [{ node: "Download Voice", type: "main", index: 0 }],
    [{ node: "OpenAI Parse Message", type: "main", index: 0 }],
  ],
};
workflow.connections["Download Voice"] = {
  main: [[{ node: "Prepare Voice File", type: "main", index: 0 }]],
};
workflow.connections["Prepare Voice File"] = {
  main: [[{ node: "Transcribe Voice", type: "main", index: 0 }]],
};
workflow.connections["Transcribe Voice"] = {
  main: [[{ node: "Apply Voice Transcript", type: "main", index: 0 }]],
};
workflow.connections["Apply Voice Transcript"] = {
  main: [[{ node: "OpenAI Parse Message", type: "main", index: 0 }]],
};

workflow.id = "telegram-personal-assistant-inbox";
workflow.name = "Telegram Personal Assistant - Inbox";
workflow.active = false;
workflow.settings = { ...(workflow.settings || {}), timezone: "Asia/Dubai" };
workflow.meta = { ...(workflow.meta || {}), templateCredsSetupCompleted: true };

fs.writeFileSync(output, JSON.stringify(workflow, null, 2));
console.log(output);
