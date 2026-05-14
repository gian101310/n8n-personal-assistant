import type { Budget, BudgetProgress, Expense } from "./types";

export function isCurrentMonth(dateText: string, now = new Date()) {
  const date = new Date(`${dateText}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return false;
  return date.getUTCFullYear() === now.getUTCFullYear() && date.getUTCMonth() === now.getUTCMonth();
}

export function buildBudgetProgress(budgets: Budget[], expenses: Expense[], now = new Date()): BudgetProgress[] {
  const spendByCategory = new Map<string, number>();

  for (const expense of expenses) {
    if (!isCurrentMonth(expense.expense_date, now)) continue;
    const category = (expense.category || "Other").trim() || "Other";
    spendByCategory.set(category, (spendByCategory.get(category) || 0) + Number(expense.amount || 0));
  }

  return budgets
    .filter((budget) => budget.active)
    .map((budget) => {
      const spent = spendByCategory.get(budget.category) || 0;
      const limit = Number(budget.amount || 0);
      const remaining = limit - spent;
      const percentUsed = limit > 0 ? Math.round((spent / limit) * 100) : 0;

      return {
        id: budget.id,
        category: budget.category,
        limit,
        spent,
        remaining,
        currency: budget.currency || "AED",
        percentUsed,
        isOverBudget: remaining < 0,
      };
    })
    .sort((a, b) => b.percentUsed - a.percentUsed || a.category.localeCompare(b.category));
}
