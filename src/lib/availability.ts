import { z } from "zod";

export const pollSlotMinutes = [15, 30, 60] as const;
export type AvailabilityPollDefinition = {
  dates: string[];
  startTime: string;
  endTime: string;
  slotMinutes: number;
};

export type AvailabilitySelectionMode = "select" | "clear";

export function defaultAvailabilityPollSchedule(now = new Date()) {
  const firstDate = new Date(now.getTime() + 86_400_000)
    .toISOString()
    .slice(0, 10);
  return {
    dates: [firstDate],
    status: "OPEN" as const,
    openedAt: now,
  };
}

export function availabilityDateRange(start: string, end: string, limit = 14) {
  if (!datePattern.test(start) || !datePattern.test(end) || end < start) return [];
  const values: string[] = [];
  const cursor = new Date(`${start}T12:00:00Z`);
  const final = new Date(`${end}T12:00:00Z`);
  while (cursor <= final && values.length < limit) {
    values.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return values;
}

const datePattern = /^\d{4}-\d{2}-\d{2}$/;
const timePattern = /^(?:[01]\d|2[0-3]):[0-5]\d$/;

export const availabilityDefinitionSchema = z
  .object({
    dates: z
      .array(z.string().regex(datePattern))
      .min(1, "Add at least one date.")
      .max(14, "Use no more than 14 dates."),
    startTime: z.string().regex(timePattern),
    endTime: z.string().regex(timePattern),
    slotMinutes: z.union([z.literal(15), z.literal(30), z.literal(60)]),
  })
  .superRefine((value, context) => {
    const start = timeToMinutes(value.startTime);
    const end = timeToMinutes(value.endTime);
    if (end <= start)
      context.addIssue({
        code: "custom",
        message: "End time must be later than start time.",
        path: ["endTime"],
      });
    if ((end - start) / value.slotMinutes > 48)
      context.addIssue({
        code: "custom",
        message: "Choose a shorter daily time range.",
        path: ["endTime"],
      });
  });

export function timeToMinutes(value: string) {
  const [hours, minutes] = value.split(":").map(Number);
  return hours * 60 + minutes;
}

export function minutesToTime(value: number) {
  return `${String(Math.floor(value / 60)).padStart(2, "0")}:${String(value % 60).padStart(2, "0")}`;
}

export function generateAvailabilitySlots(
  definition: AvailabilityPollDefinition,
) {
  const parsed = availabilityDefinitionSchema.parse(definition);
  const uniqueDates = [...new Set(parsed.dates)].sort();
  const slots: string[] = [];
  for (const date of uniqueDates) {
    for (
      let minute = timeToMinutes(parsed.startTime);
      minute < timeToMinutes(parsed.endTime);
      minute += parsed.slotMinutes
    ) {
      slots.push(`${date}|${minutesToTime(minute)}`);
    }
  }
  return slots;
}

export function availabilityOverlap(
  slots: string[],
  responses: Array<{ availableSlots: string[] }>,
) {
  const allowed = new Set(slots);
  const counts = new Map(slots.map((slot) => [slot, 0]));
  for (const response of responses) {
    for (const slot of new Set(response.availableSlots)) {
      if (allowed.has(slot)) counts.set(slot, (counts.get(slot) ?? 0) + 1);
    }
  }
  return [...counts.entries()]
    .map(([slot, count]) => ({ slot, count }))
    .sort((a, b) => b.count - a.count || a.slot.localeCompare(b.slot));
}

export function updateAvailabilitySelection(
  values: Iterable<string>,
  slot: string,
  mode: AvailabilitySelectionMode,
) {
  const next = new Set(values);
  if (mode === "select") next.add(slot);
  else next.delete(slot);
  return next;
}

export function formatPollDate(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${value}T12:00:00Z`));
}

export function formatPollTime(value: string) {
  const [hours, minutes] = value.split(":").map(Number);
  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(2026, 0, 1, hours, minutes)));
}
