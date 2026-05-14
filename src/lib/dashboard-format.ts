const dubaiDate = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Asia/Dubai",
  day: "2-digit",
  month: "short",
  year: "numeric",
});

const dubaiDateTime = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Asia/Dubai",
  day: "2-digit",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
});

export function formatMoney(value: number | string | null | undefined, currency = "AED") {
  const amount = Number(value ?? 0);
  const safeAmount = Number.isFinite(amount) ? amount : 0;
  return `${safeAmount.toFixed(2)} ${currency}`;
}

export function formatDate(value: string | null | undefined) {
  if (!value) return "No date";
  return dubaiDate.format(new Date(`${value}T00:00:00+04:00`));
}

export function formatDateTime(value: string | null | undefined) {
  if (!value) return "No time";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "No time";
  return dubaiDateTime.format(date);
}

export function statusLabel(value: string | null | undefined) {
  const status = value || "open";
  return status.charAt(0).toUpperCase() + status.slice(1);
}

export function priorityLabel(value: string | null | undefined) {
  const priority = value || "normal";
  return priority.charAt(0).toUpperCase() + priority.slice(1);
}
