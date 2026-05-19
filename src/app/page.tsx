import { revalidatePath } from "next/cache";
import {
  Activity,
  AlertTriangle,
  Bell,
  Bot,
  CalendarClock,
  Check,
  CreditCard,
  FileText,
  Filter,
  Lightbulb,
  ListChecks,
  LogOut,
  MoreHorizontal,
  Pencil,
  Plus,
  RefreshCw,
  Save,
  Search,
  ShieldCheck,
  Sparkles,
  Trash2,
  Wallet,
} from "lucide-react";
import { formatDate, formatDateTime, formatMoney, priorityLabel, statusLabel } from "@/lib/dashboard-format";
import { filtersToSearchParams, parseDashboardFilters, periodLabels } from "@/lib/dashboard-filters";
import {
  buildDashboardSummary,
  deleteCreditCardBill,
  deleteExpense,
  deleteIncomeStream,
  deleteNote,
  deleteReminder,
  deleteSubscription,
  deleteTodo,
  getDashboardData,
  markTaskDone,
  regenerateAIInsights,
  saveBudget,
  saveCreditCardBill,
  saveExpense,
  saveIncomeStream,
  saveNote,
  saveReminder,
  saveSubscription,
  saveTodo,
  snoozeReminder,
} from "@/lib/supabase-dashboard";
import type { AIInsight, CreditCardBill, Expense, IncomeStream, Note, Reminder, Subscription, Todo } from "@/lib/types";
import { logoutAction } from "./login/actions";

type DashboardPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

type DashboardTab = "overview" | "expenses" | "tasks" | "income" | "cards" | "reminders" | "notes" | "activities";

const dashboardTabs: Array<[DashboardTab, string, typeof Wallet]> = [
  ["overview", "Overview", Wallet],
  ["expenses", "Expenses", CreditCard],
  ["tasks", "Tasks", ListChecks],
  ["income", "Income", Wallet],
  ["cards", "Credit Cards", CreditCard],
  ["reminders", "Reminders", CalendarClock],
  ["notes", "Notes", FileText],
  ["activities", "Activities", Activity],
];

function singleParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function isDashboardTab(value: string | undefined): value is DashboardTab {
  return Boolean(value && dashboardTabs.some(([tab]) => tab === value));
}

async function completeTask(formData: FormData) {
  "use server";
  const id = String(formData.get("id") || "");
  if (id) await markTaskDone(id);
  revalidatePath("/");
}

async function upsertExpense(formData: FormData) {
  "use server";
  await saveExpense(formData);
  revalidatePath("/");
}

async function removeExpense(formData: FormData) {
  "use server";
  const id = String(formData.get("id") || "");
  if (id) await deleteExpense(id);
  revalidatePath("/");
}

async function upsertIncome(formData: FormData) {
  "use server";
  await saveIncomeStream(formData);
  revalidatePath("/");
}

async function removeIncome(formData: FormData) {
  "use server";
  const id = String(formData.get("id") || "");
  if (id) await deleteIncomeStream(id);
  revalidatePath("/");
}

async function upsertCreditCardBill(formData: FormData) {
  "use server";
  await saveCreditCardBill(formData);
  revalidatePath("/");
}

async function removeCreditCardBill(formData: FormData) {
  "use server";
  const id = String(formData.get("id") || "");
  if (id) await deleteCreditCardBill(id);
  revalidatePath("/");
}

async function upsertSubscription(formData: FormData) {
  "use server";
  await saveSubscription(formData);
  revalidatePath("/");
}

async function removeSubscription(formData: FormData) {
  "use server";
  const id = String(formData.get("id") || "");
  if (id) await deleteSubscription(id);
  revalidatePath("/");
}

async function upsertNote(formData: FormData) {
  "use server";
  await saveNote(formData);
  revalidatePath("/");
}

async function removeNote(formData: FormData) {
  "use server";
  const id = String(formData.get("id") || "");
  if (id) await deleteNote(id);
  revalidatePath("/");
}

async function upsertReminder(formData: FormData) {
  "use server";
  await saveReminder(formData);
  revalidatePath("/");
}

async function removeReminder(formData: FormData) {
  "use server";
  const id = String(formData.get("id") || "");
  if (id) await deleteReminder(id);
  revalidatePath("/");
}

async function snoozeReminderAction(formData: FormData) {
  "use server";
  const id = String(formData.get("id") || "");
  if (id) await snoozeReminder(id);
  revalidatePath("/");
}

async function upsertTodo(formData: FormData) {
  "use server";
  await saveTodo(formData);
  revalidatePath("/");
}

async function removeTodo(formData: FormData) {
  "use server";
  const id = String(formData.get("id") || "");
  if (id) await deleteTodo(id);
  revalidatePath("/");
}

async function refreshInsights(formData: FormData) {
  "use server";
  const filters = parseDashboardFilters({});
  const data = await getDashboardData(filters);
  await regenerateAIInsights(data);
  revalidatePath("/");
}

async function upsertBudget(formData: FormData) {
  "use server";
  const category = String(formData.get("category") || "").trim();
  const amount = Number(formData.get("amount") || 0);
  if (category && amount > 0) await saveBudget(category, amount);
  revalidatePath("/");
}

function Badge({ children, tone = "neutral" }: { children: React.ReactNode; tone?: "safe" | "watch" | "warning" | "urgent" | "neutral" }) {
  return <span className={`badge ${tone}`}>{children}</span>;
}

function MetricCard({ label, value, detail, icon, tone = "neutral" }: { label: string; value: string | number; detail: string; icon: React.ReactNode; tone?: string }) {
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

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
    </label>
  );
}

function DeleteConfirm({ id, action, label = "Delete permanently" }: { id: string; action: (formData: FormData) => Promise<void>; label?: string }) {
  return (
    <details className="confirmDelete">
      <summary>
        <Trash2 size={15} /> Danger
      </summary>
      <form action={action}>
        <input type="hidden" name="id" value={id} />
        <button className="dangerButton" type="submit">
          {label}
        </button>
      </form>
    </details>
  );
}

function EditFooter() {
  return (
    <div className="editFooter">
      <button className="ghostButton" type="reset">
        Cancel edits
      </button>
      <button className="primaryButton" type="submit">
        <Save size={15} /> Save changes
      </button>
    </div>
  );
}

function RowActions({
  id,
  deleteAction,
  children,
}: {
  id: string;
  deleteAction: (formData: FormData) => Promise<void>;
  children: React.ReactNode;
}) {
  return (
    <div className="rowActions">
      <details className="rowEditor">
        <summary>
          <Pencil size={15} /> Edit
        </summary>
        {children}
      </details>
      <details className="moreActions">
        <summary>
          <MoreHorizontal size={16} /> More
        </summary>
        <DeleteConfirm id={id} action={deleteAction} />
      </details>
    </div>
  );
}

function CashflowVisual({
  income,
  expenses,
  cardPayments,
  subscriptions,
  remaining,
  topCategories,
}: {
  income: number;
  expenses: number;
  cardPayments: number;
  subscriptions: number;
  remaining: number;
  topCategories: { category?: string; total_amount: string | number; currency: string }[];
}) {
  const outflow = expenses + cardPayments + subscriptions;
  const basis = Math.max(income, outflow, Math.abs(remaining), 1);
  const expensePercent = Math.min(100, Math.round((expenses / basis) * 100));
  const cardPercent = Math.min(100, Math.round((cardPayments / basis) * 100));
  const subscriptionPercent = Math.min(100, Math.round((subscriptions / basis) * 100));
  const remainingPercent = Math.min(100, Math.round((Math.max(remaining, 0) / basis) * 100));
  const totalCategory = Math.max(topCategories.reduce((sum, row) => sum + Number(row.total_amount || 0), 0), 1);
  let cursor = 0;
  const categoryStops = topCategories.slice(0, 5).map((row, index) => {
    const start = cursor;
    const width = (Number(row.total_amount || 0) / totalCategory) * 100;
    cursor += width;
    const colors = ["#087f68", "#245c9c", "#a86608", "#7c5b12", "#b42318"];
    return `${colors[index]} ${start}% ${cursor}%`;
  });
  const donut = topCategories.length ? `conic-gradient(${categoryStops.join(", ")})` : "conic-gradient(#d9d1c4 0 100%)";

  return (
    <section className="visualPanel" aria-label="Finance visualization">
      <div className="visualHeader">
        <div>
          <span className="sectionTag">KPI view</span>
          <h2>Cashflow & Spend Mix</h2>
          <p>Income, spending pressure, card payments, subscriptions, and top categories.</p>
        </div>
        <Badge tone={remaining < 0 ? "urgent" : remaining < income * 0.1 ? "warning" : "safe"}>{remaining < 0 ? "Shortfall" : "Funded"}</Badge>
      </div>
      <div className="visualGrid">
        <div className="kpiBars">
          {[
            ["Income", income, 100, "income"],
            ["Expenses", expenses, expensePercent, "expense"],
            ["Card payments", cardPayments, cardPercent, "cards"],
            ["Subscriptions", subscriptions, subscriptionPercent, "subs"],
            ["Remaining", remaining, remainingPercent, "remaining"],
          ].map(([label, value, percent, tone]) => (
            <div className="kpiBar" key={label as string}>
              <div>
                <strong>{label as string}</strong>
                <span>{formatMoney(value as number)}</span>
              </div>
              <div className="kpiTrack">
                <span className={tone as string} style={{ width: `${Math.max(remaining < 0 && label === "Remaining" ? 100 : 4, percent as number)}%` }} />
              </div>
            </div>
          ))}
        </div>
        <div className="donutWrap">
          <div className="donutChart" style={{ background: donut }}>
            <div>
              <strong>{formatMoney(expenses)}</strong>
              <span>Expenses</span>
            </div>
          </div>
          <div className="legendList">
            {topCategories.slice(0, 5).map((row, index) => (
              <span key={row.category || index}>
                <i className={`legendDot dot${index + 1}`} />
                {row.category || "Other"} {formatMoney(row.total_amount, row.currency)}
              </span>
            ))}
            {topCategories.length === 0 ? <span>No category data yet</span> : null}
          </div>
        </div>
      </div>
    </section>
  );
}

function ExpenseEditor({ expense }: { expense?: Expense }) {
  return (
    <form className="editGrid" action={upsertExpense}>
      <input type="hidden" name="id" value={expense?.id || ""} />
      <Field label="Amount">
        <input name="amount" type="number" min="0" step="0.01" defaultValue={expense ? Number(expense.amount) : ""} required />
      </Field>
      <Field label="Category">
        <input name="category" defaultValue={expense?.category || ""} required />
      </Field>
      <Field label="Date">
        <input name="expense_date" type="date" defaultValue={expense?.expense_date || new Date().toISOString().slice(0, 10)} required />
      </Field>
      <Field label="Merchant">
        <input name="merchant" defaultValue={expense?.merchant || ""} required />
      </Field>
      <Field label="Payment method">
        <input name="payment_method" defaultValue={expense?.payment_method || ""} />
      </Field>
      <Field label="Card">
        <input name="card" defaultValue={expense?.card || ""} />
      </Field>
      <Field label="Status">
        <select name="status" defaultValue={expense?.status || "posted"}>
          <option>posted</option>
          <option>pending</option>
          <option>review</option>
        </select>
      </Field>
      <Field label="Correction reason">
        <input name="correction_reason" defaultValue={expense?.correction_reason || ""} placeholder="Why you edited it" />
      </Field>
      <label className="field wide">
        <span>Notes</span>
        <textarea name="notes" defaultValue={expense?.notes || ""} />
      </label>
      <EditFooter />
    </form>
  );
}

function IncomeEditor({ row }: { row?: IncomeStream }) {
  return (
    <form className="editGrid" action={upsertIncome}>
      <input type="hidden" name="id" value={row?.id || ""} />
      <Field label="Source name">
        <input name="source_name" defaultValue={row?.source_name || ""} required />
      </Field>
      <Field label="Type">
        <select name="type" defaultValue={row?.type || "Salary"}>
          {["Salary", "Freelance", "Business", "Investment", "Other"].map((item) => (
            <option key={item}>{item}</option>
          ))}
        </select>
      </Field>
      <Field label="Amount">
        <input name="amount" type="number" min="0" step="0.01" defaultValue={row ? Number(row.amount) : ""} required />
      </Field>
      <Field label="Frequency">
        <select name="frequency" defaultValue={row?.frequency || "Monthly"}>
          {["Monthly", "Weekly", "One-time", "Custom"].map((item) => (
            <option key={item}>{item}</option>
          ))}
        </select>
      </Field>
      <Field label="Expected date">
        <input name="expected_date" type="date" defaultValue={row?.expected_date || new Date().toISOString().slice(0, 10)} required />
      </Field>
      <Field label="Status">
        <select name="status" defaultValue={row?.status || "Expected"}>
          {["Expected", "Received", "Late"].map((item) => (
            <option key={item}>{item}</option>
          ))}
        </select>
      </Field>
      <label className="field wide">
        <span>Notes</span>
        <textarea name="notes" defaultValue={row?.notes || ""} />
      </label>
      <EditFooter />
    </form>
  );
}

function BillEditor({ row }: { row?: CreditCardBill }) {
  return (
    <form className="editGrid" action={upsertCreditCardBill}>
      <input type="hidden" name="id" value={row?.id || ""} />
      <Field label="Card name">
        <input name="card_name" defaultValue={row?.card_name || ""} required />
      </Field>
      <Field label="Statement balance">
        <input name="statement_balance" type="number" min="0" step="0.01" defaultValue={row ? Number(row.statement_balance) : ""} required />
      </Field>
      <Field label="Minimum payment">
        <input name="minimum_payment" type="number" min="0" step="0.01" defaultValue={row ? Number(row.minimum_payment) : ""} required />
      </Field>
      <Field label="Due date">
        <input name="due_date" type="date" defaultValue={row?.due_date || new Date().toISOString().slice(0, 10)} required />
      </Field>
      <Field label="Status">
        <select name="payment_status" defaultValue={row?.payment_status || "Due"}>
          {["Due", "Paid", "Overdue", "Scheduled"].map((item) => (
            <option key={item}>{item}</option>
          ))}
        </select>
      </Field>
      <Field label="Priority">
        <select name="priority" defaultValue={row?.priority || "Normal"}>
          {["Low", "Normal", "High", "Urgent"].map((item) => (
            <option key={item}>{item}</option>
          ))}
        </select>
      </Field>
      <label className="checkField">
        <input name="autopay_enabled" type="checkbox" defaultChecked={row?.autopay_enabled || false} />
        Autopay enabled
      </label>
      <label className="field wide">
        <span>Notes</span>
        <textarea name="notes" defaultValue={row?.notes || ""} />
      </label>
      <EditFooter />
    </form>
  );
}

function SubscriptionEditor({ row }: { row?: Subscription }) {
  return (
    <form className="editGrid" action={upsertSubscription}>
      <input type="hidden" name="id" value={row?.id || ""} />
      <Field label="Subscription">
        <input name="subscription_name" defaultValue={row?.subscription_name || ""} required />
      </Field>
      <Field label="Category">
        <input name="category" defaultValue={row?.category || ""} required />
      </Field>
      <Field label="Amount">
        <input name="amount" type="number" min="0" step="0.01" defaultValue={row ? Number(row.amount) : ""} required />
      </Field>
      <Field label="Billing cycle">
        <select name="billing_cycle" defaultValue={row?.billing_cycle || "Monthly"}>
          {["Monthly", "Weekly", "Yearly", "Quarterly", "Custom"].map((item) => (
            <option key={item}>{item}</option>
          ))}
        </select>
      </Field>
      <Field label="Next billing date">
        <input name="next_billing_date" type="date" defaultValue={row?.next_billing_date || new Date().toISOString().slice(0, 10)} required />
      </Field>
      <Field label="Payment method">
        <input name="payment_method" defaultValue={row?.payment_method || ""} required />
      </Field>
      <Field label="Status">
        <select name="status" defaultValue={row?.status || "Active"}>
          {["Active", "Paused", "Cancelled", "Review"].map((item) => (
            <option key={item}>{item}</option>
          ))}
        </select>
      </Field>
      <label className="checkField">
        <input name="cancel_review_flag" type="checkbox" defaultChecked={row?.cancel_review_flag || false} />
        Review for cancel
      </label>
      <label className="field wide">
        <span>Notes</span>
        <textarea name="notes" defaultValue={row?.notes || ""} />
      </label>
      <EditFooter />
    </form>
  );
}

function NoteEditor({ row }: { row?: Note }) {
  return (
    <form className="editGrid" action={upsertNote}>
      <input type="hidden" name="id" value={row?.id || ""} />
      <Field label="Title">
        <input name="title" defaultValue={row?.title || ""} required />
      </Field>
      <Field label="Priority">
        <select name="priority" defaultValue={row?.priority || "Normal"}>
          {["Low", "Normal", "High", "Urgent"].map((item) => (
            <option key={item}>{item}</option>
          ))}
        </select>
      </Field>
      <Field label="Tags">
        <input name="tags" defaultValue={(row?.tags || []).join(", ")} placeholder="comma, separated" />
      </Field>
      <Field label="Linked type">
        <select name="linked_item_type" defaultValue={row?.linked_item_type || "general"}>
          {["general", "expense", "bill", "subscription", "reminder"].map((item) => (
            <option key={item}>{item}</option>
          ))}
        </select>
      </Field>
      <Field label="Linked ID">
        <input name="linked_item_id" defaultValue={row?.linked_item_id || ""} />
      </Field>
      <label className="field wide">
        <span>Body</span>
        <textarea name="body" defaultValue={row?.body || ""} required />
      </label>
      <EditFooter />
    </form>
  );
}

function ReminderEditor({ row }: { row?: Reminder }) {
  return (
    <form className="editGrid" action={upsertReminder}>
      <input type="hidden" name="id" value={row?.id || ""} />
      <Field label="Title">
        <input name="title" defaultValue={row?.title || ""} required />
      </Field>
      <Field label="Due date/time">
        <input name="due_at" type="datetime-local" defaultValue={row?.due_at?.slice(0, 16) || ""} required />
      </Field>
      <Field label="Priority">
        <select name="priority" defaultValue={row?.priority || "Normal"}>
          {["Low", "Normal", "High", "Urgent"].map((item) => (
            <option key={item}>{item}</option>
          ))}
        </select>
      </Field>
      <Field label="Status">
        <select name="status" defaultValue={row?.status || "Pending"}>
          {["Pending", "Done", "Snoozed", "Cancelled"].map((item) => (
            <option key={item}>{item}</option>
          ))}
        </select>
      </Field>
      <Field label="Source">
        <select name="source" defaultValue={row?.source || "Dashboard"}>
          {["Dashboard", "AI", "Telegram"].map((item) => (
            <option key={item}>{item}</option>
          ))}
        </select>
      </Field>
      <label className="field wide">
        <span>Description</span>
        <textarea name="description" defaultValue={row?.description || ""} />
      </label>
      <EditFooter />
    </form>
  );
}

function TodoEditor({ row }: { row?: Todo }) {
  return (
    <form className="editGrid" action={upsertTodo}>
      <input type="hidden" name="id" value={row?.id || ""} />
      <Field label="Task">
        <input name="task" defaultValue={row?.task || ""} required />
      </Field>
      <Field label="Due date/time">
        <input name="due_at" type="datetime-local" defaultValue={row?.due_at?.slice(0, 16) || ""} />
      </Field>
      <Field label="Priority">
        <select name="priority" defaultValue={row?.priority || "Normal"}>
          {["Low", "Normal", "High", "Urgent"].map((item) => (
            <option key={item}>{item}</option>
          ))}
        </select>
      </Field>
      <Field label="Status">
        <select name="status" defaultValue={row?.status || "Pending"}>
          {["Pending", "Done", "Snoozed", "Cancelled"].map((item) => (
            <option key={item}>{item}</option>
          ))}
        </select>
      </Field>
      <label className="field wide">
        <span>Notes</span>
        <textarea name="notes" defaultValue={row?.notes || ""} />
      </label>
      <EditFooter />
    </form>
  );
}

function AIInsightList({ insights }: { insights: AIInsight[] }) {
  return (
    <div className="insightList">
      {insights.map((insight) => (
        <article className={`insight ${insight.severity.toLowerCase()}`} key={insight.id}>
          <div>
            <Badge tone={insight.severity === "Critical" ? "urgent" : insight.severity === "Warning" ? "warning" : insight.severity === "Watch" ? "watch" : "safe"}>
              {insight.severity}
            </Badge>
            <span>{insight.category}</span>
          </div>
          <strong>{insight.title}</strong>
          <p>{insight.message}</p>
          <small>{insight.agent}</small>
        </article>
      ))}
      {insights.length === 0 ? <p className="empty block">No AI insights yet.</p> : null}
    </div>
  );
}

export default async function DashboardPage({ searchParams }: DashboardPageProps) {
  const rawParams = (await searchParams) || {};
  const filters = parseDashboardFilters(rawParams);
  const data = await getDashboardData(filters);
  const summary = buildDashboardSummary(data);
  const activeParams = filtersToSearchParams(filters).toString();
  const activityTypes = [...new Set(data.activities.map((activity) => activity.activity_type))].sort();
  const requestedTab = singleParam(rawParams.tab);
  const activeTab: DashboardTab = isDashboardTab(requestedTab) ? requestedTab : "overview";
  const tabHref = (tab: DashboardTab) => {
    const params = new URLSearchParams(activeParams);
    if (tab !== "overview") params.set("tab", tab);
    else params.delete("tab");
    const query = params.toString();
    return query ? `/?${query}` : "/";
  };

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
          {dashboardTabs.map(([tab, label, Icon]) => (
            <a href={tabHref(tab)} className={activeTab === tab ? "active" : ""} key={tab} aria-current={activeTab === tab ? "page" : undefined}>
              <Icon size={17} />
              {label}
            </a>
          ))}
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
            <p className="eyebrow">AI finance command center</p>
            <h1>Money, bills, tasks, and Telegram signals in one operating view</h1>
            <p className="heroCopy">AI summarizes and warns, but financial data only changes when you manually save a correction.</p>
            <div className="heroStatus">
              <Badge tone={summary.priorityLevel}>{summary.priorityLevel.toUpperCase()}</Badge>
              <span>
                <ShieldCheck size={14} />
                Private server-rendered dashboard
              </span>
              <span>{summary.highPriorityItemCount} high-priority items</span>
            </div>
          </div>
          <div className="heroActions">
            <form action={refreshInsights}>
              <button className="refreshButton" type="submit" title="Regenerate AI insights">
                <Bot size={18} />
                <span>Regenerate AI</span>
              </button>
            </form>
            <a className="refreshButton" href={activeParams ? `/?${activeParams}` : "/"} title="Refresh dashboard">
              <RefreshCw size={18} />
              <span>Refresh</span>
            </a>
          </div>
        </header>

        <nav className="tabRail" aria-label="Dashboard sections">
          {dashboardTabs.map(([tab, label, Icon]) => (
            <a href={tabHref(tab)} className={activeTab === tab ? "active" : ""} key={tab} aria-current={activeTab === tab ? "page" : undefined}>
              <Icon size={16} />
              <span>{label}</span>
            </a>
          ))}
        </nav>

        <section className="metricsGrid" aria-label="Monthly financial summary">
          <MetricCard label="Monthly income" value={formatMoney(summary.monthlyIncomeTotal)} detail={`${data.incomeStreams.length} income streams`} icon={<Wallet size={20} />} tone="good" />
          <MetricCard label="Monthly expenses" value={formatMoney(summary.monthlyExpenseTotal)} detail={`${data.expenses.length} expenses in view`} icon={<CreditCard size={20} />} />
          <MetricCard label="Card payments due" value={formatMoney(summary.monthlyCreditCardPaymentTotal)} detail={`${summary.upcomingBills.length} due within 7 days`} icon={<AlertTriangle size={20} />} tone={summary.overdueBills.length ? "urgent" : "warning"} />
          <MetricCard label="Projected remaining" value={formatMoney(summary.projectedRemainingBalance)} detail="Income - expenses - card payments" icon={<Lightbulb size={20} />} tone={summary.projectedRemainingBalance < 0 ? "urgent" : "good"} />
          <MetricCard label="Subscriptions" value={formatMoney(summary.monthlySubscriptionTotal)} detail={`${summary.upcomingSubscriptions.length} upcoming charges`} icon={<Bell size={20} />} />
          <MetricCard label="Upcoming reminders" value={data.reminders.filter((item) => item.status === "Pending").length} detail={`${summary.overdueReminders.length} overdue`} icon={<CalendarClock size={20} />} tone={summary.overdueReminders.length ? "urgent" : "neutral"} />
        </section>

        {activeTab === "overview" ? (
          <>
            <CashflowVisual
              income={summary.monthlyIncomeTotal}
              expenses={summary.monthlyExpenseTotal}
              cardPayments={summary.monthlyCreditCardPaymentTotal}
              subscriptions={summary.monthlySubscriptionTotal}
              remaining={summary.projectedRemainingBalance}
              topCategories={data.categoryBreakdown}
            />

            <section className="aiPanel" aria-label="AI assistant insights">
              <div className="panelHeader">
                <div>
                  <span className="sectionTag">AI layer</span>
                  <h2>Action-Focused Guidance</h2>
                  <p>{formatMoney(summary.monthlyIncomeTotal)} - {formatMoney(summary.monthlyExpenseTotal)} - {formatMoney(summary.monthlyCreditCardPaymentTotal)} = {formatMoney(summary.projectedRemainingBalance)}</p>
                </div>
                <Bot size={20} />
              </div>
              <AIInsightList insights={data.aiInsights} />
            </section>
          </>
        ) : null}

        {activeTab === "expenses" ? (
          <>
        <section className="filterPanel" aria-label="Expense filters">
          <div className="filterTitle">
            <Filter size={18} />
            <div>
              <strong>Ledger Filters</strong>
              <span>Filter by category, date range, card, and search text.</span>
            </div>
          </div>
          <form className="filterGrid">
            <Field label="Period">
              <select name="period" defaultValue={filters.period}>
                {Object.entries(periodLabels).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </Field>
            <Field label="From">
              <input name="from" type="date" defaultValue={filters.from} />
            </Field>
            <Field label="To">
              <input name="to" type="date" defaultValue={filters.to} />
            </Field>
            <Field label="Category">
              <select name="category" defaultValue={filters.category}>
                <option value="">All categories</option>
                {data.filterOptions.categories.map((category) => <option key={category}>{category}</option>)}
              </select>
            </Field>
            <label className="field searchField">
              <span>Search</span>
              <div>
                <Search size={16} />
                <input name="q" defaultValue={filters.q} placeholder="Merchant, note, category" />
              </div>
            </label>
            <button className="primaryButton" type="submit">Apply</button>
            <a className="ghostButton" href="/">Reset</a>
          </form>
        </section>

        <section className="panel" id="expenses">
          <div className="panelHeader">
            <div>
              <span className="sectionTag">Expenses</span>
              <h2>Editable Expense Ledger</h2>
              <p>Manual corrections are tracked and bad AI/import guesses stay reversible.</p>
            </div>
            <Badge>{data.expenses.length} rows</Badge>
          </div>
          <details className="addBlock">
            <summary><Plus size={16} /> Add expense</summary>
            <ExpenseEditor />
          </details>
          <div className="tableWrap">
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Merchant</th>
                  <th>Category</th>
                  <th>Method</th>
                  <th>Status</th>
                  <th className="right">Amount</th>
                  <th>Notes</th>
                  <th>Controls</th>
                </tr>
              </thead>
              <tbody>
                {data.expenses.map((expense) => (
                  <tr key={expense.id}>
                    <td>{formatDate(expense.expense_date)}</td>
                    <td><strong>{expense.merchant || "Unknown"}</strong>{expense.is_manually_corrected ? <Badge tone="watch">Manual correction</Badge> : null}</td>
                    <td>{expense.category || "Other"}</td>
                    <td>{expense.card || expense.payment_method || "-"}</td>
                    <td>{statusLabel(expense.status || "posted")}</td>
                    <td className="right">{formatMoney(expense.amount, expense.currency)}</td>
                    <td><small>{expense.notes || "-"}</small></td>
                    <td>
                      <RowActions id={expense.id} deleteAction={removeExpense}>
                        <ExpenseEditor expense={expense} />
                      </RowActions>
                    </td>
                  </tr>
                ))}
                {data.expenses.length === 0 ? <tr><td colSpan={8} className="empty">No expenses match these filters.</td></tr> : null}
              </tbody>
            </table>
          </div>
        </section>
          </>
        ) : null}

        <div className="dashboardGrid">
          {activeTab === "income" ? (
          <section className="panel span2" id="income">
            <div className="panelHeader">
              <div><span className="sectionTag">Income</span><h2>Income Streams</h2><p>Total selected month: {formatMoney(summary.monthlyIncomeTotal)}</p></div>
            </div>
            <details className="addBlock"><summary><Plus size={16} /> Add income</summary><IncomeEditor /></details>
            <div className="compactList">
              {data.incomeStreams.map((row) => (
                <article className="listItem" key={row.id}>
                  <div><strong>{row.source_name}</strong><p>{row.type} - {row.frequency} - {formatDate(row.expected_date)}</p></div>
                  <div className="itemActions"><Badge tone={row.status === "Late" ? "warning" : "safe"}>{row.status}</Badge><b>{formatMoney(row.amount, row.currency)}</b></div>
                  <RowActions id={row.id} deleteAction={removeIncome}><IncomeEditor row={row} /></RowActions>
                </article>
              ))}
              {data.incomeStreams.length === 0 ? <p className="empty block">No income streams yet.</p> : null}
            </div>
          </section>
          ) : null}

          {activeTab === "cards" ? (
          <section className="panel span2" id="cards">
            <div className="panelHeader">
              <div><span className="sectionTag">Credit cards</span><h2>Bill Due Table</h2><p>Total due this month: {formatMoney(summary.monthlyCreditCardPaymentTotal)}</p></div>
            </div>
            <details className="addBlock"><summary><Plus size={16} /> Add bill</summary><BillEditor /></details>
            <div className="compactList">
              {data.creditCardBills.map((row) => (
                <article className="listItem" key={row.id}>
                  <div><strong>{row.card_name}</strong><p>Due {formatDate(row.due_date)} - min {formatMoney(row.minimum_payment, row.currency)}{row.autopay_enabled ? " - autopay" : ""}</p></div>
                  <div className="itemActions"><Badge tone={row.payment_status === "Overdue" ? "urgent" : row.priority === "High" || row.priority === "Urgent" ? "warning" : "watch"}>{row.payment_status}</Badge><b>{formatMoney(row.statement_balance, row.currency)}</b></div>
                  <RowActions id={row.id} deleteAction={removeCreditCardBill}><BillEditor row={row} /></RowActions>
                </article>
              ))}
              {data.creditCardBills.length === 0 ? <p className="empty block">No credit card bills yet.</p> : null}
            </div>
          </section>
          ) : null}

          {activeTab === "overview" ? (
          <section className="panel" id="subscriptions">
            <div className="panelHeader">
              <div><span className="sectionTag">Subscriptions</span><h2>Subscription Watch</h2><p>Monthly total: {formatMoney(summary.monthlySubscriptionTotal)}</p></div>
            </div>
            <details className="addBlock"><summary><Plus size={16} /> Add subscription</summary><SubscriptionEditor /></details>
            <div className="compactList">
              {data.subscriptions.map((row) => (
                <article className="listItem" key={row.id}>
                  <div><strong>{row.subscription_name}</strong><p>{row.category} - {row.billing_cycle} - next {formatDate(row.next_billing_date)}</p></div>
                  <div className="itemActions"><Badge tone={row.cancel_review_flag ? "warning" : "safe"}>{row.cancel_review_flag ? "Review" : row.status}</Badge><b>{formatMoney(row.amount, row.currency)}</b></div>
                  <RowActions id={row.id} deleteAction={removeSubscription}><SubscriptionEditor row={row} /></RowActions>
                </article>
              ))}
              {data.subscriptions.length === 0 ? <p className="empty block">No subscriptions yet.</p> : null}
            </div>
          </section>
          ) : null}

          {activeTab === "reminders" ? (
          <section className="panel span2" id="reminders">
            <div className="panelHeader">
              <div><span className="sectionTag">Productivity</span><h2>Reminders</h2><p>{summary.overdueReminders.length} overdue reminders</p></div>
            </div>
            <details className="addBlock"><summary><Plus size={16} /> Add reminder</summary><ReminderEditor /></details>
            <div className="compactList">
              {data.reminders.map((row) => (
                <article className="listItem" key={row.id}>
                  <div><strong>{row.title}</strong><p>{formatDateTime(row.due_at)} - {row.source}</p></div>
                  <div className="itemActions"><Badge tone={row.priority === "Urgent" ? "urgent" : row.priority === "High" ? "warning" : "watch"}>{row.status}</Badge></div>
                  <form action={snoozeReminderAction}><input type="hidden" name="id" value={row.id} /><button className="iconButton" type="submit" title="Snooze"><Bell size={15} /></button></form>
                  <RowActions id={row.id} deleteAction={removeReminder}><ReminderEditor row={row} /></RowActions>
                </article>
              ))}
              {!data.reminders.length ? <p className="empty block">No reminders yet.</p> : null}
            </div>
          </section>
          ) : null}

          {activeTab === "notes" ? (
          <section className="panel span2" id="notes">
            <div className="panelHeader">
              <div><span className="sectionTag">Notes</span><h2>Notes & Linked Context</h2><p>Prepared for dashboard and Telegram-created notes.</p></div>
            </div>
            <details className="addBlock"><summary><Plus size={16} /> Add note</summary><NoteEditor /></details>
            <div className="compactList">
              {data.notes.map((row) => (
                <article className="listItem" key={row.id}>
                  <div><strong>{row.title}</strong><p>{row.body}</p><small>{(row.tags || []).join(", ") || "No tags"} - {row.linked_item_type}</small></div>
                  <Badge tone={row.priority === "Urgent" ? "urgent" : row.priority === "High" ? "warning" : "neutral"}>{row.priority}</Badge>
                  <RowActions id={row.id} deleteAction={removeNote}><NoteEditor row={row} /></RowActions>
                </article>
              ))}
              {data.notes.length === 0 ? <p className="empty block">No notes yet.</p> : null}
            </div>
          </section>
          ) : null}

          {activeTab === "activities" ? (
          <section className="panel span2" id="activities">
            <div className="panelHeader">
              <div><span className="sectionTag">Activity</span><h2>Activity Feed</h2><p>Clean audit trail for edits, reminders, AI warnings, and Telegram actions.</p></div>
              <details className="activityToggle" open><summary>Show / hide</summary></details>
            </div>
            <form className="activityFilters">
              <input type="hidden" name="period" value={filters.period} />
              <Field label="Activity type">
                <select name="activityType" defaultValue={filters.activityType}>
                  <option value="">All activity</option>
                  {activityTypes.map((type) => <option key={type}>{type}</option>)}
                </select>
              </Field>
              <button className="ghostButton" type="submit">Filter</button>
            </form>
            <details className="activityBody" open>
              <summary><Activity size={16} /> Activity log</summary>
              <div className="logList">
                {data.activities.map((activity) => (
                  <article className="logItem" key={activity.id}>
                    <div><strong>{activity.title}</strong><Badge>{activity.activity_type}</Badge></div>
                    <p>{activity.description || activity.source}</p>
                    <time>{formatDateTime(activity.created_at)}</time>
                  </article>
                ))}
                {data.activities.length === 0 ? <p className="empty block">No activity yet.</p> : null}
              </div>
            </details>
          </section>
          ) : null}

          {activeTab === "tasks" ? (
          <section className="panel span2">
            <div className="panelHeader">
              <div><span className="sectionTag">Tasks</span><h2>Todos, Budget Limits & Open Tasks</h2><p>Work queue, quick budget limits, and legacy open tasks.</p></div>
              <ListChecks size={18} />
            </div>
            <div className="utilityGrid">
              <form className="budgetForm" action={upsertBudget}>
                <Field label="Category"><select name="category" required><option value="">Choose category</option>{data.filterOptions.categories.map((category) => <option key={category}>{category}</option>)}</select></Field>
                <Field label="Monthly limit"><input name="amount" type="number" min="1" step="1" placeholder="AED" required /></Field>
                <button className="primaryButton" type="submit">Save budget</button>
              </form>
              <div className="compactList">
                <details className="addBlock taskAdd"><summary><Plus size={16} /> Add todo</summary><TodoEditor /></details>
                {data.todos.map((row) => (
                  <article className="listItem" key={row.id}>
                    <div><strong>{row.task}</strong><p>{row.due_at ? formatDateTime(row.due_at) : "No due date"} - {row.source}</p></div>
                    <div className="itemActions"><Badge>{row.status}</Badge></div>
                    <RowActions id={row.id} deleteAction={removeTodo}><TodoEditor row={row} /></RowActions>
                  </article>
                ))}
                {data.tasks.map((task) => (
                  <article className="listItem" key={task.id}>
                    <div><strong>{task.task}</strong><p>{statusLabel(task.status)} - {priorityLabel(task.priority)}{task.due_at ? ` - ${formatDateTime(task.due_at)}` : ""}</p></div>
                    <form action={completeTask}><input type="hidden" name="id" value={task.id} /><button className="iconButton" type="submit" title="Mark done"><Check size={16} /></button></form>
                  </article>
                ))}
                {!data.todos.length && data.tasks.length === 0 ? <p className="empty block">No tasks yet.</p> : null}
              </div>
            </div>
          </section>
          ) : null}
        </div>
      </section>
    </main>
  );
}
