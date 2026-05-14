# Supabase Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a local Next.js dashboard for the Telegram personal assistant data stored in Supabase.

**Architecture:** Use Next.js App Router with server-side Supabase REST reads via the local `.env` service-role key. Keep transformation logic in a small shared module with tests, and render a compact operational dashboard as the first screen.

**Tech Stack:** Next.js, React, TypeScript, Vitest, Supabase REST API, CSS modules/global CSS.

---

### Task 1: Project Scaffold And Tests

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `next.config.mjs`
- Create: `vitest.config.ts`
- Create: `src/lib/dashboard-format.ts`
- Create: `src/lib/dashboard-format.test.ts`

- [ ] **Step 1: Write formatting tests**

Test currency, dates, and status class mapping in `src/lib/dashboard-format.test.ts`.

- [ ] **Step 2: Run tests and verify failure**

Run: `npm test -- --run`
Expected: failure before implementation exists.

- [ ] **Step 3: Implement dashboard formatting utilities**

Implement `formatMoney`, `formatDate`, `formatDateTime`, `statusLabel`, and `priorityLabel`.

- [ ] **Step 4: Run tests and verify pass**

Run: `npm test -- --run`
Expected: all tests pass.

### Task 2: Server Data Layer

**Files:**
- Create: `src/lib/supabase-dashboard.ts`
- Create: `src/lib/types.ts`

- [ ] **Step 1: Add typed Supabase fetch helper**

Use `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` only on the server.

- [ ] **Step 2: Add dashboard fetch function**

Fetch metrics, recent expenses, open tasks, category summary, card summary, and logs.

### Task 3: Dashboard UI

**Files:**
- Create: `src/app/layout.tsx`
- Create: `src/app/page.tsx`
- Create: `src/app/globals.css`

- [ ] **Step 1: Build compact dashboard layout**

Render metrics, expense list, task list, breakdowns, and logs as the first screen.

- [ ] **Step 2: Add task completion server action**

Mark a task done with Supabase REST PATCH and refresh the dashboard.

### Task 4: Verification

**Files:**
- Modify: none.

- [ ] **Step 1: Run tests**

Run: `npm test -- --run`
Expected: pass.

- [ ] **Step 2: Build Next app**

Run: `npm run build`
Expected: production build succeeds.

- [ ] **Step 3: Start local dev server**

Run: `npm run dev -- --hostname 127.0.0.1 --port 3000`
Expected: dashboard loads at `http://127.0.0.1:3000`.

