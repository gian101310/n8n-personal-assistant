import { describe, expect, it } from "vitest";
import { buildBudgetProgress, isCurrentMonth } from "./budget-progress";
import type { Budget, Expense } from "./types";

const now = new Date("2026-05-14T08:00:00Z");

function expense(category: string, amount: number, expense_date = "2026-05-10"): Expense {
  return {
    id: crypto.randomUUID(),
    expense_date,
    merchant: "Test",
    amount,
    currency: "AED",
    category,
    payment_method: null,
    card: null,
    notes: null,
    source: "test",
    created_at: "2026-05-10T00:00:00Z",
  };
}

function budget(category: string, amount: number): Budget {
  return {
    id: crypto.randomUUID(),
    category,
    amount,
    currency: "AED",
    period: "monthly",
    active: true,
    notes: null,
    created_at: "2026-05-01T00:00:00Z",
    updated_at: "2026-05-01T00:00:00Z",
  };
}

describe("isCurrentMonth", () => {
  it("matches dates in the same UTC month", () => {
    expect(isCurrentMonth("2026-05-01", now)).toBe(true);
    expect(isCurrentMonth("2026-04-30", now)).toBe(false);
  });
});

describe("buildBudgetProgress", () => {
  it("calculates spent, remaining, and percent used", () => {
    const rows = buildBudgetProgress([budget("Food", 500)], [expense("Food", 100), expense("Food", 50)], now);

    expect(rows[0]).toMatchObject({
      category: "Food",
      limit: 500,
      spent: 150,
      remaining: 350,
      percentUsed: 30,
      isOverBudget: false,
    });
  });

  it("marks over-budget categories", () => {
    const rows = buildBudgetProgress([budget("Entertainment", 100)], [expense("Entertainment", 150)], now);

    expect(rows[0]?.remaining).toBe(-50);
    expect(rows[0]?.isOverBudget).toBe(true);
  });

  it("ignores expenses outside the current month", () => {
    const rows = buildBudgetProgress([budget("Transport", 100)], [expense("Transport", 80, "2026-04-20")], now);

    expect(rows[0]?.spent).toBe(0);
    expect(rows[0]?.remaining).toBe(100);
  });
});
