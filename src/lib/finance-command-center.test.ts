import { describe, expect, it } from "vitest";
import { buildCommandCenterSummary } from "./finance-command-center";
import type { CreditCardBill, Expense, IncomeStream, Reminder, Subscription } from "./types";

const now = new Date("2026-05-18T08:00:00Z");

function expense(overrides: Partial<Expense> = {}): Expense {
  return {
    id: overrides.id || crypto.randomUUID(),
    expense_date: overrides.expense_date || "2026-05-10",
    merchant: overrides.merchant ?? "Cafe",
    amount: overrides.amount ?? 100,
    currency: overrides.currency || "AED",
    category: overrides.category || "Food",
    payment_method: overrides.payment_method ?? "Card",
    card: overrides.card ?? "ADCB Debit",
    status: overrides.status || "posted",
    notes: overrides.notes ?? null,
    source: overrides.source || "test",
    is_manually_corrected: overrides.is_manually_corrected ?? false,
    corrected_at: overrides.corrected_at ?? null,
    correction_reason: overrides.correction_reason ?? null,
    corrected_fields: overrides.corrected_fields ?? [],
    created_at: overrides.created_at || "2026-05-10T00:00:00Z",
    updated_at: overrides.updated_at || "2026-05-10T00:00:00Z",
  };
}

function income(overrides: Partial<IncomeStream> = {}): IncomeStream {
  return {
    id: overrides.id || crypto.randomUUID(),
    user_id: null,
    source_name: overrides.source_name || "Salary",
    type: overrides.type || "Salary",
    amount: overrides.amount ?? 10000,
    currency: overrides.currency || "AED",
    frequency: overrides.frequency || "Monthly",
    expected_date: overrides.expected_date || "2026-05-01",
    status: overrides.status || "Received",
    notes: overrides.notes ?? null,
    source: overrides.source || "Dashboard",
    is_manually_corrected: false,
    corrected_at: null,
    correction_reason: null,
    corrected_fields: [],
    created_at: "2026-05-01T00:00:00Z",
    updated_at: "2026-05-01T00:00:00Z",
  };
}

function bill(overrides: Partial<CreditCardBill> = {}): CreditCardBill {
  return {
    id: overrides.id || crypto.randomUUID(),
    user_id: null,
    card_name: overrides.card_name || "ADCB Credit",
    statement_balance: overrides.statement_balance ?? 1200,
    minimum_payment: overrides.minimum_payment ?? 100,
    currency: overrides.currency || "AED",
    due_date: overrides.due_date || "2026-05-20",
    autopay_enabled: overrides.autopay_enabled ?? false,
    payment_status: overrides.payment_status || "Due",
    priority: overrides.priority || "High",
    notes: overrides.notes ?? null,
    source: overrides.source || "Dashboard",
    is_manually_corrected: false,
    corrected_at: null,
    correction_reason: null,
    corrected_fields: [],
    created_at: "2026-05-01T00:00:00Z",
    updated_at: "2026-05-01T00:00:00Z",
  };
}

function subscription(overrides: Partial<Subscription> = {}): Subscription {
  return {
    id: overrides.id || crypto.randomUUID(),
    user_id: null,
    subscription_name: overrides.subscription_name || "Netflix",
    category: overrides.category || "Entertainment",
    amount: overrides.amount ?? 50,
    currency: overrides.currency || "AED",
    billing_cycle: overrides.billing_cycle || "Monthly",
    next_billing_date: overrides.next_billing_date || "2026-05-21",
    payment_method: overrides.payment_method || "Card",
    status: overrides.status || "Active",
    cancel_review_flag: overrides.cancel_review_flag ?? false,
    notes: overrides.notes ?? null,
    source: overrides.source || "Dashboard",
    is_manually_corrected: false,
    corrected_at: null,
    correction_reason: null,
    corrected_fields: [],
    created_at: "2026-05-01T00:00:00Z",
    updated_at: "2026-05-01T00:00:00Z",
  };
}

function reminder(overrides: Partial<Reminder> = {}): Reminder {
  return {
    id: overrides.id || crypto.randomUUID(),
    user_id: null,
    title: overrides.title || "Pay school fees",
    description: overrides.description ?? null,
    due_at: overrides.due_at || "2026-05-19T08:00:00Z",
    priority: overrides.priority || "High",
    status: overrides.status || "Pending",
    source: overrides.source || "Dashboard",
    linked_item_type: overrides.linked_item_type ?? null,
    linked_item_id: overrides.linked_item_id ?? null,
    notes: overrides.notes ?? null,
    created_at: "2026-05-01T00:00:00Z",
    updated_at: "2026-05-01T00:00:00Z",
  };
}

describe("buildCommandCenterSummary", () => {
  it("calculates monthly totals and projected remaining balance", () => {
    const summary = buildCommandCenterSummary(
      {
        expenses: [expense({ amount: 500 }), expense({ amount: 200, expense_date: "2026-04-30" })],
        incomeStreams: [income({ amount: 5000 }), income({ amount: 1000, status: "Expected" })],
        creditCardBills: [bill({ statement_balance: 1500 }), bill({ statement_balance: 800, payment_status: "Paid" })],
        subscriptions: [subscription({ amount: 75 })],
        reminders: [reminder()],
        todos: [],
      },
      now,
    );

    expect(summary.monthlyIncomeTotal).toBe(6000);
    expect(summary.monthlyExpenseTotal).toBe(500);
    expect(summary.monthlyCreditCardPaymentTotal).toBe(1500);
    expect(summary.monthlySubscriptionTotal).toBe(75);
    expect(summary.projectedRemainingBalance).toBe(4000);
    expect(summary.priorityLevel).toBe("watch");
  });

  it("marks urgent when the projected remaining balance is negative or bills are overdue", () => {
    const summary = buildCommandCenterSummary(
      {
        expenses: [expense({ amount: 2000 })],
        incomeStreams: [income({ amount: 1000 })],
        creditCardBills: [bill({ statement_balance: 100, due_date: "2026-05-10" })],
        subscriptions: [],
        reminders: [],
        todos: [],
      },
      now,
    );

    expect(summary.projectedRemainingBalance).toBe(-1100);
    expect(summary.overdueBills).toHaveLength(1);
    expect(summary.priorityLevel).toBe("urgent");
  });
});
