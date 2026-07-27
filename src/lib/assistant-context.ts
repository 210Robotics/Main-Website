import type { AssistantCommand } from "@/lib/assistant-commands";

const weekdays = [
  "sunday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
] as const;

function chicagoDateParts(date: Date) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Chicago",
    year: "numeric",
    month: "numeric",
    day: "numeric",
    weekday: "long",
  }).formatToParts(date);
  const value = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value || "";
  return {
    year: Number(value("year")),
    month: Number(value("month")),
    day: Number(value("day")),
    weekday: weekdays.indexOf(
      value("weekday").toLowerCase() as (typeof weekdays)[number],
    ),
  };
}

function chicagoOffset(date: Date) {
  const label = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Chicago",
    timeZoneName: "shortOffset",
  })
    .formatToParts(date)
    .find((part) => part.type === "timeZoneName")?.value;
  const match = label?.match(/GMT([+-])(\d{1,2})(?::(\d{2}))?/);
  if (!match) return "-06:00";
  return `${match[1]}${match[2].padStart(2, "0")}:${match[3] || "00"}`;
}

function dueTime(prompt: string) {
  const match = prompt.match(
    /\bat\s+(\d{1,2})(?::(\d{2}))?\s*(a\.?m\.?|p\.?m\.?)\b/i,
  );
  if (!match) return { hour: 17, minute: 0 };
  let hour = Number(match[1]) % 12;
  if (/^p/i.test(match[3])) hour += 12;
  return { hour, minute: Number(match[2] || 0) };
}

function automaticDueDate(now: Date, businessDays: number) {
  const current = chicagoDateParts(now);
  const date = new Date(
    Date.UTC(current.year, current.month - 1, current.day, 12),
  );
  let remaining = Math.max(1, businessDays);
  while (remaining > 0) {
    date.setUTCDate(date.getUTCDate() + 1);
    const weekday = date.getUTCDay();
    if (weekday !== 0 && weekday !== 6) remaining -= 1;
  }
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}T17:00:00${chicagoOffset(date)}`;
}

function taskBusinessDays(input: {
  title: string;
  description: string;
  priority: "LOW" | "NORMAL" | "HIGH" | "URGENT";
}) {
  if (input.priority === "URGENT") return 1;
  if (input.priority === "HIGH") return 3;
  if (input.priority === "LOW") return 14;
  const text = `${input.title} ${input.description}`.toLowerCase();
  if (/\b(blocked|blocking|failure|failed|broken|safety|repair|fix)\b/.test(text))
    return 2;
  if (/\b(approve|approval|review|verify|verification)\b/.test(text)) return 3;
  if (/\b(write|document|consult|follow[- ]?up|decision)\b/.test(text))
    return 5;
  if (/\b(order|purchase|procure|vendor|shipment)\b/.test(text)) return 10;
  return 7;
}

/**
 * Supplies practical deadlines only for newly created, actionable records.
 * Explicit dates from the user or document always win.
 */
export function applyAutomaticDueDates(
  commands: AssistantCommand[],
  now = new Date(),
) {
  return commands.map((command): AssistantCommand => {
    if (command.kind === "TASK_CREATE" && !command.dueAt) {
      return {
        ...command,
        dueAt: automaticDueDate(now, taskBusinessDays(command)),
      };
    }
    if (command.kind === "TASK_BATCH_CREATE") {
      return {
        ...command,
        tasks: command.tasks.map((task) => ({
          ...task,
          dueAt:
            task.dueAt ||
            automaticDueDate(now, taskBusinessDays(task)),
        })),
      };
    }
    if (command.kind === "ENGINEERING_RECORD_CREATE" && !command.dueAt) {
      const days =
        command.priority === "CRITICAL"
          ? 1
          : command.priority === "HIGH"
            ? 3
            : command.recordType === "CORRECTIVE_ACTION" ||
                command.recordType === "ISSUE"
              ? 3
              : command.recordType === "DEPENDENCY"
                ? 5
                : command.recordType === "ENGINEERING_QUESTION"
                  ? 7
                  : 14;
      return { ...command, dueAt: automaticDueDate(now, days) };
    }
    if (command.kind === "CONTROL_RECORD_CREATE" && !command.dueAt) {
      const daysByArea: Partial<Record<typeof command.area, number>> = {
        APPROVAL: 3,
        RISK: 3,
        DEPENDENCY: 5,
        RESPONSIBILITY: 7,
        AUTOMATION: 10,
        TECH_DEBT: 14,
        KNOWLEDGE_GAP: 14,
      };
      const days = daysByArea[command.area];
      return days
        ? { ...command, dueAt: automaticDueDate(now, days) }
        : command;
    }
    if (command.kind === "PURCHASE_CREATE" && !command.neededBy) {
      return { ...command, neededBy: automaticDueDate(now, 10) };
    }
    return command;
  });
}

export function relativeDueDate(
  prompt: string,
  now = new Date(),
): string | null {
  if (!/\b(?:due|by)\b/i.test(prompt)) return null;
  const current = chicagoDateParts(now);
  const base = new Date(
    Date.UTC(current.year, current.month - 1, current.day, 12),
  );
  let daysToAdd: number | null = null;

  if (/\b(?:due|by)(?:\s+date)?\s+(?:is\s+)?today\b/i.test(prompt)) {
    daysToAdd = 0;
  } else if (
    /\b(?:due|by)(?:\s+date)?\s+(?:is\s+)?tomorrow\b/i.test(prompt)
  ) {
    daysToAdd = 1;
  } else {
    const duration = prompt.match(
      /\b(?:due|by)(?:\s+date)?\s+(?:is\s+)?in\s+(\d{1,3})\s+(day|days|week|weeks)\b/i,
    );
    if (duration) {
      daysToAdd =
        Number(duration[1]) * (/week/i.test(duration[2]) ? 7 : 1);
    }
  }

  if (daysToAdd === null) {
    const weekday = prompt.match(
      /\b(?:due|by)(?:\s+date)?\s+(?:is\s+)?(?:(next|this)\s+)?(sunday|monday|tuesday|wednesday|thursday|friday|saturday)\b/i,
    );
    if (weekday) {
      const target = weekdays.indexOf(
        weekday[2].toLowerCase() as (typeof weekdays)[number],
      );
      daysToAdd = (target - current.weekday + 7) % 7;
      if (weekday[1]?.toLowerCase() === "next" && daysToAdd === 0)
        daysToAdd = 7;
    }
  }
  if (daysToAdd === null) return null;

  base.setUTCDate(base.getUTCDate() + daysToAdd);
  const year = base.getUTCFullYear();
  const month = String(base.getUTCMonth() + 1).padStart(2, "0");
  const day = String(base.getUTCDate()).padStart(2, "0");
  const time = dueTime(prompt);
  const hour = String(time.hour).padStart(2, "0");
  const minute = String(time.minute).padStart(2, "0");
  return `${year}-${month}-${day}T${hour}:${minute}:00${chicagoOffset(base)}`;
}

function cleanTaskTitle(title: string) {
  return title
    .replace(
      /(?:,\s*|\s+)(?:(?:and\s+)?(?:have|make)\s+it\s+)?(?:due|by)(?:\s+date)?\s+(?:is\s+)?(?:(?:next|this)\s+)?(?:sunday|monday|tuesday|wednesday|thursday|friday|saturday|today|tomorrow|in\s+\d{1,3}\s+(?:days?|weeks?))(?:\s+at\s+\d{1,2}(?::\d{2})?\s*(?:a\.?m\.?|p\.?m\.?))?[,.]?\s*$/i,
      "",
    )
    .replace(/[,\s]+$/, "")
    .trim();
}

export function applyNaturalLanguageContext(
  commands: AssistantCommand[],
  prompt: string,
  now = new Date(),
) {
  const dueAt = relativeDueDate(prompt, now);
  const contextual = !dueAt ? commands : commands.map((command): AssistantCommand => {
    if (command.kind === "TASK_CREATE") {
      return {
        ...command,
        title: cleanTaskTitle(command.title) || command.title,
        dueAt,
      };
    }
    if (command.kind === "TASK_BATCH_CREATE") {
      return {
        ...command,
        tasks: command.tasks.map((task) => ({
          ...task,
          title: cleanTaskTitle(task.title) || task.title,
          dueAt: task.dueAt || dueAt,
        })),
      };
    }
    if (
      command.kind === "TASK_UPDATE" ||
      command.kind === "CONTROL_RECORD_CREATE" ||
      command.kind === "ENGINEERING_RECORD_CREATE"
    ) {
      return { ...command, dueAt };
    }
    if (command.kind === "PURCHASE_CREATE") {
      return { ...command, neededBy: command.neededBy || dueAt };
    }
    return command;
  });
  return applyAutomaticDueDates(contextual, now);
}
