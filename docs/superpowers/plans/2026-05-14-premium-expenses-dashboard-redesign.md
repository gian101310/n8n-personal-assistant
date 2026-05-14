# Premium Expenses Dashboard Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade the existing Expenses & Budget Tracker dashboard into a premium modern SaaS command-center UI without changing the Supabase data model or server actions.

**Architecture:** Keep the current single Next.js App Router page as a server component. Refactor only the dashboard markup hierarchy and global CSS classes so the page reads as a finance cockpit: executive metrics, persistent filters, spend analytics, expense ledger, budget controls, and operational activity. Preserve all existing forms, server actions, and data-fetching helpers.

**Tech Stack:** Next.js 16 App Router, React server components, lucide-react icons, plain CSS in `src/app/globals.css`, existing Vitest tests, Vercel deployment.

---

### Task 1: Dashboard Markup Hierarchy

**Files:**
- Modify: `src/app/page.tsx`

- [ ] Rename the hero copy to emphasize "Expenses & Budget Tracker".
- [ ] Add premium SaaS layout wrappers for dashboard top summary, filters, expense ledger, and budget tracker.
- [ ] Add small contextual labels and status chips using existing data only.
- [ ] Keep all existing server action forms: refresh, filters, delete expense, complete task, save budget, logout.

### Task 2: Premium Visual System

**Files:**
- Modify: `src/app/globals.css`

- [ ] Replace the current flat dark surface styling with a restrained premium system: deep neutral background, glass sidebar, crisp panel borders, improved shadows, improved focus states, and balanced accent colors.
- [ ] Improve Expenses table density and readability without turning it into a marketing layout.
- [ ] Upgrade Budget Tracker rows with clearer progress, limit/spent hierarchy, warning states, and mobile-safe wrapping.
- [ ] Keep border radius at 8px or less for application UI controls.
- [ ] Keep text sizes stable and avoid viewport-scaled fonts.

### Task 3: Verification And Deployment

**Files:**
- Verify: `src/app/page.tsx`
- Verify: `src/app/globals.css`

- [ ] Run `npm test -- --run`.
- [ ] Run `npm run build`.
- [ ] Start `npm run dev` and inspect the dashboard in browser at desktop and mobile widths.
- [ ] Fix any layout overflow, overlap, or blank-state issues.
- [ ] Commit, push `main`, and deploy production with `npx vercel --prod --yes`.
