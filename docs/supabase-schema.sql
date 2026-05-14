-- Future Supabase migration for the Telegram personal assistant.
-- Run this after creating a Supabase project.

create extension if not exists vector;

create table if not exists assistant_expenses (
  id uuid primary key default gen_random_uuid(),
  expense_date date not null,
  merchant text,
  amount numeric(12, 2) not null check (amount >= 0),
  currency text not null default 'AED',
  category text not null default 'Other',
  payment_method text,
  card text,
  notes text,
  source text not null default 'telegram',
  confidence numeric(4, 3),
  raw_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists assistant_tasks (
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

create table if not exists assistant_logs (
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

create table if not exists assistant_preferences (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

create table if not exists assistant_memories (
  id uuid primary key default gen_random_uuid(),
  memory_type text not null,
  content text not null,
  metadata jsonb not null default '{}'::jsonb,
  embedding vector(1536),
  created_at timestamptz not null default now()
);

create index if not exists assistant_expenses_date_idx on assistant_expenses (expense_date desc);
create index if not exists assistant_expenses_category_idx on assistant_expenses (category);
create index if not exists assistant_tasks_status_due_idx on assistant_tasks (status, due_at);
create index if not exists assistant_logs_created_idx on assistant_logs (created_at desc);
