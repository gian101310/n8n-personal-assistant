# Premium Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the basic public dashboard into a private, premium admin dashboard for expenses, tasks, KPIs, filters, and operational review.

**Architecture:** Use Next.js App Router server components and server actions. Protect dashboard routes with `src/proxy.ts`, validate login in `src/app/login/actions.ts`, keep Supabase access server-only, and drive filters from URL search params.

**Tech Stack:** Next.js 16, React 19, TypeScript, Supabase REST, Vercel env vars, lucide-react, CSS modules via global stylesheet.

---

### Task 1: Admin Login

**Files:**
- Create: `src/lib/auth.ts`
- Create: `src/proxy.ts`
- Create: `src/app/login/actions.ts`
- Create: `src/app/login/page.tsx`

- [ ] Add a password login page that posts to a server action.
- [ ] Store an HTTP-only `assistant_admin` cookie when password matches `DASHBOARD_ADMIN_PASSWORD`.
- [ ] Protect `/` and dashboard routes in `src/proxy.ts` using `DASHBOARD_SESSION_TOKEN`.
- [ ] Keep `/login` and framework assets public.

### Task 2: Filtered Data Layer

**Files:**
- Create: `src/lib/dashboard-filters.ts`
- Create: `src/lib/dashboard-filters.test.ts`
- Modify: `src/lib/types.ts`
- Modify: `src/lib/supabase-dashboard.ts`

- [ ] Normalize URL filters for period, category, card, merchant, and query.
- [ ] Build Supabase query fragments safely with `encodeURIComponent`.
- [ ] Fetch recent expenses, filtered expenses, category/card breakdowns, monthly series, and logs.
- [ ] Add delete expense and task completion server actions.

### Task 3: Premium Dashboard UI

**Files:**
- Replace: `src/app/page.tsx`
- Replace: `src/app/globals.css`
- Modify: `src/app/layout.tsx`

- [ ] Build a dense admin dashboard: KPI rail, filter bar, monthly chart, category/card panels, expense table, tasks, logs.
- [ ] Add expense delete action using server actions.
- [ ] Keep responsive mobile layout polished and usable.

### Task 4: Verification And Deploy

**Files:**
- Modify: `.env.example`

- [ ] Add dashboard auth env vars to `.env.example`.
- [ ] Run `npm test -- --run`.
- [ ] Run `npm run build`.
- [ ] Set Vercel production env vars.
- [ ] Push to GitHub and deploy production.
