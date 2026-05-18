import "server-only";
import type {
  ActivityLog,
  AIInsight,
  AssistantCard,
  Budget,
  BreakdownRow,
  CreditCardBill,
  DashboardData,
  DashboardMetrics,
  Expense,
  FilterOptions,
  IncomeStream,
  LogRow,
  MonthlySpend,
  Note,
  Reminder,
  Subscription,
  Task,
  Todo,
  WeeklyReview,
} from "./types";
import { buildExpenseQuery, type DashboardFilters } from "./dashboard-filters";
import { buildBudgetProgress } from "./budget-progress";
import { buildCommandCenterSummary } from "./finance-command-center";
import { generateLocalAIInsights } from "./ai-agents";

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

const defaultCategories = [
  "Food",
  "Transport",
  "Groceries",
  "Bills",
  "Shopping",
  "Business",
  "Health",
  "Entertainment",
  "Travel",
  "Trading",
  "Subscriptions",
  "Other",
];

type MaybeId = string | null | undefined;

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

async function safeSupabaseGet<T>(path: string, fallback: T): Promise<T> {
  try {
    return await supabaseGet<T>(path);
  } catch (error) {
    if (process.env.NODE_ENV !== "production") {
      console.warn(error);
    }
    return fallback;
  }
}

async function supabasePatch(path: string, body: unknown): Promise<void> {
  await supabaseRequest<void>(path, {
    method: "PATCH",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify(body),
  });
}

async function supabasePost(path: string, body: unknown): Promise<void> {
  await supabaseRequest<void>(path, {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
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
  return [...new Set(values.map((value) => String(value || "").trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b));
}

function buildFilterOptions(expenses: Expense[], cards: AssistantCard[]): FilterOptions {
  return {
    categories: uniqueSorted([...defaultCategories, ...expenses.map((expense) => expense.category)]),
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

function clean(value: FormDataEntryValue | null) {
  return String(value || "").trim();
}

function amountFromForm(formData: FormData, name: string) {
  const value = Number(clean(formData.get(name)));
  if (!Number.isFinite(value) || value < 0) throw new Error(`${name} must be a valid positive number.`);
  return value;
}

function required(formData: FormData, name: string) {
  const value = clean(formData.get(name));
  if (!value) throw new Error(`${name} is required.`);
  return value;
}

function optionalDate(value: string) {
  return value || null;
}

function manualCorrectionPayload(formData: FormData, fields: string[]) {
  const correctionReason = clean(formData.get("correction_reason"));
  return {
    is_manually_corrected: true,
    corrected_at: new Date().toISOString(),
    correction_reason: correctionReason || null,
    corrected_fields: fields,
  };
}

export async function getDashboardData(filters: DashboardFilters): Promise<DashboardData> {
  const [metricsRows, expenses, allExpenses, cards, budgets, tasks, weeklyReviews, logs, incomeStreams, creditCardBills, subscriptions, reminders, notes, todos, activities, persistedInsights] =
    await Promise.all([
      safeSupabaseGet<DashboardMetrics[]>("assistant_dashboard_metrics?select=*", []),
      safeSupabaseGet<Expense[]>(buildExpenseQuery(filters, 160), []),
      safeSupabaseGet<Expense[]>("assistant_expenses?select=*&order=expense_date.desc,created_at.desc&limit=700", []),
      safeSupabaseGet<AssistantCard[]>("assistant_cards?select=*&active=eq.true&order=kind.asc,name.asc", []),
      safeSupabaseGet<Budget[]>("assistant_budgets?select=*&active=eq.true&period=eq.monthly&order=category.asc", []),
      safeSupabaseGet<Task[]>("assistant_tasks?select=*&status=eq.open&order=due_at.asc.nullslast,created_at.desc&limit=18", []),
      safeSupabaseGet<WeeklyReview[]>("assistant_weekly_reviews?select=*&order=week_start.desc&limit=8", []),
      safeSupabaseGet<LogRow[]>("assistant_logs?select=id,workflow,raw_input,intent,status,message,execution_source,created_at&order=created_at.desc&limit=18", []),
      safeSupabaseGet<IncomeStream[]>("assistant_income_streams?select=*&order=expected_date.asc,created_at.desc&limit=120", []),
      safeSupabaseGet<CreditCardBill[]>("assistant_credit_card_bills?select=*&order=due_date.asc,created_at.desc&limit=120", []),
      safeSupabaseGet<Subscription[]>("assistant_subscriptions?select=*&order=next_billing_date.asc,created_at.desc&limit=120", []),
      safeSupabaseGet<Reminder[]>("assistant_reminders?select=*&order=due_at.asc,created_at.desc&limit=120", []),
      safeSupabaseGet<Note[]>("assistant_notes?select=*&order=updated_at.desc&limit=120", []),
      safeSupabaseGet<Todo[]>("assistant_todos?select=*&order=due_at.asc.nullslast,created_at.desc&limit=120", []),
      safeSupabaseGet<ActivityLog[]>(
        `assistant_activity_logs?select=*&order=created_at.desc&limit=80${filters.activityType ? `&activity_type=eq.${encodeURIComponent(filters.activityType)}` : ""}`,
        [],
      ),
      safeSupabaseGet<AIInsight[]>("assistant_ai_insights?select=*&order=created_at.desc&limit=20", []),
    ]);

  const categoryBreakdown = buildBreakdown(expenses, "category").slice(0, 8);
  const cardBreakdown = buildBreakdown(expenses, "card").slice(0, 8);
  const summary = buildCommandCenterSummary({ expenses: allExpenses, incomeStreams, creditCardBills, subscriptions, reminders, todos });
  const generatedInsights = generateLocalAIInsights(summary);

  return {
    metrics: enrichMetrics(metricsRows[0] ?? fallbackMetrics, expenses, categoryBreakdown, cardBreakdown),
    expenses,
    incomeStreams,
    creditCardBills,
    subscriptions,
    reminders,
    notes,
    todos,
    activities,
    aiInsights: persistedInsights.length ? persistedInsights : generatedInsights,
    tasks,
    categoryBreakdown,
    cardBreakdown,
    cards,
    budgets,
    budgetProgress: buildBudgetProgress(budgets, allExpenses),
    monthlySpend: buildMonthlySpend(allExpenses),
    weeklyReviews,
    filterOptions: buildFilterOptions(allExpenses, cards),
    logs,
  };
}

export function buildDashboardSummary(data: DashboardData) {
  return buildCommandCenterSummary({
    expenses: data.expenses,
    incomeStreams: data.incomeStreams,
    creditCardBills: data.creditCardBills,
    subscriptions: data.subscriptions,
    reminders: data.reminders,
    todos: data.todos,
  });
}

export async function logActivity(activity_type: string, title: string, description: string | null, source = "Dashboard") {
  try {
    await supabasePost("assistant_activity_logs", {
      activity_type,
      title,
      description,
      source,
    });
  } catch (error) {
    if (process.env.NODE_ENV !== "production") console.warn(error);
  }
}

export async function markTaskDone(id: string) {
  await supabasePatch(`assistant_tasks?id=eq.${encodeURIComponent(id)}`, {
    status: "done",
    completed_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  });
}

export async function deleteExpense(id: string) {
  await supabaseDelete(`assistant_expenses?id=eq.${encodeURIComponent(id)}`);
  await logActivity("Edited expense", "Expense deleted", id, "Dashboard");
}

export async function deleteBudget(id: string) {
  await supabaseDelete(`assistant_budgets?id=eq.${encodeURIComponent(id)}`);
}

export async function saveBudget(category: string, amount: number) {
  await supabasePost("assistant_budgets?on_conflict=category,period", {
    category,
    amount,
    currency: "AED",
    period: "monthly",
    active: true,
  });
}

export async function saveExpense(formData: FormData) {
  const id = clean(formData.get("id"));
  const payload = {
    expense_date: required(formData, "expense_date"),
    merchant: required(formData, "merchant"),
    amount: amountFromForm(formData, "amount"),
    currency: clean(formData.get("currency")) || "AED",
    category: required(formData, "category"),
    payment_method: clean(formData.get("payment_method")) || null,
    card: clean(formData.get("card")) || null,
    status: clean(formData.get("status")) || "posted",
    notes: clean(formData.get("notes")) || null,
    source: clean(formData.get("source")) || "Dashboard",
    ...manualCorrectionPayload(formData, ["amount", "category", "expense_date", "merchant", "payment_method", "notes"]),
  };
  if (id) {
    await supabasePatch(`assistant_expenses?id=eq.${encodeURIComponent(id)}`, payload);
    await logActivity("Edited expense", `Edited ${payload.merchant}`, payload.category);
  } else {
    await supabasePost("assistant_expenses", payload);
    await logActivity("Added expense", `Added ${payload.merchant}`, payload.category);
  }
}

export async function saveIncomeStream(formData: FormData) {
  const id = clean(formData.get("id"));
  const payload = {
    source_name: required(formData, "source_name"),
    type: required(formData, "type"),
    amount: amountFromForm(formData, "amount"),
    currency: clean(formData.get("currency")) || "AED",
    frequency: required(formData, "frequency"),
    expected_date: required(formData, "expected_date"),
    status: required(formData, "status"),
    notes: clean(formData.get("notes")) || null,
    source: clean(formData.get("source")) || "Dashboard",
    ...manualCorrectionPayload(formData, ["source_name", "type", "amount", "frequency", "expected_date", "status", "notes"]),
  };
  if (id) await supabasePatch(`assistant_income_streams?id=eq.${encodeURIComponent(id)}`, payload);
  else await supabasePost("assistant_income_streams", payload);
  await logActivity(id ? "Edited income" : "Added income", payload.source_name, payload.status);
}

export async function deleteIncomeStream(id: string) {
  await supabaseDelete(`assistant_income_streams?id=eq.${encodeURIComponent(id)}`);
  await logActivity("Edited income", "Income stream deleted", id);
}

export async function saveCreditCardBill(formData: FormData) {
  const id = clean(formData.get("id"));
  const payload = {
    card_name: required(formData, "card_name"),
    statement_balance: amountFromForm(formData, "statement_balance"),
    minimum_payment: amountFromForm(formData, "minimum_payment"),
    currency: clean(formData.get("currency")) || "AED",
    due_date: required(formData, "due_date"),
    autopay_enabled: clean(formData.get("autopay_enabled")) === "on",
    payment_status: required(formData, "payment_status"),
    priority: required(formData, "priority"),
    notes: clean(formData.get("notes")) || null,
    source: "Dashboard",
    ...manualCorrectionPayload(formData, ["card_name", "statement_balance", "minimum_payment", "due_date", "autopay_enabled", "payment_status", "priority", "notes"]),
  };
  if (id) await supabasePatch(`assistant_credit_card_bills?id=eq.${encodeURIComponent(id)}`, payload);
  else await supabasePost("assistant_credit_card_bills", payload);
  await logActivity(payload.payment_status === "Paid" ? "Bill paid" : "Edited bill", payload.card_name, payload.payment_status);
}

export async function deleteCreditCardBill(id: string) {
  await supabaseDelete(`assistant_credit_card_bills?id=eq.${encodeURIComponent(id)}`);
  await logActivity("Edited bill", "Credit card bill deleted", id);
}

export async function saveSubscription(formData: FormData) {
  const id = clean(formData.get("id"));
  const payload = {
    subscription_name: required(formData, "subscription_name"),
    category: required(formData, "category"),
    amount: amountFromForm(formData, "amount"),
    currency: clean(formData.get("currency")) || "AED",
    billing_cycle: required(formData, "billing_cycle"),
    next_billing_date: required(formData, "next_billing_date"),
    payment_method: required(formData, "payment_method"),
    status: required(formData, "status"),
    cancel_review_flag: clean(formData.get("cancel_review_flag")) === "on",
    notes: clean(formData.get("notes")) || null,
    source: "Dashboard",
    ...manualCorrectionPayload(formData, ["subscription_name", "category", "amount", "billing_cycle", "next_billing_date", "payment_method", "status", "notes"]),
  };
  if (id) await supabasePatch(`assistant_subscriptions?id=eq.${encodeURIComponent(id)}`, payload);
  else await supabasePost("assistant_subscriptions", payload);
  await logActivity("Edited subscription", payload.subscription_name, payload.status);
}

export async function deleteSubscription(id: string) {
  await supabaseDelete(`assistant_subscriptions?id=eq.${encodeURIComponent(id)}`);
  await logActivity("Edited subscription", "Subscription deleted", id);
}

export async function saveNote(formData: FormData) {
  const id = clean(formData.get("id"));
  const title = required(formData, "title");
  const payload = {
    title,
    body: required(formData, "body"),
    tags: clean(formData.get("tags"))
      .split(",")
      .map((tag) => tag.trim())
      .filter(Boolean),
    priority: required(formData, "priority"),
    linked_item_type: clean(formData.get("linked_item_type")) || "general",
    linked_item_id: clean(formData.get("linked_item_id")) || null,
    source: clean(formData.get("source")) || "Dashboard",
  };
  if (id) await supabasePatch(`assistant_notes?id=eq.${encodeURIComponent(id)}`, payload);
  else await supabasePost("assistant_notes", payload);
  await logActivity("Note added", title, payload.linked_item_type, payload.source);
}

export async function deleteNote(id: string) {
  await supabaseDelete(`assistant_notes?id=eq.${encodeURIComponent(id)}`);
  await logActivity("Note added", "Note deleted", id);
}

export async function saveReminder(formData: FormData) {
  const id = clean(formData.get("id"));
  const title = required(formData, "title");
  const payload = {
    title,
    description: clean(formData.get("description")) || null,
    due_at: required(formData, "due_at"),
    priority: required(formData, "priority"),
    status: required(formData, "status"),
    source: clean(formData.get("source")) || "Dashboard",
    linked_item_type: clean(formData.get("linked_item_type")) || null,
    linked_item_id: clean(formData.get("linked_item_id")) || null,
    notes: clean(formData.get("notes")) || null,
  };
  if (id) await supabasePatch(`assistant_reminders?id=eq.${encodeURIComponent(id)}`, payload);
  else await supabasePost("assistant_reminders", payload);
  await logActivity("Reminder created", title, payload.status, payload.source);
}

export async function deleteReminder(id: string) {
  await supabaseDelete(`assistant_reminders?id=eq.${encodeURIComponent(id)}`);
  await logActivity("Reminder created", "Reminder deleted", id);
}

export async function snoozeReminder(id: string) {
  const dueAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  await supabasePatch(`assistant_reminders?id=eq.${encodeURIComponent(id)}`, {
    status: "Snoozed",
    due_at: dueAt,
  });
  await logActivity("Reminder created", "Reminder snoozed", dueAt);
}

export async function saveTodo(formData: FormData) {
  const id = clean(formData.get("id"));
  const task = required(formData, "task");
  const payload = {
    task,
    status: required(formData, "status"),
    priority: required(formData, "priority"),
    due_at: optionalDate(clean(formData.get("due_at"))),
    source: clean(formData.get("source")) || "Dashboard",
    notes: clean(formData.get("notes")) || null,
  };
  if (id) await supabasePatch(`assistant_todos?id=eq.${encodeURIComponent(id)}`, payload);
  else await supabasePost("assistant_todos", payload);
  await logActivity("Reminder created", task, payload.status, payload.source);
}

export async function deleteTodo(id: string) {
  await supabaseDelete(`assistant_todos?id=eq.${encodeURIComponent(id)}`);
  await logActivity("Reminder created", "Todo deleted", id);
}

export async function regenerateAIInsights(data: DashboardData) {
  const summary = buildDashboardSummary(data);
  const insights = generateLocalAIInsights(summary);
  await Promise.all(
    insights.map((entry) =>
      supabasePost("assistant_ai_insights", {
        agent: entry.agent,
        category: entry.category,
        severity: entry.severity,
        title: entry.title,
        message: entry.message,
        action_label: entry.action_label,
        linked_item_type: entry.linked_item_type,
        linked_item_id: entry.linked_item_id,
      }),
    ),
  );
  await logActivity("AI warning generated", "AI insights regenerated", `${insights.length} insights`);
}

export async function createTelegramNote(text: string, chatId: MaybeId) {
  await supabasePost("assistant_notes", {
    title: text.slice(0, 80),
    body: text,
    tags: ["telegram"],
    priority: "Normal",
    linked_item_type: "general",
    linked_item_id: null,
    source: "Telegram",
  });
  await logActivity("Telegram action received", "Telegram note added", chatId || text, "Telegram");
}

export async function createTelegramReminder(text: string, dueAt: string, chatId: MaybeId) {
  await supabasePost("assistant_reminders", {
    title: text.slice(0, 120),
    description: text,
    due_at: dueAt,
    priority: "Normal",
    status: "Pending",
    source: "Telegram",
  });
  await logActivity("Telegram action received", "Telegram reminder added", chatId || text, "Telegram");
}

export async function createTelegramTodo(text: string, chatId: MaybeId) {
  await supabasePost("assistant_todos", {
    task: text,
    status: "Pending",
    priority: "Normal",
    source: "Telegram",
  });
  await logActivity("Telegram action received", "Telegram todo added", chatId || text, "Telegram");
}
