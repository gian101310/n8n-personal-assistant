create or replace view public.assistant_expenses
with (security_invoker = true) as
select * from assistant.expenses;

create or replace view public.assistant_tasks
with (security_invoker = true) as
select * from assistant.tasks;

create or replace view public.assistant_logs
with (security_invoker = true) as
select * from assistant.logs;

create or replace view public.assistant_preferences
with (security_invoker = true) as
select * from assistant.preferences;

create or replace view public.assistant_recurring_expenses
with (security_invoker = true) as
select * from assistant.recurring_expenses;

create or replace view public.assistant_recurring_tasks
with (security_invoker = true) as
select * from assistant.recurring_tasks;

create or replace view public.assistant_memories
with (security_invoker = true) as
select id, memory_type, content, metadata, created_at
from assistant.memories;

create or replace view public.assistant_weekly_reviews
with (security_invoker = true) as
select * from assistant.weekly_reviews;

grant select, insert, update, delete on public.assistant_expenses to service_role;
grant select, insert, update, delete on public.assistant_tasks to service_role;
grant select, insert, update, delete on public.assistant_logs to service_role;
grant select, insert, update, delete on public.assistant_preferences to service_role;
grant select, insert, update, delete on public.assistant_recurring_expenses to service_role;
grant select, insert, update, delete on public.assistant_recurring_tasks to service_role;
grant select, insert, update, delete on public.assistant_memories to service_role;
grant select, insert, update, delete on public.assistant_weekly_reviews to service_role;

grant select on assistant.daily_expense_summary to service_role;
grant select on assistant.category_expense_summary to service_role;
grant select on assistant.card_expense_summary to service_role;
grant select on assistant.task_summary to service_role;
grant select on assistant.upcoming_reminders to service_role;
grant select on assistant.dashboard_metrics to service_role;

