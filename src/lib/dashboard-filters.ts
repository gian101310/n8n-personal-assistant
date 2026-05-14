export type DashboardPeriod = "today" | "7d" | "30d" | "month" | "all";

export type DashboardFilters = {
  period: DashboardPeriod;
  category: string;
  card: string;
  merchant: string;
  q: string;
};

export const periodLabels: Record<DashboardPeriod, string> = {
  today: "Today",
  "7d": "7 days",
  "30d": "30 days",
  month: "This month",
  all: "All time",
};

const allowedPeriods = new Set<DashboardPeriod>(["today", "7d", "30d", "month", "all"]);

function valueFromParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] || "" : value || "";
}

export function parseDashboardFilters(input: Record<string, string | string[] | undefined> = {}): DashboardFilters {
  const rawPeriod = valueFromParam(input.period) as DashboardPeriod;

  return {
    period: allowedPeriods.has(rawPeriod) ? rawPeriod : "month",
    category: valueFromParam(input.category).trim(),
    card: valueFromParam(input.card).trim(),
    merchant: valueFromParam(input.merchant).trim(),
    q: valueFromParam(input.q).trim(),
  };
}

function isoDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function startOfDubaiToday(now: Date) {
  const dubai = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Dubai" }));
  return new Date(Date.UTC(dubai.getFullYear(), dubai.getMonth(), dubai.getDate()));
}

export function dateRangeForPeriod(period: DashboardPeriod, now = new Date()) {
  if (period === "all") return {};

  const start = startOfDubaiToday(now);
  if (period === "7d") start.setUTCDate(start.getUTCDate() - 6);
  if (period === "30d") start.setUTCDate(start.getUTCDate() - 29);
  if (period === "month") start.setUTCDate(1);

  return { from: isoDate(start) };
}

function appendFilter(parts: string[], key: string, operator: string, value: string) {
  if (!value) return;
  parts.push(`${key}=${operator}.${encodeURIComponent(value)}`);
}

export function buildExpenseQuery(filters: DashboardFilters, limit = 100) {
  const parts = ["select=*", "order=expense_date.desc,created_at.desc", `limit=${limit}`];
  const range = dateRangeForPeriod(filters.period);

  if (range.from) parts.push(`expense_date=gte.${range.from}`);
  appendFilter(parts, "category", "eq", filters.category);
  appendFilter(parts, "card", "eq", filters.card);
  appendFilter(parts, "merchant", "ilike", `*${filters.merchant}*`);

  if (filters.q) {
    const q = filters.q.replace(/[(),]/g, " ");
    parts.push(`or=${encodeURIComponent(`(merchant.ilike.*${q}*,notes.ilike.*${q}*,category.ilike.*${q}*,card.ilike.*${q}*)`)}`);
  }

  return `assistant_expenses?${parts.join("&")}`;
}

export function filtersToSearchParams(filters: DashboardFilters) {
  const params = new URLSearchParams();
  if (filters.period !== "month") params.set("period", filters.period);
  if (filters.category) params.set("category", filters.category);
  if (filters.card) params.set("card", filters.card);
  if (filters.merchant) params.set("merchant", filters.merchant);
  if (filters.q) params.set("q", filters.q);
  return params;
}
