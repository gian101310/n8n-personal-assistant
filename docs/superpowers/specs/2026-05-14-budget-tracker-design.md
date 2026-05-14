# Budget Tracker Design

## Goal

Add a practical monthly budget tracker to the n8n Personal Assistant so Telegram expenses can be compared against category budgets in the Vercel dashboard.

## Approach

The budget tracker uses Supabase as the source of truth. A new `assistant.budgets` table stores category-level monthly budget limits in AED. The dashboard reads those budgets server-side, compares them with expenses for the current month, and shows remaining budget, percentage used, and over-budget state.

This phase does not invent personal budget amounts. Instead, the dashboard provides an add/update form so budgets can be set when the user is ready.

## Data Model

`assistant.budgets`:

- `id`
- `category`
- `amount`
- `currency`
- `period`
- `active`
- timestamps

One active row per category/period is enough for the first version. The current period is monthly.

## Dashboard

The dashboard adds a Budget Tracker panel with:

- category
- monthly budget
- spent this month
- remaining amount
- progress bar
- over-budget visual state
- compact add/update form

## Error Handling

Dashboard writes validate that category is present and amount is greater than zero. Supabase check constraints also reject invalid amounts.

## Verification

Verification requires:

- Supabase table/view/grants created.
- Budget insert/update works.
- Dashboard renders with and without budgets.
- Tests and production build pass.
- Live Vercel dashboard loads after deployment.
