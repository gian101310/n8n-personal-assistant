import { NextResponse, type NextRequest } from "next/server";
import { parseDashboardFilters } from "@/lib/dashboard-filters";
import { buildDashboardSummary, createTelegramNote, createTelegramReminder, createTelegramTodo, getDashboardData } from "@/lib/supabase-dashboard";
import { parseTelegramCommand, telegramHelpText } from "@/lib/telegram-command-agent";

type TelegramUpdate = {
  message?: {
    chat?: { id?: number | string };
    text?: string;
  };
};

function envConfig() {
  return {
    token: process.env.TELEGRAM_BOT_TOKEN || "",
    secret: process.env.TELEGRAM_WEBHOOK_SECRET || "",
  };
}

async function sendTelegramMessage(chatId: number | string | undefined, text: string) {
  const { token } = envConfig();
  if (!token || !chatId) return;
  await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text }),
  });
}

function formatSummaryText(summary: ReturnType<typeof buildDashboardSummary>) {
  return [
    `Monthly income: ${summary.monthlyIncomeTotal.toFixed(2)} AED`,
    `Expenses: ${summary.monthlyExpenseTotal.toFixed(2)} AED`,
    `Card payments due: ${summary.monthlyCreditCardPaymentTotal.toFixed(2)} AED`,
    `Projected remaining: ${summary.projectedRemainingBalance.toFixed(2)} AED`,
    `Priority: ${summary.priorityLevel}`,
  ].join("\n");
}

async function answerReadCommand(command: string) {
  const data = await getDashboardData(parseDashboardFilters({}));
  const summary = buildDashboardSummary(data);

  if (command === "today") {
    const dueReminders = data.reminders.filter((item) => item.status === "Pending").slice(0, 5);
    const todos = data.todos.filter((item) => item.status === "Pending").slice(0, 5);
    return [`Today needs attention: ${summary.highPriorityItemCount} high-priority items.`, ...dueReminders.map((item) => `Reminder: ${item.title}`), ...todos.map((item) => `Todo: ${item.task}`)].join("\n");
  }
  if (command === "bills") {
    return data.creditCardBills.slice(0, 8).map((bill) => `${bill.card_name}: ${Number(bill.statement_balance).toFixed(2)} AED due ${bill.due_date} (${bill.payment_status})`).join("\n") || "No credit card bills tracked yet.";
  }
  if (command === "subscriptions") {
    return data.subscriptions.slice(0, 8).map((item) => `${item.subscription_name}: ${Number(item.amount).toFixed(2)} AED next ${item.next_billing_date}`).join("\n") || "No subscriptions tracked yet.";
  }
  if (command === "summary") return formatSummaryText(summary);
  if (command === "warnings") {
    return data.aiInsights.filter((insight) => insight.severity === "Warning" || insight.severity === "Critical").map((insight) => `${insight.severity}: ${insight.title} - ${insight.message}`).join("\n") || "No urgent warnings right now.";
  }
  if (command === "notes") {
    return data.notes.slice(0, 8).map((note) => `${note.title}: ${note.body.slice(0, 120)}`).join("\n") || "No notes yet.";
  }
  return telegramHelpText();
}

export async function POST(request: NextRequest) {
  const { secret } = envConfig();
  const receivedSecret = request.headers.get("x-telegram-bot-api-secret-token") || "";
  if (!secret || receivedSecret !== secret) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const update = (await request.json()) as TelegramUpdate;
  const text = update.message?.text || "";
  const chatId = update.message?.chat?.id;
  const parsed = parseTelegramCommand(text);

  if (!parsed.ok) {
    await sendTelegramMessage(chatId, parsed.error || telegramHelpText());
    return NextResponse.json({ ok: false, error: parsed.error });
  }

  if (parsed.command === "note") {
    await createTelegramNote(parsed.text, String(chatId || ""));
    await sendTelegramMessage(chatId, "Note added.");
  } else if (parsed.command === "remind" && parsed.dueAt) {
    await createTelegramReminder(parsed.text, parsed.dueAt, String(chatId || ""));
    await sendTelegramMessage(chatId, "Reminder added.");
  } else if (parsed.command === "todo") {
    await createTelegramTodo(parsed.text, String(chatId || ""));
    await sendTelegramMessage(chatId, "Todo added.");
  } else {
    await sendTelegramMessage(chatId, await answerReadCommand(parsed.command));
  }

  return NextResponse.json({ ok: true });
}
