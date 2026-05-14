create extension if not exists vector;
create extension if not exists pgcrypto;

create schema if not exists assistant;

create table if not exists assistant.expenses (
  id uuid primary key default gen_random_uuid(),
  expense_date date not null default current_date,
  merchant text,
  amount numeric(12, 2) not null check (amount >= 0),
  currency text not null default 'AED',
  category text not null default 'Other',
  payment_method text,
  card text,
  notes text,
  source text not null default 'telegram',
  confidence numeric(4, 3) check (confidence is null or (confidence >= 0 and confidence <= 1)),
  raw_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists assistant.tasks (
  id uuid primary key default gen_random_uuid(),
  task text not null,
  type text not null default 'todo' check (type in ('todo', 'reminder')),
  status text not null default 'open' check (status in ('open', 'sent', 'done', 'cancelled')),
  priority text not null default 'normal' check (priority in ('low', 'normal', 'high')),
  due_at timestamptz,
  notes text,
  raw_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create table if not exists assistant.logs (
  id bigserial primary key,
  workflow text not null,
  chat_id text,
  raw_input text,
  intent text,
  parsed_json jsonb,
  status text not null,
  message text,
  missing_fields text[],
  execution_source text,
  created_at timestamptz not null default now()
);

create table if not exists assistant.preferences (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

create table if not exists assistant.recurring_expenses (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  merchant text,
  amount numeric(12, 2),
  currency text not null default 'AED',
  category text not null default 'Other',
  payment_method text,
  card text,
  cadence text not null check (cadence in ('daily', 'weekly', 'monthly', 'yearly')),
  next_due_at timestamptz,
  active boolean not null default true,
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists assistant.recurring_tasks (
  id uuid primary key default gen_random_uuid(),
  task text not null,
  priority text not null default 'normal' check (priority in ('low', 'normal', 'high')),
  cadence text not null check (cadence in ('daily', 'weekly', 'monthly', 'yearly')),
  next_due_at timestamptz,
  active boolean not null default true,
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists assistant.memories (
  id uuid primary key default gen_random_uuid(),
  memory_type text not null,
  content text not null,
  metadata jsonb not null default '{}'::jsonb,
  embedding vector(1536),
  created_at timestamptz not null default now()
);

create table if not exists assistant.weekly_reviews (
  id uuid primary key default gen_random_uuid(),
  week_start date not null,
  week_end date not null,
  expense_total numeric(12, 2) not null default 0,
  completed_tasks integer not null default 0,
  pending_tasks integer not null default 0,
  review text not null,
  raw_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists expenses_date_idx on assistant.expenses (expense_date desc);
create index if not exists expenses_category_idx on assistant.expenses (category);
create index if not exists expenses_card_idx on assistant.expenses (card) where card is not null;
create index if not exists tasks_status_due_idx on assistant.tasks (status, due_at);
create index if not exists tasks_created_idx on assistant.tasks (created_at desc);
create index if not exists logs_created_idx on assistant.logs (created_at desc);
create index if not exists memories_type_created_idx on assistant.memories (memory_type, created_at desc);
create index if not exists memories_embedding_idx on assistant.memories using ivfflat (embedding vector_cosine_ops) with (lists = 100);

alter table assistant.expenses enable row level security;
alter table assistant.tasks enable row level security;
alter table assistant.logs enable row level security;
alter table assistant.preferences enable row level security;
alter table assistant.recurring_expenses enable row level security;
alter table assistant.recurring_tasks enable row level security;
alter table assistant.memories enable row level security;
alter table assistant.weekly_reviews enable row level security;

drop policy if exists "service role manages expenses" on assistant.expenses;
drop policy if exists "service role manages tasks" on assistant.tasks;
drop policy if exists "service role manages logs" on assistant.logs;
drop policy if exists "service role manages preferences" on assistant.preferences;
drop policy if exists "service role manages recurring expenses" on assistant.recurring_expenses;
drop policy if exists "service role manages recurring tasks" on assistant.recurring_tasks;
drop policy if exists "service role manages memories" on assistant.memories;
drop policy if exists "service role manages weekly reviews" on assistant.weekly_reviews;

create policy "service role manages expenses" on assistant.expenses for all to service_role using (true) with check (true);
create policy "service role manages tasks" on assistant.tasks for all to service_role using (true) with check (true);
create policy "service role manages logs" on assistant.logs for all to service_role using (true) with check (true);
create policy "service role manages preferences" on assistant.preferences for all to service_role using (true) with check (true);
create policy "service role manages recurring expenses" on assistant.recurring_expenses for all to service_role using (true) with check (true);
create policy "service role manages recurring tasks" on assistant.recurring_tasks for all to service_role using (true) with check (true);
create policy "service role manages memories" on assistant.memories for all to service_role using (true) with check (true);
create policy "service role manages weekly reviews" on assistant.weekly_reviews for all to service_role using (true) with check (true);

insert into assistant.preferences (key, value)
values
  ('timezone', '"Asia/Dubai"'::jsonb),
  ('default_currency', '"AED"'::jsonb),
  ('categories', '["Food","Transport","Groceries","Bills","Shopping","Business","Health","Entertainment","Travel","Trading","Other"]'::jsonb)
on conflict (key) do update
set value = excluded.value,
    updated_at = now();

