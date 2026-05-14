export type MemoryCommand =
  | { command: "remember"; content: string; memoryType: "note" }
  | { command: "forget"; query: string }
  | { command: "recall" }
  | { command: "" };

function clean(value: string) {
  return value.trim().replace(/^[:\-\s]+/, "").replace(/[?.!\s]+$/, "").trim();
}

export function parseMemoryCommand(input: string): MemoryCommand {
  const text = input.trim();
  const lower = text.toLowerCase();

  if (
    /^(what do you remember|what have i told you to remember|show memories|list memories|list my memories)\??$/i.test(text) ||
    (/^remind me/i.test(text) && /\b(notes? to remember|told you.*remember|everything.*remember)\b/i.test(text))
  ) {
    return { command: "recall" };
  }

  const forgetMatch = text.match(/^(?:forget|delete memory|remove memory)\s+(.+)$/i);
  if (forgetMatch) {
    const query = clean(forgetMatch[1] || "");
    return query ? { command: "forget", query } : { command: "" };
  }

  const rememberMatch = text.match(/^(?:remember|note to remember|save memory|memorize)\b\s*:?\s*(.+)$/i);
  if (rememberMatch) {
    const content = clean(rememberMatch[1] || "");
    return content ? { command: "remember", content, memoryType: "note" } : { command: "" };
  }

  if (/^(?:please\s+)?remember\b/i.test(lower)) {
    const content = clean(text.replace(/^(?:please\s+)?remember\b/i, ""));
    return content ? { command: "remember", content, memoryType: "note" } : { command: "" };
  }

  return { command: "" };
}
