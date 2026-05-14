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

  test("Telegram reply nodes retry transient send failures", () => {
    const workflow = readWorkflow();
    const replyNodes = workflow.nodes.filter((item: any) => item.type === "n8n-nodes-base.telegram" && item.parameters?.chatId);

    expect(replyNodes.length).toBeGreaterThan(0);
    for (const replyNode of replyNodes) {
      expect(replyNode.retryOnFail).toBe(true);
      expect(replyNode.maxTries).toBeGreaterThanOrEqual(3);
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

  test("pending command switch exposes every expression output", () => {
    const workflow = readWorkflow();
    const route = node(workflow, "Route Pending Command");
    const outputExpression = route.parameters.output;
    const outputNumbers = [...outputExpression.matchAll(/\?\s*(\d+)\s*:/g), ...outputExpression.matchAll(/:\s*(\d+)\s*\)/g)]
      .map((match) => Number(match[1]))
      .filter(Number.isFinite);
    const maxOutput = Math.max(...outputNumbers);

    expect(route.parameters.numberOutputs).toBeGreaterThan(maxOutput);
  });

  test("expense saves append budget warning before Telegram confirmation", () => {
    const workflow = readWorkflow();

    expect(workflow.connections["Append Expense"].main[0][0].node).toBe("Read Budget After Expense");
    expect(workflow.connections["Read Budget After Expense"].main[0][0].node).toBe("Read Monthly Spend After Expense");
    expect(workflow.connections["Read Monthly Spend After Expense"].main[0][0].node).toBe("Append Budget Warning");
    expect(workflow.connections["Append Budget Warning"].main[0][0].node).toBe("Confirm Expense");
  });

  test("photo messages convert n8n binary files to base64 before OpenAI", () => {
    const workflow = readWorkflow();
    const preparePhoto = node(workflow, "Prepare Photo Image");

    expect(preparePhoto.parameters.jsCode).toContain("getBinaryDataBuffer");
    expect(preparePhoto.parameters.jsCode).toContain("base64");
    expect(workflow.connections["Route Voice"].main[1][0].node).toBe("Prepare Photo Image");
    expect(workflow.connections["Prepare Photo Image"].main[0][0].node).toBe("Read Parser Context");
  });

  test("optional parser context reads continue when no rows exist", () => {
    const workflow = readWorkflow();

    expect(node(workflow, "Read Recent Memories").alwaysOutputData).toBe(true);
    expect(workflow.connections["Read Recent Memories"].main[0][0].node).toBe("Apply Memory Context");
  });

  test("invalid parser results clarify instead of creating pending expenses", () => {
    const workflow = readWorkflow();
    const route = node(workflow, "Route Clarify or Pending");

    expect(route.parameters.output).toContain("!$json.valid");
    expect(workflow.connections["Route Clarify or Pending"].main[0][0].node).toBe("Confirm Unknown");
    expect(workflow.connections["Route Clarify or Pending"].main[1][0].node).toBe("Prepare Pending Action");
  });
});
