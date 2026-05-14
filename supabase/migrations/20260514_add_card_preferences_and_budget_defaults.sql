create table if not exists assistant.cards (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) > 0),
  normalized_name text generated always as (lower(trim(name))) stored,
  kind text not null default 'other' check (kind in ('debit', 'credit', 'other')),
  issuer text,
  active boolean not null default true,
  source text not null default 'manual',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (normalized_name)
);

create index if not exists cards_kind_idx on assistant.cards (kind, active);

alter table assistant.cards enable row level security;

drop policy if exists "service role manages cards" on assistant.cards;
create policy "service role manages cards" on assistant.cards for all to service_role using (true) with check (true);

create or replace function assistant.touch_card_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists touch_card_updated_at on assistant.cards;
create trigger touch_card_updated_at
before update on assistant.cards
for each row
execute function assistant.touch_card_updated_at();

create or replace function assistant.sync_expense_card()
returns trigger
language plpgsql
as $$
begin
  if new.card is not null and length(trim(new.card)) > 0 then
    insert into assistant.cards (name, kind, issuer, source, notes)
    values (trim(new.card), 'other', null, 'expense', 'Auto-added from an expense record.')
    on conflict (normalized_name) do update
    set active = true,
        updated_at = now();
  end if;
  return new;
end;
$$;

drop trigger if exists sync_expense_card on assistant.expenses;
create trigger sync_expense_card
after insert or update of card on assistant.expenses
for each row
execute function assistant.sync_expense_card();

insert into assistant.cards (name, kind, issuer, source, notes)
values
  ('ADCB Debit', 'debit', 'ADCB', 'manual', 'Default debit card.'),
  ('ENBD Debit', 'debit', 'ENBD', 'manual', 'Default debit card.'),
  ('DIB Debit', 'debit', 'DIB', 'manual', 'Default debit card.'),
  ('RAK Debit', 'debit', 'RAK', 'manual', 'Default debit card.'),
  ('CBD Debit', 'debit', 'CBD', 'manual', 'Default debit card.'),
  ('ADCB Credit', 'credit', 'ADCB', 'manual', 'Default credit card.'),
  ('ENBD Credit', 'credit', 'ENBD', 'manual', 'Default credit card.'),
  ('DIB Credit', 'credit', 'DIB', 'manual', 'Default credit card.'),
  ('RAK Credit', 'credit', 'RAK', 'manual', 'Default credit card.'),
  ('TABBY Credit', 'credit', 'TABBY', 'manual', 'Default credit card.')
on conflict (normalized_name) do update
set kind = excluded.kind,
    issuer = excluded.issuer,
    active = true,
    source = excluded.source,
    notes = excluded.notes,
    updated_at = now();

insert into assistant.recurring_expenses (name, merchant, amount, currency, category, payment_method, card, cadence, notes)
values
  ('ADCB Credit Card Payment', 'ADCB', null, 'AED', 'Bills', 'card payment', 'ADCB Credit', 'monthly', 'Recurring payment reminder.'),
  ('ENBD Credit Card Payment', 'ENBD', null, 'AED', 'Bills', 'card payment', 'ENBD Credit', 'monthly', 'Recurring payment reminder.'),
  ('DIB Credit Card Payment', 'DIB', null, 'AED', 'Bills', 'card payment', 'DIB Credit', 'monthly', 'Recurring payment reminder.'),
  ('RAK Credit Card Payment', 'RAK', null, 'AED', 'Bills', 'card payment', 'RAK Credit', 'monthly', 'Recurring payment reminder.'),
  ('TABBY Payment', 'TABBY', null, 'AED', 'Bills', 'card payment', 'TABBY Credit', 'monthly', 'Recurring payment reminder.'),
  ('ETISALAT Payment', 'ETISALAT', null, 'AED', 'Bills', 'bill payment', null, 'monthly', 'Recurring telecom payment reminder.')
on conflict do nothing;

insert into assistant.preferences (key, value)
values
  ('default_currency', '"AED"'::jsonb),
  ('debit_cards', '["ADCB Debit","ENBD Debit","DIB Debit","RAK Debit","CBD Debit"]'::jsonb),
  ('credit_cards', '["ADCB Credit","ENBD Credit","DIB Credit","RAK Credit","TABBY Credit"]'::jsonb),
  ('recurring_payments', '["ADCB Credit Card Payment","ENBD Credit Card Payment","DIB Credit Card Payment","RAK Credit Card Payment","TABBY Payment","ETISALAT Payment"]'::jsonb),
  ('suggestions', '["budget tracker"]'::jsonb)
on conflict (key) do update
set value = excluded.value,
    updated_at = now();

create or replace view public.assistant_cards
with (security_invoker = true) as
select * from assistant.cards;

grant select, insert, update, delete on assistant.cards to service_role;
grant select, insert, update, delete on public.assistant_cards to service_role;
