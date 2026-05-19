import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";

describe("Supabase migrations", () => {
  test("grants service role access to finance command center sequences", () => {
    const migration = readFileSync(join(process.cwd(), "supabase/migrations/20260518_finance_command_center.sql"), "utf8");

    expect(migration).toContain("grant usage, select on all sequences in schema assistant to service_role");
  });
});
