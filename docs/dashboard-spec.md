# Personal Assistant Dashboard Spec

## Purpose

A mobile-friendly dashboard for reviewing expenses, tasks, reminders, and weekly AI insights.

## Recommended Stack

- Next.js on Vercel.
- Supabase Postgres for data.
- Supabase Auth later if the dashboard is exposed outside your machine.
- Charts: Recharts.
- UI: shadcn/ui or a simple Tailwind layout.

## First Version Screens

- Expenses
  - Today, week, and month totals.
  - Category breakdown.
  - Latest expense rows.
  - Filter by card, category, and merchant.

- Tasks
  - Open, due today, overdue, completed this week.
  - Quick mark done.
  - Priority filter.

- Insights
  - Weekly AI review.
  - Spending trend.
  - Biggest merchants.
  - Suggested next priority.

- Logs
  - Recent Telegram messages.
  - Parse confidence.
  - Missing field clarifications.

## API Shape

- `GET /api/expenses?range=today|week|month`
- `GET /api/tasks?status=open|done|sent`
- `GET /api/summary/daily`
- `GET /api/summary/weekly`
- `POST /api/tasks/:id/done`

## Manual Inputs Needed

- Supabase project URL.
- Supabase anon key.
- Supabase service role key for server-only writes.
- Hosting choice confirmation: Vercel is the easiest path.

