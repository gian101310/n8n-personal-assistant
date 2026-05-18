export type TelegramCommandName =
  | "remind"
  | "note"
  | "todo"
  | "today"
  | "bills"
  | "subscriptions"
  | "summary"
  | "warnings"
  | "notes"
  | "help"
  | "unknown";

export type ParsedTelegramCommand = {
  command: TelegramCommandName;
  ok: boolean;
  text: string;
  dueAt?: string;
  error?: string;
};

const commands = new Set<TelegramCommandName>([
  "remind",
  "note",
  "todo",
  "today",
  "bills",
  "subscriptions",
  "summary",
  "warnings",
  "notes",
  "help",
]);

function parseDubaiDateTime(datePart: string, timePart: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(datePart) || !/^\d{2}:\d{2}$/.test(timePart)) return null;
  return `${datePart}T${timePart}:00+04:00`;
}

export function parseTelegramCommand(input: string): ParsedTelegramCommand {
  const trimmed = input.trim();
  if (!trimmed.startsWith("/")) {
    return { command: "unknown", ok: false, text: trimmed, error: "Telegram commands must start with /." };
  }

  const [rawCommand = "", ...parts] = trimmed.slice(1).split(/\s+/);
  const command = rawCommand.split("@")[0].toLowerCase() as TelegramCommandName;
  const text = parts.join(" ").trim();

  if (!commands.has(command)) {
    return { command: "unknown", ok: false, text, error: `Unsupported command: /${rawCommand}` };
  }

  if (command === "remind") {
    const [datePart, timePart, ...messageParts] = parts;
    const dueAt = parseDubaiDateTime(datePart || "", timePart || "");
    const reminderText = messageParts.join(" ").trim();
    if (!dueAt || !reminderText) {
      return {
        command,
        ok: false,
        text: reminderText,
        error: "Use /remind YYYY-MM-DD HH:mm reminder text.",
      };
    }
    return { command, ok: true, text: reminderText, dueAt };
  }

  if ((command === "note" || command === "todo") && !text) {
    return { command, ok: false, text, error: `Use /${command} followed by text.` };
  }

  return { command, ok: true, text };
}

export function telegramHelpText() {
  return [
    "Available commands:",
    "/remind YYYY-MM-DD HH:mm text",
    "/note text",
    "/todo text",
    "/today",
    "/bills",
    "/subscriptions",
    "/summary",
    "/warnings",
    "/notes",
    "/help",
  ].join("\n");
}
