export type BudgetCommand =
  | { command: "set"; category: string; amount: number }
  | { command: "delete"; category: string }
  | { command: "list" }
  | { command: "" };

function cleanCategory(value: string) {
  return value.trim().replace(/^[:\-\s]+/, "").replace(/[?.!\s]+$/, "").trim();
}

function parseAmount(value: string) {
  const amount = Number(value.replace(/,/g, ""));
  return Number.isFinite(amount) && amount > 0 ? amount : 0;
}

export function parseBudgetCommand(input: string): BudgetCommand {
  const text = input.trim();

  if (/^(?:list|show|view)\s+(?:my\s+)?budgets\??$/i.test(text) || /^what(?:'s| is)?\s+my\s+budgets?\??$/i.test(text)) {
    return { command: "list" };
  }

  const deleteMatch = text.match(/^(?:delete|remove|clear)\s+(.+?)\s+budget$/i) || text.match(/^budget\s+delete\s+(.+)$/i);
  if (deleteMatch) {
    const category = cleanCategory(deleteMatch[1] || "");
    return category ? { command: "delete", category } : { command: "" };
  }

  const setMatch =
    text.match(/^(?:set|make)\s+(.+?)\s+budget\s+(?:to\s+)?(?:aed\s*)?([\d,]+(?:\.\d{1,2})?)$/i) ||
    text.match(/^budget\s+(.+?)\s+(?:to\s+)?(?:aed\s*)?([\d,]+(?:\.\d{1,2})?)$/i) ||
    text.match(/^(.+?)\s+budget\s+(?:is\s+|=|to\s+)?(?:aed\s*)?([\d,]+(?:\.\d{1,2})?)$/i);

  if (setMatch) {
    const category = cleanCategory(setMatch[1] || "");
    const amount = parseAmount(setMatch[2] || "");
    return category && amount ? { command: "set", category, amount } : { command: "" };
  }

  return { command: "" };
}
