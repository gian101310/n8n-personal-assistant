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
  user_id?: string | null;
  expense_date: string;
  merchant: string | null;
  amount: string | number;
  currency: string;
  category: string;
  payment_method: string | null;
  card: string | null;
  status?: string | null;
  notes: string | null;
  source: string;
  is_manually_corrected?: boolean;
  corrected_at?: string | null;
  correction_reason?: string | null;
  corrected_fields?: string[] | null;
  created_at: string;
  updated_at?: string;
};

export type Task = {
  id: string;
  user_id?: string | null;
  task: string;
  type: "todo" | "reminder";
  status: "open" | "sent" | "done" | "cancelled" | "snoozed";
  priority: "low" | "normal" | "high" | "urgent";
  due_at: string | null;
  notes: string | null;
  source?: "Dashboard" | "AI" | "Telegram" | string;
  linked_item_type?: string | null;
  linked_item_id?: string | null;
  created_at: string;
  updated_at?: string;
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

export type Budget = {
  id: string;
  category: string;
  amount: string | number;
  currency: string;
  period: "monthly";
  active: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type BudgetProgress = {
  id: string;
  category: string;
  limit: number;
  spent: number;
  remaining: number;
  currency: string;
  percentUsed: number;
  isOverBudget: boolean;
};

export type ManualCorrectionFields = {
  is_manually_corrected: boolean;
  corrected_at: string | null;
  correction_reason: string | null;
  corrected_fields: string[] | null;
};

export type IncomeStream = ManualCorrectionFields & {
  id: string;
  user_id: string | null;
  source_name: string;
  type: "Salary" | "Freelance" | "Business" | "Investment" | "Other";
  amount: string | number;
  currency: string;
  frequency: "Monthly" | "Weekly" | "One-time" | "Custom";
  expected_date: string;
  status: "Expected" | "Received" | "Late";
  notes: string | null;
  source: "Dashboard" | "AI" | "Telegram" | string;
  created_at: string;
  updated_at: string;
};

export type CreditCardBill = ManualCorrectionFields & {
  id: string;
  user_id: string | null;
  card_name: string;
  statement_balance: string | number;
  minimum_payment: string | number;
  currency: string;
  due_date: string;
  autopay_enabled: boolean;
  payment_status: "Due" | "Paid" | "Overdue" | "Scheduled";
  priority: "Low" | "Normal" | "High" | "Urgent";
  notes: string | null;
  source: "Dashboard" | "AI" | "Telegram" | string;
  created_at: string;
  updated_at: string;
};

export type Subscription = ManualCorrectionFields & {
  id: string;
  user_id: string | null;
  subscription_name: string;
  category: string;
  amount: string | number;
  currency: string;
  billing_cycle: "Monthly" | "Weekly" | "Yearly" | "Quarterly" | "Custom";
  next_billing_date: string;
  payment_method: string;
  status: "Active" | "Paused" | "Cancelled" | "Review";
  cancel_review_flag: boolean;
  notes: string | null;
  source: "Dashboard" | "AI" | "Telegram" | string;
  created_at: string;
  updated_at: string;
};

export type Reminder = {
  id: string;
  user_id: string | null;
  title: string;
  description: string | null;
  due_at: string;
  priority: "Low" | "Normal" | "High" | "Urgent";
  status: "Pending" | "Done" | "Snoozed" | "Cancelled";
  source: "Dashboard" | "AI" | "Telegram" | string;
  linked_item_type: string | null;
  linked_item_id: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type Note = {
  id: string;
  user_id: string | null;
  title: string;
  body: string;
  tags: string[] | null;
  priority: "Low" | "Normal" | "High" | "Urgent";
  linked_item_type: "expense" | "bill" | "subscription" | "reminder" | "general" | string;
  linked_item_id: string | null;
  source: "Dashboard" | "AI" | "Telegram" | string;
  created_at: string;
  updated_at: string;
};

export type Todo = {
  id: string;
  user_id: string | null;
  task: string;
  status: "Pending" | "Done" | "Snoozed" | "Cancelled";
  priority: "Low" | "Normal" | "High" | "Urgent";
  due_at: string | null;
  source: "Dashboard" | "AI" | "Telegram" | string;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type ActivityLog = {
  id: string | number;
  user_id?: string | null;
  activity_type: string;
  title: string;
  description: string | null;
  source: "Dashboard" | "AI" | "Telegram" | string;
  metadata?: Record<string, unknown> | null;
  created_at: string;
};

export type AIInsight = {
  id: string;
  agent: string;
  category: "Summary" | "Suggestions" | "Warnings" | "Priority actions" | "Data corrections needed";
  severity: "Info" | "Watch" | "Warning" | "Critical";
  title: string;
  message: string;
  action_label?: string | null;
  linked_item_type?: string | null;
  linked_item_id?: string | null;
  created_at: string;
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

export type WeeklyReview = {
  id: string;
  week_start: string;
  week_end: string;
  expense_total: string | number;
  completed_tasks: number;
  pending_tasks: number;
  review: string;
  created_at: string;
};

export type DashboardData = {
  metrics: DashboardMetrics;
  expenses: Expense[];
  incomeStreams: IncomeStream[];
  creditCardBills: CreditCardBill[];
  subscriptions: Subscription[];
  reminders: Reminder[];
  notes: Note[];
  todos: Todo[];
  activities: ActivityLog[];
  aiInsights: AIInsight[];
  tasks: Task[];
  categoryBreakdown: BreakdownRow[];
  cardBreakdown: BreakdownRow[];
  cards: AssistantCard[];
  budgets: Budget[];
  budgetProgress: BudgetProgress[];
  monthlySpend: MonthlySpend[];
  weeklyReviews: WeeklyReview[];
  filterOptions: FilterOptions;
  logs: LogRow[];
};
