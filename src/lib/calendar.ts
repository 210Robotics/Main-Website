import "server-only";
import { and, eq, isNull, ne } from "drizzle-orm";
import { getDb, hasDatabase } from "@/db";
import { calendarSnapshots, teamActivities } from "@/db/schema";

export type CalendarEvent = {
  id: string;
  title: string;
  description: string;
  location: string;
  start: string;
  end: string;
  allDay: boolean;
  googleUrl: string;
  source?: "google" | "210";
  type?: string;
};

const calendarId = "c_95f57b77ce9cc3321b6d5ee44042d9f8920481babe4dd9e33f511458453f721e@group.calendar.google.com";
const feedUrl = `https://calendar.google.com/calendar/ical/${encodeURIComponent(calendarId)}/public/basic.ics`;
const calendarUrl = `https://calendar.google.com/calendar/embed?src=${encodeURIComponent(calendarId)}&ctz=America%2FChicago`;

function unescapeIcs(value = "") {
  return value.replace(/\\n/gi, "\n").replace(/\\,/g, ",").replace(/\\;/g, ";").replace(/\\\\/g, "\\").replace(/<[^>]*>/g, "").trim();
}

function zonedDate(value: string, timeZone: string) {
  const match = value.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})/);
  if (!match) return null;
  const parts = match.slice(1).map(Number);
  const assumedUtc = Date.UTC(parts[0], parts[1] - 1, parts[2], parts[3], parts[4], parts[5]);
  const formatter = new Intl.DateTimeFormat("en-US", { timeZone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" });
  const displayed = Object.fromEntries(formatter.formatToParts(new Date(assumedUtc)).map((part) => [part.type, part.value]));
  const offset = Date.UTC(Number(displayed.year), Number(displayed.month) - 1, Number(displayed.day), Number(displayed.hour), Number(displayed.minute), Number(displayed.second)) - assumedUtc;
  return new Date(assumedUtc - offset);
}

function parseDate(line: string) {
  const split = line.indexOf(":");
  const property = line.slice(0, split);
  const value = line.slice(split + 1).trim();
  const allDay = /VALUE=DATE/i.test(property) || /^\d{8}$/.test(value);
  if (allDay) return { date: new Date(Date.UTC(Number(value.slice(0, 4)), Number(value.slice(4, 6)) - 1, Number(value.slice(6, 8)))), allDay: true };
  if (value.endsWith("Z")) {
    const match = value.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/);
    if (!match) return null;
    const p = match.slice(1).map(Number);
    return { date: new Date(Date.UTC(p[0], p[1] - 1, p[2], p[3], p[4], p[5])), allDay: false };
  }
  const zone = property.match(/TZID=([^;:]+)/i)?.[1] ?? "America/Chicago";
  const date = zonedDate(value, zone);
  return date ? { date, allDay: false } : null;
}

function valueFor(lines: string[], name: string) {
  const line = lines.find((entry) => entry.startsWith(`${name}:`) || entry.startsWith(`${name};`));
  return line ? line.slice(line.indexOf(":") + 1) : "";
}

function occurrences(start: Date, rule: string, windowEnd: Date) {
  if (!rule) return [start];
  const values = Object.fromEntries(rule.split(";").map((part) => part.split("=", 2)));
  const interval = Math.max(1, Number(values.INTERVAL || 1));
  const count = Math.min(500, Math.max(1, Number(values.COUNT || 500)));
  const until = values.UNTIL ? parseDate(`DTSTART:${values.UNTIL}`)?.date : null;
  const output: Date[] = [];
  const current = new Date(start);
  for (let index = 0; index < count && current <= windowEnd && (!until || current <= until); index++) {
    output.push(new Date(current));
    if (values.FREQ === "DAILY") current.setUTCDate(current.getUTCDate() + interval);
    else if (values.FREQ === "WEEKLY") current.setUTCDate(current.getUTCDate() + 7 * interval);
    else if (values.FREQ === "MONTHLY") current.setUTCMonth(current.getUTCMonth() + interval);
    else if (values.FREQ === "YEARLY") current.setUTCFullYear(current.getUTCFullYear() + interval);
    else break;
  }
  return output;
}

async function getGoogleCalendarEvents(forceRefresh = false): Promise<CalendarEvent[]> {
  const response = await fetch(
    feedUrl,
    forceRefresh
      ? { cache: "no-store" }
      : { next: { revalidate: 900, tags: ["calendar"] } },
  );
  if (!response.ok) throw new Error(`Calendar returned ${response.status}`);
  const unfolded = (await response.text()).replace(/\r?\n[ \t]/g, "");
  const blocks = [...unfolded.matchAll(/BEGIN:VEVENT\r?\n([\s\S]*?)\r?\nEND:VEVENT/g)].map((match) => match[1].split(/\r?\n/));
  const now = new Date();
  const windowStart = new Date(now.getTime() - 45 * 86400000);
  const windowEnd = new Date(now); windowEnd.setFullYear(windowEnd.getFullYear() + 1);
  const events: CalendarEvent[] = [];

  for (const lines of blocks) {
    const startLine = lines.find((line) => line.startsWith("DTSTART"));
    const endLine = lines.find((line) => line.startsWith("DTEND"));
    if (!startLine || !endLine) continue;
    const parsedStart = parseDate(startLine);
    const parsedEnd = parseDate(endLine);
    if (!parsedStart || !parsedEnd) continue;
    const duration = parsedEnd.date.getTime() - parsedStart.date.getTime();
    const uid = unescapeIcs(valueFor(lines, "UID"));
    for (const start of occurrences(parsedStart.date, valueFor(lines, "RRULE"), windowEnd)) {
      const end = new Date(start.getTime() + duration);
      if (end < windowStart || start > windowEnd) continue;
      events.push({
        id: `${uid}-${start.toISOString()}`,
        title: unescapeIcs(valueFor(lines, "SUMMARY")) || "210 Robotics event",
        description: unescapeIcs(valueFor(lines, "DESCRIPTION")),
        location: unescapeIcs(valueFor(lines, "LOCATION")),
        start: start.toISOString(),
        end: end.toISOString(),
        allDay: parsedStart.allDay,
        googleUrl: calendarUrl,
        source: "google",
      });
    }
  }
  return events.sort((a, b) => a.start.localeCompare(b.start));
}

export async function getCalendarEvents(): Promise<CalendarEvent[]> {
  const teamEvents = await getPublicTeamEvents();
  try {
    const googleEvents = await getGoogleCalendarEvents();
    return [...googleEvents, ...teamEvents].sort((a, b) => a.start.localeCompare(b.start));
  } catch (error) {
    console.error("Calendar sync failed", error);
    return teamEvents;
  }
}

export async function refreshCalendarEvents() {
  const events = await getGoogleCalendarEvents(true);
  const syncedAt = new Date();
  if (hasDatabase()) {
    const snapshot: Record<string, unknown>[] = events.map((event) => ({ ...event }));
    await getDb()
      .insert(calendarSnapshots)
      .values({ id: "shared", events: snapshot, syncedAt })
      .onConflictDoUpdate({
        target: calendarSnapshots.id,
        set: { events: snapshot, syncedAt },
      });
  }
  return { count: events.length, syncedAt, events };
}

async function getPublicTeamEvents(): Promise<CalendarEvent[]> {
  if (!hasDatabase()) return [];
  try {
    const rows = await getDb().select().from(teamActivities).where(and(eq(teamActivities.isPublic, true), isNull(teamActivities.archivedAt), ne(teamActivities.status, "CANCELED")));
    return rows.map((activity) => ({
      id: `210-${activity.id}`,
      title: activity.title,
      description: activity.description,
      location: activity.location || "",
      start: activity.startsAt.toISOString(),
      end: activity.endsAt.toISOString(),
      allDay: false,
      googleUrl: calendarUrl,
      source: "210" as const,
      type: activity.type,
    }));
  } catch (error) {
    console.error("Public activity sync failed", error);
    return [];
  }
}
