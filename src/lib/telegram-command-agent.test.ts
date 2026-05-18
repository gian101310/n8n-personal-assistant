import { describe, expect, it } from "vitest";
import { parseTelegramCommand } from "./telegram-command-agent";

describe("parseTelegramCommand", () => {
  it("parses reminder commands with date and text", () => {
    expect(parseTelegramCommand("/remind 2026-05-19 09:30 pay ADCB card")).toMatchObject({
      command: "remind",
      ok: true,
      dueAt: "2026-05-19T09:30:00+04:00",
      text: "pay ADCB card",
    });
  });

  it("parses note commands", () => {
    expect(parseTelegramCommand("/note Review high subscriptions")).toMatchObject({
      command: "note",
      ok: true,
      text: "Review high subscriptions",
    });
  });

  it("rejects unsupported commands", () => {
    expect(parseTelegramCommand("/unknown thing")).toMatchObject({
      command: "unknown",
      ok: false,
    });
  });
});
