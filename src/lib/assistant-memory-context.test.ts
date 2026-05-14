import { describe, expect, test } from "vitest";
import { buildAssistantContextPrompt } from "./assistant-memory-context";

describe("assistant memory context prompt", () => {
  test("formats category preferences and memory snippets for the parser", () => {
    const prompt = buildAssistantContextPrompt({
      preferences: {
        default_currency: "AED",
        category_defaults: {
          Costa: "Food",
          "Dubai Taxi": "Transport",
        },
        card_aliases: {
          "ADCB Visa": "ADCB Credit",
        },
      },
      memories: [
        {
          memory_type: "merchant_category",
          content: "Treat Costa purchases as Food unless the user says otherwise.",
        },
        {
          memory_type: "card_preference",
          content: "When the user says ADCB Visa, normalize the card to ADCB Credit.",
        },
      ],
    });

    expect(prompt).toContain("User preferences and memories:");
    expect(prompt).toContain("Default currency: AED");
    expect(prompt).toContain("Costa -> Food");
    expect(prompt).toContain("ADCB Visa -> ADCB Credit");
    expect(prompt).toContain("- [merchant_category] Treat Costa purchases as Food unless the user says otherwise.");
    expect(prompt).toContain("Use these hints only when the current Telegram message does not clearly override them.");
  });

  test("returns an empty string when there is no usable context", () => {
    expect(buildAssistantContextPrompt({ preferences: {}, memories: [] })).toBe("");
  });
});
