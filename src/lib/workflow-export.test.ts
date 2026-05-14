import fs from "node:fs";
import path from "node:path";
import { describe, expect, test } from "vitest";

const workflowPath = path.join(process.cwd(), "workflows", "current-inbox-after-budget-commands.json");

function readWorkflow() {
  const exported = JSON.parse(fs.readFileSync(workflowPath, "utf8"));
  return Array.isArray(exported) ? exported[0] : exported;
}

function node(workflow: any, name: string) {
  const found = workflow.nodes.find((item: any) => item.name === name);
  if (!found) throw new Error(`Missing node: ${name}`);
  return found;
}

describe("active inbox workflow export", () => {
  test("uses normalized chatId for Telegram reply nodes", () => {
    const workflow = readWorkflow();
    const replyNodes = workflow.nodes.filter((item: any) => item.type === "n8n-nodes-base.telegram" && item.parameters?.chatId);

    expect(replyNodes.length).toBeGreaterThan(0);
    for (const replyNode of replyNodes) {
      expect(replyNode.parameters.chatId).toBe("={{ $('Normalize Telegram Input').item.json.chatId || '5379148910' }}");
    }
  });

  test("normalization has one voice key pair and captures update ids", () => {
    const workflow = readWorkflow();
    const jsCode = node(workflow, "Normalize Telegram Input").parameters.jsCode;

    expect((jsCode.match(/\bbinaryKey:/g) || []).length).toBe(1);
    expect((jsCode.match(/\bvoiceFileId:/g) || []).length).toBe(1);
    expect(jsCode).toContain("telegramUpdateId");
  });

  test("deduplicates Telegram updates before business logic", () => {
    const workflow = readWorkflow();
    const normalizeTargets = workflow.connections["Normalize Telegram Input"].main[0].map((item: any) => item.node);

    expect(normalizeTargets).toContain("Check Telegram Update Dedupe");
    expect(workflow.connections["Check Telegram Update Dedupe"].main[0][0].node).toBe("Route Telegram Update Dedupe");
    expect(workflow.connections["Route Telegram Update Dedupe"].main[0][0].node).toBe("Reply Duplicate Telegram Update");
    expect(workflow.connections["Route Telegram Update Dedupe"].main[1][0].node).toBe("Mark Telegram Update Processed");
    expect(workflow.connections["Mark Telegram Update Processed"].main[0].map((item: any) => item.node)).toEqual(["Route Pending Command", "Prepare Callback Ack"]);
  });

  test("pending callbacks target an explicit pending action id when present", () => {
    const workflow = readWorkflow();
    const normalizeCode = node(workflow, "Normalize Telegram Input").parameters.jsCode;
    const confirmUrl = node(workflow, "Read Pending for Confirm").parameters.url;
    const cancelUrl = node(workflow, "Read Pending for Cancel").parameters.url;

    expect(normalizeCode).toContain("pendingActionId");
    expect(confirmUrl).toContain("pendingActionId");
    expect(cancelUrl).toContain("pendingActionId");
  });

  test("expense saves append budget warning before Telegram confirmation", () => {
    const workflow = readWorkflow();

    expect(workflow.connections["Append Expense"].main[0][0].node).toBe("Read Budget After Expense");
    expect(workflow.connections["Read Budget After Expense"].main[0][0].node).toBe("Read Monthly Spend After Expense");
    expect(workflow.connections["Read Monthly Spend After Expense"].main[0][0].node).toBe("Append Budget Warning");
    expect(workflow.connections["Append Budget Warning"].main[0][0].node).toBe("Confirm Expense");
  });
});
