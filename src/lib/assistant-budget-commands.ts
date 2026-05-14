export type BudgetCommand =
  | { command: "set"; category: string; amount: number; period?: "monthly" | "weekly" }
  | { command: "delete"; category: string }
  | { command: "list" }
  | { command: "" };

function cleanCategory(value: string) {
  return value.trim().replace(/^[:\-\s]+/, "").replace(/[?.!\s]+$/, "").trim();
}

function parseAmount(value: string) {
  const cleaned = value.toLowerCase().replace(/,/g, "").replace(/\s*aed\s*$/i, "").trim();
  const kMatch = cleaned.match(/^(\d+(?:\.\d+)?)\s*k$/);
  const amount = kMatch ? Number(kMatch[1]) * 1000 : Number(cleaned);
  return Number.isFinite(amount) && amount > 0 ? amount : 0;
}

function isSafeBareCategory(value: string) {
  const words = cleanCategory(value).split(/\s+/).filter(Boolean);
  return words.length > 0 && words.length <= 2;
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
    text.match(/^(?:set|make)\s+(.+?)\s+budget\s+(?:to\s+)?(?:aed\s*)?([\d,]+(?:\.\d{1,2})?\s*k?|\d+(?:\.\d+)?k|[\d,]+(?:\.\d{1,2})?\s*aed)(?:\s+(weekly|monthly))?$/i) ||
    text.match(/^budget\s+(.+?)\s+(?:to\s+)?(?:aed\s*)?([\d,]+(?:\.\d{1,2})?\s*k?|\d+(?:\.\d+)?k|[\d,]+(?:\.\d{1,2})?\s*aed)(?:\s+(weekly|monthly))?$/i) ||
    text.match(/^(.+?)\s+budget\s+(?:is\s+|=|to\s+)?(?:aed\s*)?([\d,]+(?:\.\d{1,2})?\s*k?|\d+(?:\.\d+)?k|[\d,]+(?:\.\d{1,2})?\s*aed)(?:\s+(weekly|monthly))?$/i) ||
    text.match(/^(.+?)\s+limit\s+(?:aed\s*)?([\d,]+(?:\.\d{1,2})?\s*k?|\d+(?:\.\d+)?k|[\d,]+(?:\.\d{1,2})?\s*aed)(?:\s+(weekly|monthly))?$/i) ||
    text.match(/^set\s+(weekly|monthly)\s+(.+?)\s+cap\s+(?:aed\s*)?([\d,]+(?:\.\d{1,2})?\s*k?|\d+(?:\.\d+)?k|[\d,]+(?:\.\d{1,2})?\s*aed)$/i);

  const bareSetMatch = text.match(/^(.+?)\s+(?:aed\s*)?([\d,]+(?:\.\d{1,2})?\s*k|\d+(?:\.\d+)?k|[\d,]+(?:\.\d{1,2})?\s*aed)(?:\s+(weekly|monthly))?$/i);

  if (setMatch) {
    const periodFirst = setMatch[1] === "weekly" || setMatch[1] === "monthly";
    const period = (periodFirst ? setMatch[1] : setMatch[3]) as "weekly" | "monthly" | undefined;
    const category = cleanCategory((periodFirst ? setMatch[2] : setMatch[1]) || "");
    const amount = parseAmount((periodFirst ? setMatch[3] : setMatch[2]) || "");
    return category && amount ? { command: "set", category, amount, period: period || "monthly" } : { command: "" };
  }

  if (bareSetMatch) {
    const category = cleanCategory(bareSetMatch[1] || "");
    const amount = parseAmount(bareSetMatch[2] || "");
    const period = (bareSetMatch[3] as "weekly" | "monthly" | undefined) || "monthly";
    return category && amount && isSafeBareCategory(category) ? { command: "set", category, amount, period } : { command: "" };
  }

  return { command: "" };
}
