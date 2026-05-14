# Budget Tracker Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a monthly category budget tracker backed by Supabase and shown on the Vercel dashboard.

**Architecture:** Add an `assistant.budgets` table and `public.assistant_budgets` REST view. Read budgets alongside expenses in the dashboard data layer, compute current-month budget progress server-side, and add server actions for saving budgets.

**Tech Stack:** Supabase Postgres, Next.js App Router server actions, TypeScript, Vitest.

---

### Task 1: Supabase Budget Schema

**Files:**
- Create: `supabase/migrations/20260514_add_budget_tracker.sql`

- [ ] **Step 1: Create the migration**

Create `assistant.budgets` with category, amount, currency, monthly period, active flag, RLS, service-role policy, private-table grants, and `public.assistant_budgets`.

- [ ] **Step 2: Apply SQL to live Supabase**

Run the same SQL through Supabase MCP `execute_sql`.

- [ ] **Step 3: Verify**

Query `assistant.budgets` and `public.assistant_budgets` to confirm service-role access.

### Task 2: Dashboard Data Layer

**Files:**
- Modify: `src/lib/types.ts`
- Modify: `src/lib/supabase-dashboard.ts`
- Create: `src/lib/budget-progress.ts`
- Create: `src/lib/budget-progress.test.ts`

- [ ] **Step 1: Add types**

Add `Budget`, `BudgetProgress`, and `budgetProgress` to `DashboardData`.

- [ ] **Step 2: Add calculation helper**

Create `buildBudgetProgress(budgets, expenses)` that groups current-month expense spend by category and returns sorted budget progress rows.

- [ ] **Step 3: Test helper**

Cover remaining budget, over-budget, zero budgets, and category matching.

- [ ] **Step 4: Read and write budgets**

Fetch `assistant_budgets`, compute progress, and add `saveBudget(category, amount)`.

### Task 3: Dashboard UI

**Files:**
- Modify: `src/app/page.tsx`
- Modify: `src/app/globals.css`

- [ ] **Step 1: Add server action**

Create `upsertBudget(formData)` and revalidate `/`.

- [ ] **Step 2: Add Budget Tracker panel**

Show existing budgets and an add/update form.

- [ ] **Step 3: Style progress states**

Add compact budget bars and over-budget state.

### Task 4: Verify And Deploy

**Files:**
- Modify docs as needed.

- [ ] **Step 1: Run tests**

Run `npm test -- --run`.

- [ ] **Step 2: Build**

Run `npm run build`.

- [ ] **Step 3: Deploy**

Run `npx vercel --prod --yes`.

- [ ] **Step 4: Live check**

Use authenticated curl to verify the live dashboard contains `Budget Tracker`.
