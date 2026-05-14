import "server-only";
import type {
  AssistantCard,
  BreakdownRow,
  DashboardData,
  DashboardMetrics,
  Expense,
  FilterOptions,
  LogRow,
  MonthlySpend,
  Task,
} from "./types";
import { buildExpenseQuery, type DashboardFilters } from "./dashboard-filters";

const fallbackMetrics: DashboardMetrics = {
  today_expense_total: 0,
  today_expense_count: 0,
  filtered_expense_total: 0,
  filtered_expense_count: 0,
  average_expense: 0,
  top_category: null,
  top_card: null,
  open_task_count: 0,
  completed_today_count: 0,
  due_reminder_count: 0,
};

function config() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env");
  }
  return { url, key };
}

async function supabaseRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const { url, key } = config();
  const response = await fetch(`${url}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      ...(init.body ? { "Content-Type": "application/json" } : {}),
      ...init.headers,
    },
    cache: "no-store",
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Supabase request ${path} failed: ${response.status} ${body}`);
  }

  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

async function supabaseGet<T>(path: string): Promise<T> {
  return supabaseRequest<T>(path);
}

async function supabasePatch(path: string, body: unknown): Promise<void> {
  await supabaseRequest<void>(path, {
    method: "PATCH",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify(body),
  });
}

async function supabaseDelete(path: string): Promise<void> {
  await supabaseRequest<void>(path, {
    method: "DELETE",
    headers: { Prefer: "return=minimal" },
  });
}

function sumExpenses(expenses: Expense[]) {
  return expenses.reduce((sum, expense) => sum + Number(expense.amount || 0), 0);
}

function buildBreakdown(expenses: Expense[], key: "category" | "card"): BreakdownRow[] {
  const rows = new Map<string, BreakdownRow>();

  for (const expense of expenses) {
    const label = (expense[key] || (key === "card" ? "Unknown" : "Other")).trim() || "Unknown";
    const current =
      rows.get(label) ||
      ({
        [key]: label,
        currency: expense.currency || "AED",
        expense_count: 0,
        total_amount: 0,
        latest_expense_date: expense.expense_date,
      } as BreakdownRow);

    current.expense_count += 1;
    current.total_amount = Number(current.total_amount || 0) + Number(expense.amount || 0);
    if (!current.latest_expense_date || expense.expense_date > current.latest_expense_date) {
      current.latest_expense_date = expense.expense_date;
    }
    rows.set(label, current);
  }

  return [...rows.values()].sort((a, b) => Number(b.total_amount) - Number(a.total_amount));
}

function buildMonthlySpend(expenses: Expense[]): MonthlySpend[] {
  const rows = new Map<string, number>();
  const now = new Date();

  for (let index = 5; index >= 0; index -= 1) {
    const date = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - index, 1));
    const key = date.toISOString().slice(0, 7);
    rows.set(key, 0);
  }

  for (const expense of expenses) {
    const key = expense.expense_date.slice(0, 7);
    if (rows.has(key)) {
      rows.set(key, (rows.get(key) || 0) + Number(expense.amount || 0));
    }
  }

  return [...rows.entries()].map(([key, total]) => {
    const date = new Date(`${key}-01T00:00:00Z`);
    return {
      label: date.toLocaleDateString("en-GB", { month: "short" }),
      total,
    };
  });
}

function uniqueSorted(values: Array<string | null | undefined>) {
  return [...new Set(values.map((value) => String(value || "").trim()).filter(Boolean))].sort((a, b) =>
    a.localeCompare(b),
  );
}

function buildFilterOptions(expenses: Expense[], cards: AssistantCard[]): FilterOptions {
  return {
    categories: uniqueSorted(expenses.map((expense) => expense.category)),
    cards: uniqueSorted([...expenses.map((expense) => expense.card || expense.payment_method), ...cards.map((card) => card.name)]),
    merchants: uniqueSorted(expenses.map((expense) => expense.merchant)).slice(0, 30),
  };
}

function enrichMetrics(base: DashboardMetrics, expenses: Expense[], categoryBreakdown: BreakdownRow[], cardBreakdown: BreakdownRow[]) {
  const filteredTotal = sumExpenses(expenses);
  return {
    ...base,
    filtered_expense_total: filteredTotal,
    filtered_expense_count: expenses.length,
    average_expense: expenses.length ? filteredTotal / expenses.length : 0,
    top_category: categoryBreakdown[0]?.category || null,
    top_card: cardBreakdown[0]?.card || null,
  };
}

export async function getDashboardData(filters: DashboardFilters): Promise<DashboardData> {
  const [metricsRows, expenses, allExpenses, cards, tasks, logs] = await Promise.all([
    supabaseGet<DashboardMetrics[]>("assistant_dashboard_metrics?select=*"),
    supabaseGet<Expense[]>(buildExpenseQuery(filters, 100)),
    supabaseGet<Expense[]>("assistant_expenses?select=*&order=expense_date.desc,created_at.desc&limit=500"),
    supabaseGet<AssistantCard[]>("assistant_cards?select=*&active=eq.true&order=kind.asc,name.asc"),
    supabaseGet<Task[]>("assistant_tasks?select=*&status=eq.open&order=due_at.asc.nullslast,created_at.desc&limit=18"),
    supabaseGet<LogRow[]>(
      "assistant_logs?select=id,workflow,raw_input,intent,status,message,execution_source,created_at&order=created_at.desc&limit=18",
    ),
  ]);

  const categoryBreakdown = buildBreakdown(expenses, "category").slice(0, 8);
  const cardBreakdown = buildBreakdown(expenses, "card").slice(0, 8);

  return {
    metrics: enrichMetrics(metricsRows[0] ?? fallbackMetrics, expenses, categoryBreakdown, cardBreakdown),
    expenses,
    tasks,
    categoryBreakdown,
    cardBreakdown,
    cards,
    monthlySpend: buildMonthlySpend(allExpenses),
    filterOptions: buildFilterOptions(allExpenses, cards),
    logs,
  };
}

export async function markTaskDone(id: string) {
  await supabasePatch(`assistant_tasks?id=eq.${encodeURIComponent(id)}`, {
    status: "done",
    completed_at: new Date().toISOString(),
  });
}

export async function deleteExpense(id: string) {
  await supabaseDelete(`assistant_expenses?id=eq.${encodeURIComponent(id)}`);
}
