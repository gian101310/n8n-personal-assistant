import { describe, expect, it } from "vitest";
import { generateLocalAIInsights } from "./ai-agents";
import type { CommandCenterSummary } from "./finance-command-center";

function summary(overrides: Partial<CommandCenterSummary> = {}): CommandCenterSummary {
  return {
    monthlyIncomeTotal: 3000,
    monthlyExpenseTotal: 1200,
    monthlyCreditCardPaymentTotal: 500,
    monthlySubscriptionTotal: 150,
    projectedRemainingBalance: 1300,
    upcomingBills: [],
    overdueBills: [],
    upcomingSubscriptions: [],
    overdueReminders: [],
    highPriorityItemCount: 0,
    priorityLevel: "safe",
    highestExpenseCategory: { category: "Food", total: 700 },
    suspiciousExpenses: [],
    ...overrides,
  };
}

describe("generateLocalAIInsights", () => {
  it("warns when projected remaining balance is negative", () => {
    const insights = generateLocalAIInsights(summary({ projectedRemainingBalance: -200, priorityLevel: "urgent" }));

    expect(insights.some((insight) => insight.severity === "Critical" && insight.category === "Warnings")).toBe(true);
    expect(insights.some((insight) => insight.agent === "FinanceSummaryAgent")).toBe(true);
  });

  it("suggests manual corrections for suspicious expense data", () => {
    const insights = generateLocalAIInsights(
      summary({
        suspiciousExpenses: [
          {
            id: "expense-1",
            reason: "Missing category",
            label: "Unknown merchant",
          },
        ],
      }),
    );

    expect(insights.some((insight) => insight.category === "Data corrections needed")).toBe(true);
    expect(insights.some((insight) => insight.agent === "ExpenseAuditAgent")).toBe(true);
  });
});
