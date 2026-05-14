import { describe, expect, test } from "vitest";
import { parseMemoryCommand } from "./assistant-memory-commands";

describe("assistant memory commands", () => {
  test("parses natural remember commands as note memories", () => {
    expect(parseMemoryCommand("remember Costa is Food")).toEqual({
      command: "remember",
      content: "Costa is Food",
      memoryType: "note",
    });
    expect(parseMemoryCommand("note to remember: my passport is in the black drawer")).toEqual({
      command: "remember",
      content: "my passport is in the black drawer",
      memoryType: "note",
    });
  });

  test("parses forget commands", () => {
    expect(parseMemoryCommand("forget Costa category")).toEqual({
      command: "forget",
      query: "Costa category",
    });
  });

  test("parses natural recall requests", () => {
    expect(parseMemoryCommand("what do you remember?")).toEqual({ command: "recall" });
    expect(parseMemoryCommand("remind me everything I told you as notes to remember")).toEqual({ command: "recall" });
  });

  test("ignores ordinary assistant messages", () => {
    expect(parseMemoryCommand("spent 25 at Costa")).toEqual({ command: "" });
  });
});
