import { describe, expect, test } from "vitest";
import { buildExpenseQuery, dateRangeForPeriod, parseDashboardFilters } from "./dashboard-filters";

describe("dashboard filters", () => {
  test("defaults to this month", () => {
    expect(parseDashboardFilters({})).toEqual({
      period: "month",
      category: "",
      card: "",
      merchant: "",
      q: "",
    });
  });

  test("normalizes invalid period", () => {
    expect(parseDashboardFilters({ period: "year" }).period).toBe("month");
  });

  test("builds date range for 7 day filter", () => {
    expect(dateRangeForPeriod("7d", new Date("2026-05-14T08:00:00Z"))).toEqual({ from: "2026-05-08" });
  });

  test("builds encoded supabase expense query", () => {
    const filters = parseDashboardFilters({
      period: "30d",
      category: "Food",
      card: "ADCB Visa",
      merchant: "Costa",
      q: "coffee",
    });

    const query = buildExpenseQuery(filters, 25);
    expect(query).toContain("assistant_expenses?");
    expect(query).toContain("limit=25");
    expect(query).toContain("category=eq.Food");
    expect(query).toContain("card=eq.ADCB%20Visa");
    expect(query).toContain("merchant=ilike.*Costa*");
    expect(query).toContain("or=");
  });
});
