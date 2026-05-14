import { describe, expect, test } from "vitest";
import { parseBudgetCommand } from "./assistant-budget-commands";

describe("assistant budget commands", () => {
  test("parses set budget commands", () => {
    expect(parseBudgetCommand("set Food budget 1200")).toEqual({
      command: "set",
      category: "Food",
      amount: 1200,
    });
    expect(parseBudgetCommand("budget Groceries AED 800")).toEqual({
      command: "set",
      category: "Groceries",
      amount: 800,
    });
  });

  test("parses delete budget commands", () => {
    expect(parseBudgetCommand("delete Food budget")).toEqual({
      command: "delete",
      category: "Food",
    });
    expect(parseBudgetCommand("budget delete Groceries")).toEqual({
      command: "delete",
      category: "Groceries",
    });
  });

  test("parses list budget commands", () => {
    expect(parseBudgetCommand("list budgets")).toEqual({ command: "list" });
    expect(parseBudgetCommand("show my budgets?")).toEqual({ command: "list" });
  });

  test("ignores ordinary messages", () => {
    expect(parseBudgetCommand("spent 25 at Costa")).toEqual({ command: "" });
  });
});
