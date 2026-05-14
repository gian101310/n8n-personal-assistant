import "server-only";
import type { BreakdownRow, DashboardData, DashboardMetrics, Expense, LogRow, Task } from "./types";

const fallbackMetrics: DashboardMetrics = {
  today_expense_total: 0,
  today_expense_count: 0,
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

async function supabaseGet<T>(path: string): Promise<T> {
  const { url, key } = config();
  const response = await fetch(`${url}/rest/v1/${path}`, {
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
    },
    cache: "no-store",
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Supabase GET ${path} failed: ${response.status} ${body}`);
  }

  return response.json() as Promise<T>;
}

async function supabasePatch(path: string, body: unknown): Promise<void> {
  const { url, key } = config();
  const response = await fetch(`${url}/rest/v1/${path}`, {
    method: "PATCH",
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      Prefer: "return=minimal",
    },
    body: JSON.stringify(body),
    cache: "no-store",
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Supabase PATCH ${path} failed: ${response.status} ${text}`);
  }
}

export async function getDashboardData(): Promise<DashboardData> {
  const [metrics, expenses, tasks, categoryBreakdown, cardBreakdown, logs] = await Promise.all([
    supabaseGet<DashboardMetrics[]>("assistant_dashboard_metrics?select=*"),
    supabaseGet<Expense[]>("assistant_expenses?select=*&order=created_at.desc&limit=12"),
    supabaseGet<Task[]>("assistant_tasks?select=*&status=eq.open&order=due_at.asc.nullslast,created_at.desc&limit=12"),
    supabaseGet<BreakdownRow[]>("assistant_category_expense_summary?select=*&order=total_amount.desc&limit=8"),
    supabaseGet<BreakdownRow[]>("assistant_card_expense_summary?select=*&order=total_amount.desc&limit=8"),
    supabaseGet<LogRow[]>("assistant_logs?select=id,workflow,raw_input,intent,status,message,execution_source,created_at&order=created_at.desc&limit=12"),
  ]);

  return {
    metrics: metrics[0] ?? fallbackMetrics,
    expenses,
    tasks,
    categoryBreakdown,
    cardBreakdown,
    logs,
  };
}

export async function markTaskDone(id: string) {
  await supabasePatch(`assistant_tasks?id=eq.${encodeURIComponent(id)}`, {
    status: "done",
    completed_at: new Date().toISOString(),
  });
}

