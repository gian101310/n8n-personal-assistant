import type { CreditCardBill, Expense, IncomeStream, Reminder, Subscription, Todo } from "./types";

export type PriorityLevel = "safe" | "watch" | "warning" | "urgent";

export type CommandCenterSummary = {
  monthlyIncomeTotal: number;
  monthlyExpenseTotal: number;
  monthlyCreditCardPaymentTotal: number;
  monthlySubscriptionTotal: number;
  projectedRemainingBalance: number;
  upcomingBills: CreditCardBill[];
  overdueBills: CreditCardBill[];
  upcomingSubscriptions: Subscription[];
  overdueReminders: Reminder[];
  highPriorityItemCount: number;
  priorityLevel: PriorityLevel;
  highestExpenseCategory: { category: string; total: number } | null;
  suspiciousExpenses: { id: string; label: string; reason: string }[];
};

type SummaryInput = {
  expenses: Expense[];
  incomeStreams: IncomeStream[];
  creditCardBills: CreditCardBill[];
  subscriptions: Subscription[];
  reminders: Reminder[];
  todos: Todo[];
};

function amount(value: number | string | null | undefined) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function toDate(value: string | null | undefined) {
  if (!value) return null;
  const normalized = value.includes("T") ? value : `${value}T00:00:00+04:00`;
  const date = new Date(normalized);
  return Number.isNaN(date.getTime()) ? null : date;
}

function isSameMonth(value: string | null | undefined, now: Date) {
  if (!value) return false;
  const monthKey = value.slice(0, 7);
  const nowKey = now.toISOString().slice(0, 7);
  return monthKey === nowKey;
}

function daysUntil(value: string, now: Date) {
  const date = toDate(value);
  if (!date) return Number.POSITIVE_INFINITY;
  const start = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const target = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
  return Math.ceil((target - start) / 86_400_000);
}

function isUnpaidBill(bill: CreditCardBill) {
  return bill.payment_status !== "Paid";
}

function isActiveSubscription(subscription: Subscription) {
  return subscription.status !== "Cancelled" && subscription.status !== "Paused";
}

function buildHighestExpenseCategory(expenses: Expense[], now: Date) {
  const totals = new Map<string, number>();
  for (const expense of expenses) {
    if (!isSameMonth(expense.expense_date, now)) continue;
    const category = (expense.category || "Other").trim() || "Other";
    totals.set(category, (totals.get(category) || 0) + amount(expense.amount));
  }
  const [category, total] = [...totals.entries()].sort((a, b) => b[1] - a[1])[0] || [];
  return category ? { category, total } : null;
}

function findSuspiciousExpenses(expenses: Expense[]) {
  return expenses
    .filter((expense) => !amount(expense.amount) || !expense.expense_date || !expense.category || amount(expense.amount) > 5000)
    .slice(0, 8)
    .map((expense) => ({
      id: expense.id,
      label: expense.merchant || expense.notes || "Unknown expense",
      reason: !amount(expense.amount)
        ? "Missing or zero amount"
        : !expense.expense_date
          ? "Missing date"
          : !expense.category
            ? "Missing category"
            : "Unusually high amount",
    }));
}

export function buildCommandCenterSummary(input: SummaryInput, now = new Date()): CommandCenterSummary {
  const monthlyIncomeTotal = input.incomeStreams
    .filter((stream) => stream.status !== "Late" && isSameMonth(stream.expected_date, now))
    .reduce((sum, stream) => sum + amount(stream.amount), 0);
  const monthlyExpenseTotal = input.expenses
    .filter((expense) => isSameMonth(expense.expense_date, now))
    .reduce((sum, expense) => sum + amount(expense.amount), 0);
  const monthlyCreditCardPaymentTotal = input.creditCardBills
    .filter((bill) => isUnpaidBill(bill) && isSameMonth(bill.due_date, now))
    .reduce((sum, bill) => sum + amount(bill.statement_balance), 0);
  const monthlySubscriptionTotal = input.subscriptions
    .filter((subscription) => isActiveSubscription(subscription) && isSameMonth(subscription.next_billing_date, now))
    .reduce((sum, subscription) => sum + amount(subscription.amount), 0);
  const projectedRemainingBalance = monthlyIncomeTotal - monthlyExpenseTotal - monthlyCreditCardPaymentTotal;
  const upcomingBills = input.creditCardBills.filter((bill) => isUnpaidBill(bill) && daysUntil(bill.due_date, now) >= 0 && daysUntil(bill.due_date, now) <= 7);
  const overdueBills = input.creditCardBills.filter((bill) => isUnpaidBill(bill) && daysUntil(bill.due_date, now) < 0);
  const upcomingSubscriptions = input.subscriptions.filter(
    (subscription) => isActiveSubscription(subscription) && daysUntil(subscription.next_billing_date, now) >= 0 && daysUntil(subscription.next_billing_date, now) <= 7,
  );
  const overdueReminders = input.reminders.filter((reminder) => reminder.status === "Pending" && daysUntil(reminder.due_at, now) < 0);
  const highPriorityItemCount =
    input.creditCardBills.filter((bill) => bill.priority === "High" || bill.priority === "Urgent").length +
    input.reminders.filter((reminder) => reminder.priority === "High" || reminder.priority === "Urgent").length +
    input.todos.filter((todo) => todo.priority === "High" || todo.priority === "Urgent").length;

  let priorityLevel: PriorityLevel = "safe";
  if (upcomingBills.length || upcomingSubscriptions.length || highPriorityItemCount) priorityLevel = "watch";
  if (projectedRemainingBalance < monthlyIncomeTotal * 0.1 || monthlyCreditCardPaymentTotal > monthlyIncomeTotal * 0.35) priorityLevel = "warning";
  if (projectedRemainingBalance < 0 || overdueBills.length || overdueReminders.length) priorityLevel = "urgent";

  return {
    monthlyIncomeTotal,
    monthlyExpenseTotal,
    monthlyCreditCardPaymentTotal,
    monthlySubscriptionTotal,
    projectedRemainingBalance,
    upcomingBills,
    overdueBills,
    upcomingSubscriptions,
    overdueReminders,
    highPriorityItemCount,
    priorityLevel,
    highestExpenseCategory: buildHighestExpenseCategory(input.expenses, now),
    suspiciousExpenses: findSuspiciousExpenses(input.expenses),
  };
}
