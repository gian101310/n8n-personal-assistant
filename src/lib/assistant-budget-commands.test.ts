import { describe, expect, test } from "vitest";
import { parseBudgetCommand } from "./assistant-budget-commands";

describe("assistant budget commands", () => {
  test("parses set budget commands", () => {
    expect(parseBudgetCommand("set Food budget 1200")).toEqual({
      command: "set",
      category: "Food",
      amount: 1200,
      period: "monthly",
    });
    expect(parseBudgetCommand("budget Groceries AED 800")).toEqual({
      command: "set",
      category: "Groceries",
      amount: 800,
      period: "monthly",
    });
    expect(parseBudgetCommand("groceries 2k")).toEqual({
      command: "set",
      category: "groceries",
      amount: 2000,
      period: "monthly",
    });
    expect(parseBudgetCommand("food limit 300 weekly")).toEqual({
      command: "set",
      category: "food",
      amount: 300,
      period: "weekly",
    });
    expect(parseBudgetCommand("set monthly dining cap 1500")).toEqual({
      command: "set",
      category: "dining",
      amount: 1500,
      period: "monthly",
    });
    expect(parseBudgetCommand("entertainment 1500aed")).toEqual({
      command: "set",
      category: "entertainment",
      amount: 1500,
      period: "monthly",
    });
    expect(parseBudgetCommand("budget food 2,000")).toEqual({
      command: "set",
      category: "food",
      amount: 2000,
      period: "monthly",
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
