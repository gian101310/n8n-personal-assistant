import { describe, expect, test } from "vitest";
import { formatDate, formatDateTime, formatMoney, priorityLabel, statusLabel } from "./dashboard-format";

describe("dashboard formatting", () => {
  test("formats AED money with two decimals", () => {
    expect(formatMoney(45, "AED")).toBe("45.00 AED");
    expect(formatMoney("12.5", "AED")).toBe("12.50 AED");
  });

  test("handles missing money values", () => {
    expect(formatMoney(null, "AED")).toBe("0.00 AED");
  });

  test("formats date strings compactly", () => {
    expect(formatDate("2026-05-14")).toBe("14 May 2026");
  });

  test("formats datetimes in Dubai time", () => {
    expect(formatDateTime("2026-05-14T03:24:05.000Z")).toContain("14 May");
  });

  test("maps status and priority labels", () => {
    expect(statusLabel("open")).toBe("Open");
    expect(statusLabel("done")).toBe("Done");
    expect(priorityLabel("high")).toBe("High");
    expect(priorityLabel("")).toBe("Normal");
  });
});

