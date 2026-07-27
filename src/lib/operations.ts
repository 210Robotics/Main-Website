export const taskStatuses = [
  "TODO",
  "IN_PROGRESS",
  "BLOCKED",
  "IN_REVIEW",
  "DONE",
] as const;
export const memberTaskStatuses = [
  "TODO",
  "IN_PROGRESS",
  "BLOCKED",
  "IN_REVIEW",
] as const;
export const taskPriorities = ["LOW", "NORMAL", "HIGH", "URGENT"] as const;
export const recordStatuses = ["DRAFT", "ACTIVE", "ARCHIVED"] as const;
export const financeEntryKinds = [
  "EXPENSE",
  "INCOME",
  "BUDGET_ITEM",
  "BOM_ITEM",
] as const;
export const financeEntryStatuses = [
  "PLANNED",
  "APPROVED",
  "ORDERED",
  "PAID",
  "RECEIVED",
  "CANCELED",
] as const;
export const sponsorStatuses = [
  "PROSPECT",
  "PLEDGED",
  "INVOICED",
  "RECEIVED",
] as const;
export const workStatuses = [
  "NOT_STARTED",
  "IN_PROGRESS",
  "BLOCKED",
  "READY_FOR_REVIEW",
  "COMPLETE",
] as const;
export const verificationStatuses = [
  "PENDING",
  "IN_REVIEW",
  "APPROVED",
  "REJECTED",
  "NOT_REQUIRED",
] as const;

export function moneyToCents(value: FormDataEntryValue | null) {
  const amount = Number(String(value ?? "0").replace(/[$,]/g, ""));
  if (!Number.isFinite(amount))
    throw new Error("Enter a valid currency amount.");
  return Math.round(amount * 100);
}

export function centsToMoney(cents: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(cents / 100);
}

export function textValue(formData: FormData, key: string, required = false) {
  const value = String(formData.get(key) ?? "").trim();
  if (required && !value) throw new Error(`${key} is required.`);
  return value;
}

export function optionalDate(value: FormDataEntryValue | null) {
  const text = String(value ?? "").trim();
  if (!text) return null;
  const date = new Date(text);
  if (Number.isNaN(date.getTime()))
    throw new Error("Enter a valid date and time.");
  return date;
}

export function dateValue(value: FormDataEntryValue | null) {
  const date = optionalDate(value);
  if (!date) throw new Error("A date and time is required.");
  return date;
}

export function displayStatus(value: string) {
  return value
    .replaceAll("_", " ")
    .toLowerCase()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function summarizeBudget(
  entries: Array<{ kind: string; status: string; amountCents: number }>,
  sponsors: Array<{ status: string; amountCents: number }> = [],
) {
  const activeEntries = entries.filter((entry) => entry.status !== "CANCELED");
  const expenses = activeEntries
    .filter((entry) => entry.kind === "EXPENSE")
    .reduce((sum, entry) => sum + entry.amountCents, 0);
  const planned = activeEntries
    .filter((entry) => ["BUDGET_ITEM", "BOM_ITEM"].includes(entry.kind))
    .reduce((sum, entry) => sum + entry.amountCents, 0);
  const income = activeEntries
    .filter((entry) => entry.kind === "INCOME")
    .reduce((sum, entry) => sum + entry.amountCents, 0);
  const sponsorFunding = sponsors
    .filter((sponsor) => sponsor.status !== "PROSPECT")
    .reduce((sum, sponsor) => sum + sponsor.amountCents, 0);
  return {
    expenses,
    planned,
    income,
    sponsorFunding,
    totalFunding: income + sponsorFunding,
    availableCash: income + sponsorFunding - expenses,
  };
}
