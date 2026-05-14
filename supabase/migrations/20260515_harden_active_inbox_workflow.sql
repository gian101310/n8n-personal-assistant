alter table assistant.budgets
  drop constraint if exists budgets_period_check;

alter table assistant.budgets
  add constraint budgets_period_check
  check (period in ('monthly', 'weekly'));

create table if not exists assistant.processed_telegram_updates (
  telegram_update_id bigint primary key,
  chat_id text,
  update_type text,
  received_at timestamptz,
  processed_at timestamptz not null default now(),
  raw_payload jsonb not null default '{}'::jsonb
);

alter table assistant.processed_telegram_updates enable row level security;

drop policy if exists "service role manages processed telegram updates" on assistant.processed_telegram_updates;
create policy "service role manages processed telegram updates"
on assistant.processed_telegram_updates
for all
to service_role
using (true)
with check (true);

create or replace view public.assistant_processed_telegram_updates
with (security_invoker = true) as
select * from assistant.processed_telegram_updates;

grant select, insert, update, delete on assistant.processed_telegram_updates to service_role;
grant select, insert, update, delete on public.assistant_processed_telegram_updates to service_role;
