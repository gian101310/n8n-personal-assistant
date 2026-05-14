import { revalidatePath } from "next/cache";
import {
  Activity,
  AlertTriangle,
  ArrowDownRight,
  BarChart3,
  Check,
  CircleDollarSign,
  ClipboardList,
  Filter,
  Gauge,
  LogOut,
  RefreshCw,
  Search,
  ShieldCheck,
  Sparkles,
  Timer,
  Trash2,
  TrendingUp,
  WalletCards,
} from "lucide-react";
import { formatDate, formatDateTime, formatMoney, priorityLabel, statusLabel } from "@/lib/dashboard-format";
import { filtersToSearchParams, parseDashboardFilters, periodLabels } from "@/lib/dashboard-filters";
import { deleteExpense, getDashboardData, markTaskDone, saveBudget } from "@/lib/supabase-dashboard";
import { logoutAction } from "./login/actions";

type DashboardPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

async function completeTask(formData: FormData) {
  "use server";
  const id = String(formData.get("id") || "");
  if (id) await markTaskDone(id);
  revalidatePath("/");
}

async function removeExpense(formData: FormData) {
  "use server";
  const id = String(formData.get("id") || "");
  if (id) await deleteExpense(id);
  revalidatePath("/");
}

async function upsertBudget(formData: FormData) {
  "use server";
  const category = String(formData.get("category") || "").trim();
  const amount = Number(formData.get("amount") || 0);
  if (category && amount > 0) await saveBudget(category, amount);
  revalidatePath("/");
}

function MetricCard({
  label,
  value,
  detail,
  icon,
  tone = "neutral",
}: {
  label: string;
  value: string | number;
  detail: string;
  icon: React.ReactNode;
  tone?: "neutral" | "good" | "warning";
}) {
  return (
    <section className={`metric ${tone}`}>
      <div className="metricIcon">{icon}</div>
      <div>
        <p>{label}</p>
        <strong>{value}</strong>
        <span>{detail}</span>
      </div>
    </section>
  );
}

function FilterSelect({
  name,
  label,
  value,
  options,
  allLabel,
}: {
  name: string;
  label: string;
  value: string;
  options: string[];
  allLabel: string;
}) {
  return (
    <label className="filterControl">
      <span>{label}</span>
      <select name={name} defaultValue={value}>
        <option value="">{allLabel}</option>
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </label>
  );
}

function MonthlyChart({ rows }: { rows: { label: string; total: number }[] }) {
  const max = Math.max(...rows.map((row) => row.total), 1);

  return (
    <div className="monthlyChart" aria-label="Monthly spend chart">
      {rows.map((row) => (
        <div className="monthColumn" key={row.label}>
          <div className="monthTrack">
            <span style={{ height: `${Math.max(6, (row.total / max) * 100)}%` }} />
          </div>
          <strong>{formatMoney(row.total, "AED")}</strong>
          <small>{row.label}</small>
        </div>
      ))}
    </div>
  );
}

function CardDirectory({ cards }: { cards: { id: string; name: string; kind: string; issuer: string | null; source: string }[] }) {
  const groups = [
    { key: "debit", label: "Debit Cards" },
    { key: "credit", label: "Credit Cards" },
    { key: "other", label: "Auto Added" },
  ];

  return (
    <div className="cardDirectory">
      {groups.map((group) => {
        const rows = cards.filter((card) => card.kind === group.key);
        if (!rows.length) return null;

        return (
          <div className="cardGroup" key={group.key}>
            <h3>{group.label}</h3>
            <div>
              {rows.map((card) => (
                <span className="cardPill" key={card.id} title={`${card.source}${card.issuer ? ` - ${card.issuer}` : ""}`}>
                  {card.name}
                </span>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function BudgetAlerts({ rows }: { rows: { category: string; percentUsed: number; spent: number; limit: number; remaining: number; currency: string; isOverBudget: boolean }[] }) {
  const warnings = rows.filter((r) => r.percentUsed >= 80);
  if (!warnings.length) return null;

  return (
    <div className="budgetAlerts" aria-label="Budget warnings">
      {warnings.map((row) => (
        <div className={row.isOverBudget ? "budgetAlert over" : "budgetAlert warning"} key={row.category}>
          <AlertTriangle size={16} />
          <span>
            <strong>{row.category}</strong>
            {row.isOverBudget
              ? ` is ${formatMoney(Math.abs(row.remaining), row.currency)} over your ${formatMoney(row.limit, row.currency)} limit`
              : ` is at ${row.percentUsed}% - ${formatMoney(row.remaining, row.currency)} left of ${formatMoney(row.limit, row.currency)}`}
          </span>
        </div>
      ))}
    </div>
  );
}

function BudgetTracker({
  rows,
  categories,
}: {
  rows: { id: string; category: string; limit: number; spent: number; remaining: number; currency: string; percentUsed: number; isOverBudget: boolean }[];
  categories: string[];
}) {
  return (
    <div className="budgetTracker">
      <form className="budgetForm" action={upsertBudget}>
        <label>
          <span>Category</span>
          <select name="category" required>
            <option value="">Choose category</option>
            {categories.map((category) => (
              <option key={category} value={category}>
                {category}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>Monthly limit</span>
          <input name="amount" type="number" min="1" step="1" placeholder="AED" required />
        </label>
        <button className="primaryButton" type="submit">
          Save
        </button>
      </form>

      <div className="budgetList">
        {rows.map((row) => (
          <article className={row.isOverBudget ? "budgetRow over" : "budgetRow"} key={row.id}>
            <div className="budgetTopline">
              <strong>{row.category}</strong>
              <span>{Math.max(0, row.percentUsed)}%</span>
            </div>
            <div className="budgetTrack">
              <span style={{ width: `${Math.min(row.percentUsed, 100)}%` }} />
            </div>
            <div className="budgetAmounts">
              <span>{formatMoney(row.spent, row.currency)} spent</span>
              <b>{row.isOverBudget ? `${formatMoney(Math.abs(row.remaining), row.currency)} over` : `${formatMoney(row.remaining, row.currency)} left`}</b>
            </div>
          </article>
        ))}
        {rows.length === 0 ? <p className="empty block">No budgets yet. Add your first monthly category limit.</p> : null}
      </div>
    </div>
  );
}

export default async function DashboardPage({ searchParams }: DashboardPageProps) {
  const filters = parseDashboardFilters((await searchParams) || {});
  const data = await getDashboardData(filters);
  const { metrics } = data;
  const activeParams = filtersToSearchParams(filters).toString();
  const budgetAtRisk = data.budgetProgress.filter((row) => row.percentUsed >= 80).length;
  const budgetLimitTotal = data.budgetProgress.reduce((sum, row) => sum + Number(row.limit || 0), 0);
  const budgetSpentTotal = data.budgetProgress.reduce((sum, row) => sum + Number(row.spent || 0), 0);
  const latestExpense = data.expenses[0];

  return (
    <main className="appShell">
      <aside className="sidebar" aria-label="Dashboard navigation">
        <div className="brandBlock">
          <div className="brandMark">
            <Sparkles size={22} />
          </div>
          <div>
            <strong>Assistant OS</strong>
            <span>Finance Command Center</span>
          </div>
        </div>
        <nav className="sideNav">
          <a href="#overview" className="active">
            <BarChart3 size={17} />
            Overview
          </a>
          <a href="#expenses">
            <WalletCards size={17} />
            Expenses
          </a>
          <a href="#tasks">
            <ClipboardList size={17} />
            Tasks
          </a>
          <a href="#activity">
            <Activity size={17} />
            Activity
          </a>
        </nav>
        <form action={logoutAction}>
          <button className="logoutButton" type="submit">
            <LogOut size={16} />
            Sign out
          </button>
        </form>
      </aside>

      <section className="dashboardShell">
        <header className="heroBar" id="overview">
          <div>
            <p className="eyebrow">Expenses & Budget Tracker</p>
            <h1>Premium finance cockpit for your Telegram assistant</h1>
            <p className="heroCopy">A live Supabase operating view for spend control, budget pressure, cards, tasks, and assistant activity.</p>
            <div className="heroStatus">
              <span>
                <ShieldCheck size={14} />
                Private dashboard
              </span>
              <span>
                <Gauge size={14} />
                {budgetAtRisk ? `${budgetAtRisk} budgets need attention` : "Budgets calm"}
              </span>
              <span>{latestExpense ? `Latest: ${latestExpense.merchant || "Unknown"} ${formatMoney(latestExpense.amount, latestExpense.currency)}` : "No expenses yet"}</span>
            </div>
          </div>
          <a className="refreshButton" href={activeParams ? `/?${activeParams}` : "/"} title="Refresh dashboard">
            <RefreshCw size={18} />
            <span>Refresh</span>
          </a>
        </header>

        <section className="metricsGrid" aria-label="Dashboard metrics">
          <MetricCard
            label="Filtered spend"
            value={formatMoney(metrics.filtered_expense_total, "AED")}
            detail={`${metrics.filtered_expense_count ?? 0} expenses in view`}
            icon={<CircleDollarSign size={20} />}
            tone="good"
          />
          <MetricCard
            label="Today spent"
            value={formatMoney(metrics.today_expense_total, "AED")}
            detail={`${metrics.today_expense_count ?? 0} entries today`}
            icon={<WalletCards size={20} />}
          />
          <MetricCard
            label="Average expense"
            value={formatMoney(metrics.average_expense, "AED")}
            detail={metrics.top_category ? `Top category: ${metrics.top_category}` : "No category leader"}
            icon={<ArrowDownRight size={20} />}
          />
          <MetricCard
            label="Budget pressure"
            value={budgetLimitTotal ? `${Math.round((budgetSpentTotal / budgetLimitTotal) * 100)}%` : "0%"}
            detail={budgetLimitTotal ? `${formatMoney(budgetSpentTotal, "AED")} of ${formatMoney(budgetLimitTotal, "AED")}` : "No monthly limits yet"}
            icon={<Timer size={20} />}
            tone={budgetAtRisk ? "warning" : "neutral"}
          />
        </section>

        <BudgetAlerts rows={data.budgetProgress} />

        <section className="filterPanel" aria-label="Expense filters">
          <div className="filterTitle">
            <Filter size={18} />
            <div>
              <strong>Control Plane</strong>
              <span>Filter the ledger without leaving the cockpit.</span>
            </div>
          </div>
          <form className="filterGrid">
            <label className="filterControl">
              <span>Period</span>
              <select name="period" defaultValue={filters.period}>
                {Object.entries(periodLabels).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <FilterSelect
              name="category"
              label="Category"
              value={filters.category}
              options={data.filterOptions.categories}
              allLabel="All categories"
            />
            <FilterSelect name="card" label="Card" value={filters.card} options={data.filterOptions.cards} allLabel="All cards" />
            <label className="filterControl searchControl">
              <span>Search</span>
              <div>
                <Search size={16} />
                <input name="q" defaultValue={filters.q} placeholder="Merchant, note, category" />
              </div>
            </label>
            <button className="primaryButton" type="submit">
              Apply
            </button>
            <a className="ghostButton" href="/">
              Reset
            </a>
          </form>
        </section>

        <div className="dashboardGrid">
          <section className="panel chartPanel">
            <div className="panelHeader">
              <div>
                <span className="sectionTag">Trend</span>
                <h2>Monthly Spend</h2>
                <p>Last six months from all tracked expenses</p>
              </div>
            </div>
            <MonthlyChart rows={data.monthlySpend} />
          </section>

          <section className="panel">
            <div className="panelHeader">
              <div>
                <span className="sectionTag">Mix</span>
                <h2>Category Mix</h2>
                <p>Filtered expense distribution</p>
              </div>
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

          <section className="panel span2" id="expenses">
            <div className="panelHeader">
              <div>
                <span className="sectionTag">Ledger</span>
                <h2>Expense Tracker</h2>
                <p>Filtered transaction ledger with quick cleanup controls</p>
              </div>
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
                    <th className="right">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {data.expenses.map((expense) => (
                    <tr key={expense.id}>
                      <td>{formatDate(expense.expense_date)}</td>
                      <td>
                        <strong>{expense.merchant || "Unknown"}</strong>
                        <small>{expense.notes || expense.source}</small>
                      </td>
                      <td>{expense.category}</td>
                      <td>{expense.card || expense.payment_method || "-"}</td>
                      <td className="right">{formatMoney(expense.amount, expense.currency)}</td>
                      <td className="right">
                        <form action={removeExpense}>
                          <input type="hidden" name="id" value={expense.id} />
                          <button className="iconButton danger" type="submit" title="Delete expense">
                            <Trash2 size={15} />
                          </button>
                        </form>
                      </td>
                    </tr>
                  ))}
                  {data.expenses.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="empty">
                        No expenses match these filters.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </section>

          <section className="panel" id="tasks">
            <div className="panelHeader">
              <div>
                <span className="sectionTag">Tasks</span>
                <h2>Open Tasks</h2>
                <p>Todos and reminders waiting on you</p>
              </div>
              <span>{data.tasks.length}</span>
            </div>
            <div className="taskList">
              {data.tasks.map((task) => (
                <article className="taskItem" key={task.id}>
                  <div>
                    <strong>{task.task}</strong>
                    <p>
                      {statusLabel(task.status)} - {priorityLabel(task.priority)}
                      {task.due_at ? ` - ${formatDateTime(task.due_at)}` : ""}
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
              <div>
                <span className="sectionTag">Cards</span>
                <h2>Card Spend</h2>
                <p>Payment method concentration</p>
              </div>
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

          <section className="panel">
            <div className="panelHeader">
              <div>
                <span className="sectionTag">Directory</span>
                <h2>Card Directory</h2>
                <p>Saved card names used by Telegram and filters</p>
              </div>
              <span>{data.cards.length}</span>
            </div>
            <CardDirectory cards={data.cards} />
          </section>

          <section className="panel span2">
            <div className="panelHeader">
              <div>
                <span className="sectionTag">Budgets</span>
                <h2>Budget Tracker</h2>
                <p>Monthly category limits against Telegram expenses</p>
              </div>
              <TrendingUp size={18} />
            </div>
            <BudgetTracker rows={data.budgetProgress} categories={data.filterOptions.categories} />
          </section>

          <section className="panel span2" id="activity">
            <div className="panelHeader">
              <div>
                <span className="sectionTag">Activity</span>
                <h2>Assistant Activity</h2>
                <p>Recent parser decisions and automation outcomes</p>
              </div>
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
      </section>
    </main>
  );
}
