import fs from "node:fs";

const workspace = process.cwd();

const mappings = [
  {
    input: "workflows/telegram-assistant-inbox-supabase.json",
    output: "workflows/telegram-assistant-inbox-supabase-original-id.json",
    id: "telegram-personal-assistant-inbox",
    name: "Telegram Personal Assistant - Inbox",
  },
  {
    input: "workflows/telegram-daily-summary-supabase.json",
    output: "workflows/telegram-daily-summary-supabase-original-id.json",
    id: "telegram-personal-assistant-daily-summary",
    name: "Telegram Personal Assistant - Daily Summary",
  },
  {
    input: "workflows/telegram-reminder-sender-supabase.json",
    output: "workflows/telegram-reminder-sender-supabase-original-id.json",
    id: "telegram-personal-assistant-reminders",
    name: "Telegram Personal Assistant - Reminder Sender",
  },
  {
    input: "workflows/telegram-weekly-summary-supabase.json",
    output: "workflows/telegram-weekly-summary-supabase-original-id.json",
    id: "telegram-personal-assistant-weekly-summary",
    name: "Telegram Personal Assistant - Weekly Summary",
  },
];

for (const mapping of mappings) {
  const wf = JSON.parse(fs.readFileSync(`${workspace}/${mapping.input}`, "utf8"));
  wf.id = mapping.id;
  wf.name = mapping.name;
  wf.active = false;
  fs.writeFileSync(`${workspace}/${mapping.output}`, JSON.stringify(wf, null, 2));
  console.log(`${mapping.output}: ${mapping.id}`);
}
