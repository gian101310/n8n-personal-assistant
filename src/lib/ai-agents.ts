import type { CommandCenterSummary } from "./finance-command-center";
import type { AIInsight } from "./types";

type AgentName =
  | "FinanceSummaryAgent"
  | "ExpenseAuditAgent"
  | "BillReminderAgent"
  | "SubscriptionWatchAgent"
  | "BehaviorCoachAgent"
  | "PriorityPlannerAgent"
  | "TelegramCommandAgent";

function insight(
  agent: AgentName,
  category: AIInsight["category"],
  severity: AIInsight["severity"],
  title: string,
  message: string,
  actionLabel?: string,
): AIInsight {
  return {
    id: `${agent}-${category}-${title}`.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
    agent,
    category,
    severity,
    title,
    message,
    action_label: actionLabel || null,
    linked_item_type: null,
    linked_item_id: null,
    created_at: new Date().toISOString(),
  };
}

export function generateLocalAIInsights(summary: CommandCenterSummary): AIInsight[] {
  const insights: AIInsight[] = [
    insight(
      "FinanceSummaryAgent",
      "Summary",
      summary.priorityLevel === "safe" ? "Info" : "Watch",
      "Monthly cashflow",
      `Projected remaining balance is ${summary.projectedRemainingBalance.toFixed(2)} AED after expenses and credit card payments.`,
    ),
  ];

  if (summary.projectedRemainingBalance < 0) {
    insights.push(
      insight(
        "FinanceSummaryAgent",
        "Warnings",
        "Critical",
        "Cashflow shortfall",
        "Your projected remaining balance is negative. Prioritize bills due now and pause optional spending.",
        "Review cashflow",
      ),
    );
  }

  if (summary.upcomingBills.length) {
    insights.push(
      insight(
        "BillReminderAgent",
        "Priority actions",
        "Warning",
        "Credit card bills due soon",
        `${summary.upcomingBills.length} credit card bill${summary.upcomingBills.length === 1 ? " is" : "s are"} due within 7 days.`,
        "Open credit cards",
      ),
    );
  }

  if (summary.overdueBills.length) {
    insights.push(
      insight(
        "BillReminderAgent",
        "Warnings",
        "Critical",
        "Overdue card bill",
        "At least one credit card bill is overdue. Handle it before non-essential tasks.",
        "Pay bill",
      ),
    );
  }

  if (summary.monthlySubscriptionTotal > Math.max(500, summary.monthlyIncomeTotal * 0.08)) {
    insights.push(
      insight(
        "SubscriptionWatchAgent",
        "Suggestions",
        "Watch",
        "Subscription load is high",
        "Monthly subscriptions are taking a noticeable slice of income. Flag unused or expensive subscriptions for review.",
        "Review subscriptions",
      ),
    );
  }

  if (summary.highestExpenseCategory) {
    insights.push(
      insight(
        "BehaviorCoachAgent",
        "Suggestions",
        "Info",
        "Top spend category",
        `${summary.highestExpenseCategory.category} is your highest expense category this month. Check whether any entries need correction.`,
      ),
    );
  }

  for (const suspicious of summary.suspiciousExpenses.slice(0, 3)) {
    insights.push(
      insight(
        "ExpenseAuditAgent",
        "Data corrections needed",
        "Warning",
        suspicious.reason,
        `${suspicious.label} may need manual correction. AI will not change the ledger without your edit.`,
        "Edit expense",
      ),
    );
  }

  if (summary.overdueReminders.length || summary.highPriorityItemCount) {
    insights.push(
      insight(
        "PriorityPlannerAgent",
        "Priority actions",
        summary.overdueReminders.length ? "Critical" : "Watch",
        "Today needs triage",
        "Clear overdue reminders first, then high-priority bills and todos.",
        "Open reminders",
      ),
    );
  }

  insights.push(
    insight(
      "TelegramCommandAgent",
      "Suggestions",
      "Info",
      "Telegram command ready",
      "Use /today, /bills, /summary, /warnings, /note, /todo, or /remind to update and query this dashboard from Telegram.",
    ),
  );

  return insights.slice(0, 9);
}
