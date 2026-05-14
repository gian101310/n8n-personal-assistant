export type DashboardMetrics = {
  today_expense_total: string | number | null;
  today_expense_count: number | null;
  filtered_expense_total?: string | number | null;
  filtered_expense_count?: number | null;
  average_expense?: string | number | null;
  top_category?: string | null;
  top_card?: string | null;
  open_task_count: number | null;
  completed_today_count: number | null;
  due_reminder_count: number | null;
};

export type Expense = {
  id: string;
  expense_date: string;
  merchant: string | null;
  amount: string | number;
  currency: string;
  category: string;
  payment_method: string | null;
  card: string | null;
  notes: string | null;
  source: string;
  created_at: string;
};

export type Task = {
  id: string;
  task: string;
  type: "todo" | "reminder";
  status: "open" | "sent" | "done" | "cancelled";
  priority: "low" | "normal" | "high";
  due_at: string | null;
  notes: string | null;
  created_at: string;
  completed_at: string | null;
};

export type BreakdownRow = {
  category?: string;
  card?: string;
  currency: string;
  expense_count: number;
  total_amount: string | number;
  latest_expense_date: string | null;
};

export type LogRow = {
  id: number;
  workflow: string;
  raw_input: string | null;
  intent: string | null;
  status: string;
  message: string | null;
  execution_source: string | null;
  created_at: string;
};

export type MonthlySpend = {
  label: string;
  total: number;
};

export type AssistantCard = {
  id: string;
  name: string;
  kind: "debit" | "credit" | "other";
  issuer: string | null;
  active: boolean;
  source: string;
  notes: string | null;
  created_at: string;
};

export type FilterOptions = {
  categories: string[];
  cards: string[];
  merchants: string[];
};

export type DashboardData = {
  metrics: DashboardMetrics;
  expenses: Expense[];
  tasks: Task[];
  categoryBreakdown: BreakdownRow[];
  cardBreakdown: BreakdownRow[];
  cards: AssistantCard[];
  monthlySpend: MonthlySpend[];
  filterOptions: FilterOptions;
  logs: LogRow[];
};
