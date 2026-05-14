import { revalidatePath } from "next/cache";
import { Check, CircleDollarSign, ClipboardList, RefreshCw, Timer, WalletCards } from "lucide-react";
import { formatDate, formatDateTime, formatMoney, priorityLabel, statusLabel } from "@/lib/dashboard-format";
import { getDashboardData, markTaskDone } from "@/lib/supabase-dashboard";

async function completeTask(formData: FormData) {
  "use server";
  const id = String(formData.get("id") || "");
  if (id) await markTaskDone(id);
  revalidatePath("/");
}

function MetricCard({
  label,
  value,
  icon,
}: {
  label: string;
  value: string | number;
  icon: React.ReactNode;
}) {
  return (
    <section className="metric">
      <div className="metricIcon">{icon}</div>
      <div>
        <p>{label}</p>
        <strong>{value}</strong>
      </div>
    </section>
  );
}

export default async function DashboardPage() {
  const data = await getDashboardData();
  const { metrics } = data;

  return (
    <main className="shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">Telegram Assistant</p>
          <h1>Personal Dashboard</h1>
        </div>
        <a className="refreshButton" href="/" title="Refresh dashboard">
          <RefreshCw size={18} />
          <span>Refresh</span>
        </a>
      </header>

      <section className="metricsGrid" aria-label="Dashboard metrics">
        <MetricCard
          label="Today spent"
          value={formatMoney(metrics.today_expense_total, "AED")}
          icon={<CircleDollarSign size={20} />}
        />
        <MetricCard label="Expense entries" value={metrics.today_expense_count ?? 0} icon={<WalletCards size={20} />} />
        <MetricCard label="Open tasks" value={metrics.open_task_count ?? 0} icon={<ClipboardList size={20} />} />
        <MetricCard label="Due reminders" value={metrics.due_reminder_count ?? 0} icon={<Timer size={20} />} />
      </section>

      <div className="mainGrid">
        <section className="panel span2">
          <div className="panelHeader">
            <h2>Recent Expenses</h2>
            <span>{data.expenses.length}</span>
          </div>
          <div className="tableWrap">
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Merchant</th>
                  <th>Category</th>
                  <th>Card</th>
                  <th className="right">Amount</th>
                </tr>
              </thead>
              <tbody>
                {data.expenses.map((expense) => (
                  <tr key={expense.id}>
                    <td>{formatDate(expense.expense_date)}</td>
                    <td>{expense.merchant || "Unknown"}</td>
                    <td>{expense.category}</td>
                    <td>{expense.card || expense.payment_method || "-"}</td>
                    <td className="right">{formatMoney(expense.amount, expense.currency)}</td>
                  </tr>
                ))}
                {data.expenses.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="empty">
                      No expenses yet.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </section>

        <section className="panel">
          <div className="panelHeader">
            <h2>Open Tasks</h2>
            <span>{data.tasks.length}</span>
          </div>
          <div className="taskList">
            {data.tasks.map((task) => (
              <article className="taskItem" key={task.id}>
                <div>
                  <strong>{task.task}</strong>
                  <p>
                    {statusLabel(task.status)} · {priorityLabel(task.priority)}
                    {task.due_at ? ` · ${formatDateTime(task.due_at)}` : ""}
                  </p>
                </div>
                <form action={completeTask}>
                  <input type="hidden" name="id" value={task.id} />
                  <button className="iconButton" type="submit" title="Mark done">
                    <Check size={16} />
                  </button>
                </form>
              </article>
            ))}
            {data.tasks.length === 0 ? <p className="empty block">No open tasks.</p> : null}
          </div>
        </section>

        <section className="panel">
          <div className="panelHeader">
            <h2>Category Spend</h2>
          </div>
          <div className="bars">
            {data.categoryBreakdown.map((row) => (
              <div className="barRow" key={row.category}>
                <div>
                  <strong>{row.category || "Other"}</strong>
                  <span>{row.expense_count} entries</span>
                </div>
                <b>{formatMoney(row.total_amount, row.currency)}</b>
              </div>
            ))}
            {data.categoryBreakdown.length === 0 ? <p className="empty block">No category data.</p> : null}
          </div>
        </section>

        <section className="panel">
          <div className="panelHeader">
            <h2>Card Spend</h2>
          </div>
          <div className="bars">
            {data.cardBreakdown.map((row) => (
              <div className="barRow" key={row.card}>
                <div>
                  <strong>{row.card || "Unknown"}</strong>
                  <span>{row.expense_count} entries</span>
                </div>
                <b>{formatMoney(row.total_amount, row.currency)}</b>
              </div>
            ))}
            {data.cardBreakdown.length === 0 ? <p className="empty block">No card data.</p> : null}
          </div>
        </section>

        <section className="panel span2">
          <div className="panelHeader">
            <h2>Recent Logs</h2>
            <span>{data.logs.length}</span>
          </div>
          <div className="logList">
            {data.logs.map((log) => (
              <article key={log.id} className="logItem">
                <div>
                  <strong>{log.intent || "unknown"}</strong>
                  <span>{log.status}</span>
                </div>
                <p>{log.raw_input || log.message || "No message"}</p>
                <time>{formatDateTime(log.created_at)}</time>
              </article>
            ))}
            {data.logs.length === 0 ? <p className="empty block">No logs yet.</p> : null}
          </div>
        </section>
      </div>
    </main>
  );
}

