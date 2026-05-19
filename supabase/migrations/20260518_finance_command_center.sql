alter table assistant.expenses
  add column if not exists user_id uuid,
  add column if not exists status text not null default 'posted',
  add column if not exists is_manually_corrected boolean not null default false,
  add column if not exists corrected_at timestamptz,
  add column if not exists correction_reason text,
  add column if not exists corrected_fields text[] not null default '{}'::text[],
  add column if not exists updated_at timestamptz not null default now();

alter table assistant.tasks
  add column if not exists user_id uuid,
  add column if not exists source text not null default 'Dashboard',
  add column if not exists linked_item_type text,
  add column if not exists linked_item_id uuid,
  add column if not exists updated_at timestamptz not null default now();

alter table assistant.tasks
  drop constraint if exists tasks_status_check,
  add constraint tasks_status_check check (status in ('open', 'sent', 'done', 'cancelled', 'snoozed'));

alter table assistant.tasks
  drop constraint if exists tasks_priority_check,
  add constraint tasks_priority_check check (priority in ('low', 'normal', 'high', 'urgent'));

create or replace function assistant.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists touch_expense_updated_at on assistant.expenses;
create trigger touch_expense_updated_at
before update on assistant.expenses
for each row
execute function assistant.touch_updated_at();

drop trigger if exists touch_task_updated_at on assistant.tasks;
create trigger touch_task_updated_at
before update on assistant.tasks
for each row
execute function assistant.touch_updated_at();

create table if not exists assistant.income_streams (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  source_name text not null check (length(trim(source_name)) > 0),
  type text not null check (type in ('Salary', 'Freelance', 'Business', 'Investment', 'Other')),
  amount numeric(12, 2) not null check (amount >= 0),
  currency text not null default 'AED',
  frequency text not null check (frequency in ('Monthly', 'Weekly', 'One-time', 'Custom')),
  expected_date date not null,
  status text not null default 'Expected' check (status in ('Expected', 'Received', 'Late')),
  notes text,
  source text not null default 'Dashboard',
  is_manually_corrected boolean not null default false,
  corrected_at timestamptz,
  correction_reason text,
  corrected_fields text[] not null default '{}'::text[],
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists assistant.credit_card_bills (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  card_name text not null check (length(trim(card_name)) > 0),
  statement_balance numeric(12, 2) not null default 0 check (statement_balance >= 0),
  minimum_payment numeric(12, 2) not null default 0 check (minimum_payment >= 0),
  currency text not null default 'AED',
  due_date date not null,
  autopay_enabled boolean not null default false,
  payment_status text not null default 'Due' check (payment_status in ('Due', 'Paid', 'Overdue', 'Scheduled')),
  priority text not null default 'Normal' check (priority in ('Low', 'Normal', 'High', 'Urgent')),
  notes text,
  source text not null default 'Dashboard',
  is_manually_corrected boolean not null default false,
  corrected_at timestamptz,
  correction_reason text,
  corrected_fields text[] not null default '{}'::text[],
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists assistant.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  subscription_name text not null check (length(trim(subscription_name)) > 0),
  category text not null default 'Other',
  amount numeric(12, 2) not null default 0 check (amount >= 0),
  currency text not null default 'AED',
  billing_cycle text not null default 'Monthly' check (billing_cycle in ('Monthly', 'Weekly', 'Yearly', 'Quarterly', 'Custom')),
  next_billing_date date not null,
  payment_method text not null default 'Card',
  status text not null default 'Active' check (status in ('Active', 'Paused', 'Cancelled', 'Review')),
  cancel_review_flag boolean not null default false,
  notes text,
  source text not null default 'Dashboard',
  is_manually_corrected boolean not null default false,
  corrected_at timestamptz,
  correction_reason text,
  corrected_fields text[] not null default '{}'::text[],
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists assistant.reminders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  title text not null check (length(trim(title)) > 0),
  description text,
  due_at timestamptz not null,
  priority text not null default 'Normal' check (priority in ('Low', 'Normal', 'High', 'Urgent')),
  status text not null default 'Pending' check (status in ('Pending', 'Done', 'Snoozed', 'Cancelled')),
  source text not null default 'Dashboard',
  linked_item_type text,
  linked_item_id uuid,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists assistant.notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  title text not null check (length(trim(title)) > 0),
  body text not null,
  tags text[] not null default '{}'::text[],
  priority text not null default 'Normal' check (priority in ('Low', 'Normal', 'High', 'Urgent')),
  linked_item_type text not null default 'general',
  linked_item_id uuid,
  source text not null default 'Dashboard',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists assistant.todos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  task text not null check (length(trim(task)) > 0),
  status text not null default 'Pending' check (status in ('Pending', 'Done', 'Snoozed', 'Cancelled')),
  priority text not null default 'Normal' check (priority in ('Low', 'Normal', 'High', 'Urgent')),
  due_at timestamptz,
  source text not null default 'Dashboard',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists assistant.activity_logs (
  id bigserial primary key,
  user_id uuid,
  activity_type text not null,
  title text not null,
  description text,
  source text not null default 'Dashboard',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists assistant.ai_insights (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  agent text not null,
  category text not null check (category in ('Summary', 'Suggestions', 'Warnings', 'Priority actions', 'Data corrections needed')),
  severity text not null check (severity in ('Info', 'Watch', 'Warning', 'Critical')),
  title text not null,
  message text not null,
  action_label text,
  linked_item_type text,
  linked_item_id uuid,
  source text not null default 'LocalRulesEngine',
  created_at timestamptz not null default now()
);

create index if not exists income_streams_expected_date_idx on assistant.income_streams (expected_date, status);
create index if not exists credit_card_bills_due_idx on assistant.credit_card_bills (due_date, payment_status);
create index if not exists subscriptions_next_billing_idx on assistant.subscriptions (next_billing_date, status);
create index if not exists reminders_due_idx on assistant.reminders (due_at, status);
create index if not exists notes_updated_idx on assistant.notes (updated_at desc);
create index if not exists todos_due_idx on assistant.todos (due_at, status);
create index if not exists activity_logs_created_idx on assistant.activity_logs (created_at desc, activity_type);
create index if not exists ai_insights_created_idx on assistant.ai_insights (created_at desc, severity);

alter table assistant.income_streams enable row level security;
alter table assistant.credit_card_bills enable row level security;
alter table assistant.subscriptions enable row level security;
alter table assistant.reminders enable row level security;
alter table assistant.notes enable row level security;
alter table assistant.todos enable row level security;
alter table assistant.activity_logs enable row level security;
alter table assistant.ai_insights enable row level security;

drop policy if exists "service role manages income streams" on assistant.income_streams;
drop policy if exists "service role manages credit card bills" on assistant.credit_card_bills;
drop policy if exists "service role manages subscriptions" on assistant.subscriptions;
drop policy if exists "service role manages reminders" on assistant.reminders;
drop policy if exists "service role manages notes" on assistant.notes;
drop policy if exists "service role manages todos" on assistant.todos;
drop policy if exists "service role manages activity logs" on assistant.activity_logs;
drop policy if exists "service role manages ai insights" on assistant.ai_insights;

create policy "service role manages income streams" on assistant.income_streams for all to service_role using (true) with check (true);
create policy "service role manages credit card bills" on assistant.credit_card_bills for all to service_role using (true) with check (true);
create policy "service role manages subscriptions" on assistant.subscriptions for all to service_role using (true) with check (true);
create policy "service role manages reminders" on assistant.reminders for all to service_role using (true) with check (true);
create policy "service role manages notes" on assistant.notes for all to service_role using (true) with check (true);
create policy "service role manages todos" on assistant.todos for all to service_role using (true) with check (true);
create policy "service role manages activity logs" on assistant.activity_logs for all to service_role using (true) with check (true);
create policy "service role manages ai insights" on assistant.ai_insights for all to service_role using (true) with check (true);

drop trigger if exists touch_income_stream_updated_at on assistant.income_streams;
create trigger touch_income_stream_updated_at before update on assistant.income_streams for each row execute function assistant.touch_updated_at();

drop trigger if exists touch_credit_card_bill_updated_at on assistant.credit_card_bills;
create trigger touch_credit_card_bill_updated_at before update on assistant.credit_card_bills for each row execute function assistant.touch_updated_at();

drop trigger if exists touch_subscription_updated_at on assistant.subscriptions;
create trigger touch_subscription_updated_at before update on assistant.subscriptions for each row execute function assistant.touch_updated_at();

drop trigger if exists touch_reminder_updated_at on assistant.reminders;
create trigger touch_reminder_updated_at before update on assistant.reminders for each row execute function assistant.touch_updated_at();

drop trigger if exists touch_note_updated_at on assistant.notes;
create trigger touch_note_updated_at before update on assistant.notes for each row execute function assistant.touch_updated_at();

drop trigger if exists touch_todo_updated_at on assistant.todos;
create trigger touch_todo_updated_at before update on assistant.todos for each row execute function assistant.touch_updated_at();

create or replace view public.assistant_expenses
with (security_invoker = true) as
select * from assistant.expenses;

create or replace view public.assistant_tasks
with (security_invoker = true) as
select * from assistant.tasks;

create or replace view public.assistant_income_streams
with (security_invoker = true) as
select * from assistant.income_streams;

create or replace view public.assistant_credit_card_bills
with (security_invoker = true) as
select * from assistant.credit_card_bills;

create or replace view public.assistant_subscriptions
with (security_invoker = true) as
select * from assistant.subscriptions;

create or replace view public.assistant_reminders
with (security_invoker = true) as
select * from assistant.reminders;

create or replace view public.assistant_notes
with (security_invoker = true) as
select * from assistant.notes;

create or replace view public.assistant_todos
with (security_invoker = true) as
select * from assistant.todos;

create or replace view public.assistant_activity_logs
with (security_invoker = true) as
select * from assistant.activity_logs;

create or replace view public.assistant_ai_insights
with (security_invoker = true) as
select * from assistant.ai_insights;

grant select, insert, update, delete on assistant.income_streams to service_role;
grant select, insert, update, delete on assistant.credit_card_bills to service_role;
grant select, insert, update, delete on assistant.subscriptions to service_role;
grant select, insert, update, delete on assistant.reminders to service_role;
grant select, insert, update, delete on assistant.notes to service_role;
grant select, insert, update, delete on assistant.todos to service_role;
grant select, insert, update, delete on assistant.activity_logs to service_role;
grant select, insert, update, delete on assistant.ai_insights to service_role;
grant select, insert, update, delete on public.assistant_income_streams to service_role;
grant select, insert, update, delete on public.assistant_credit_card_bills to service_role;
grant select, insert, update, delete on public.assistant_subscriptions to service_role;
grant select, insert, update, delete on public.assistant_reminders to service_role;
grant select, insert, update, delete on public.assistant_notes to service_role;
grant select, insert, update, delete on public.assistant_todos to service_role;
grant select, insert, update, delete on public.assistant_activity_logs to service_role;
grant select, insert, update, delete on public.assistant_ai_insights to service_role;
grant usage, select on all sequences in schema assistant to service_role;
