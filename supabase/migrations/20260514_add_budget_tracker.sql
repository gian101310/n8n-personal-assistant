create table if not exists assistant.budgets (
  id uuid primary key default gen_random_uuid(),
  category text not null check (length(trim(category)) > 0),
  amount numeric(12, 2) not null check (amount > 0),
  currency text not null default 'AED',
  period text not null default 'monthly' check (period in ('monthly')),
  active boolean not null default true,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (category, period)
);

create index if not exists budgets_active_period_idx on assistant.budgets (active, period, category);

alter table assistant.budgets enable row level security;

drop policy if exists "service role manages budgets" on assistant.budgets;
create policy "service role manages budgets" on assistant.budgets for all to service_role using (true) with check (true);

create or replace function assistant.touch_budget_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists touch_budget_updated_at on assistant.budgets;
create trigger touch_budget_updated_at
before update on assistant.budgets
for each row
execute function assistant.touch_budget_updated_at();

create or replace view public.assistant_budgets
with (security_invoker = true) as
select * from assistant.budgets;

grant select, insert, update, delete on assistant.budgets to service_role;
grant select, insert, update, delete on public.assistant_budgets to service_role;

insert into assistant.preferences (key, value)
values ('budget_tracker', '{"period":"monthly","currency":"AED","status":"enabled"}'::jsonb)
on conflict (key) do update
set value = excluded.value,
    updated_at = now();
