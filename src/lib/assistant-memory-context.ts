export type AssistantContextMemory = {
  memory_type: string;
  content: string;
};

export type AssistantContextPreferences = {
  default_currency?: string;
  category_defaults?: Record<string, string>;
  card_aliases?: Record<string, string>;
};

export type AssistantContextInput = {
  preferences: AssistantContextPreferences;
  memories: AssistantContextMemory[];
};

function formatMap(title: string, values: Record<string, string> | undefined) {
  const rows = Object.entries(values || {}).filter(([key, value]) => key.trim() && value.trim());
  if (!rows.length) return [];
  return [title, ...rows.map(([key, value]) => `${key} -> ${value}`)];
}

export function buildAssistantContextPrompt({ preferences, memories }: AssistantContextInput) {
  const lines = [
    preferences.default_currency ? `Default currency: ${preferences.default_currency}` : "",
    ...formatMap("Category defaults:", preferences.category_defaults),
    ...formatMap("Card aliases:", preferences.card_aliases),
    ...memories
      .filter((memory) => memory.content.trim())
      .map((memory) => `- [${memory.memory_type || "memory"}] ${memory.content.trim()}`),
  ].filter(Boolean);

  if (!lines.length) return "";

  return [
    "User preferences and memories:",
    ...lines,
    "Use these hints only when the current Telegram message does not clearly override them.",
  ].join("\n");
}
