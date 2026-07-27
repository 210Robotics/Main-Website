import { z } from "zod";

const optionalText = z.string().trim().max(500).optional();
const optionalMoney = z.number().finite().min(0).max(10_000_000).optional();

export const assistantHelpReply =
  "I can create and allocate tasks, meetings, events, attendance activities, scheduling polls, forms, recognition, purchasing requests, engineering records, sponsor prospects, BOM parts, budgets, notebook to-do lists, donation updates, and permission-protected Discord messages, DMs, synchronization, reminders, and calendar digests. You can also upload a DOCX, PDF, XLSX, or CSV and I will archive it before importing explicit action items.";

export const assistantCommandSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("TASK_CREATE"), title: z.string().trim().min(2).max(180), description: z.string().trim().max(4000).default(""), assignee: optionalText, priority: z.enum(["LOW", "NORMAL", "HIGH", "URGENT"]).default("NORMAL"), dueAt: optionalText }),
  z.object({ kind: z.literal("TASK_BATCH_CREATE"), tasks: z.array(z.object({ title: z.string().trim().min(2).max(180), description: z.string().trim().max(4000).default(""), assignee: optionalText, priority: z.enum(["LOW", "NORMAL", "HIGH", "URGENT"]).default("NORMAL"), dueAt: optionalText })).min(1).max(10) }),
  z.object({ kind: z.literal("TASK_COMPLETE"), task: z.string().trim().min(2).max(300) }),
  z.object({ kind: z.literal("TASK_ASSIGN"), task: z.string().trim().min(2).max(300), assignee: z.string().trim().min(1).max(300) }),
  z.object({ kind: z.literal("TASK_UPDATE"), task: z.string().trim().min(2).max(300), status: z.enum(["TODO", "IN_PROGRESS", "BLOCKED", "IN_REVIEW", "DONE"]).optional(), priority: z.enum(["LOW", "NORMAL", "HIGH", "URGENT"]).optional(), dueAt: optionalText, description: z.string().trim().max(4000).optional() }),
  z.object({ kind: z.literal("TASK_COMMENT"), task: z.string().trim().min(2).max(300), comment: z.string().trim().min(1).max(4000), isDeliverable: z.boolean().default(false) }),
  z.object({ kind: z.literal("HOUR_LOG"), member: optionalText, hours: z.number().finite().positive().max(24), date: optionalText, project: z.string().trim().max(200).default("Team operations"), category: z.string().trim().max(120).default("General"), description: z.string().trim().min(2).max(2000) }),
  z.object({ kind: z.literal("BOM_ADD"), partNumber: z.string().trim().min(1).max(200), name: z.string().trim().min(1).max(500), description: z.string().trim().max(5000).default(""), project: z.string().trim().max(300).default("VEX U"), quantity: z.number().int().min(1).max(9999).default(1), revision: z.string().trim().max(100).default("A"), material: z.string().trim().max(300).default(""), supplier: z.string().trim().max(300).default(""), makeBuy: z.enum(["MAKE", "BUY"]).default("MAKE"), unitCost: optionalMoney }),
  z.object({ kind: z.literal("BOM_UPDATE"), part: z.string().trim().min(1).max(300), name: optionalText, project: optionalText, quantity: z.number().int().min(1).max(9999).optional(), revision: optionalText, material: optionalText, supplier: optionalText, unitCost: optionalMoney }),
  z.object({ kind: z.literal("BUDGET_ADD"), plan: optionalText, entryKind: z.enum(["EXPENSE", "INCOME", "BUDGET_ITEM"]).default("EXPENSE"), description: z.string().trim().min(2).max(1000), category: z.string().trim().max(200).default("General"), amount: z.number().finite().min(0).max(10_000_000), quantity: z.number().int().min(1).max(9999).default(1), vendor: z.string().trim().max(300).default("") }),
  z.object({ kind: z.literal("BUDGET_UPDATE"), entry: z.string().trim().min(1).max(500), plan: optionalText, description: z.string().trim().min(2).max(1000).optional(), category: z.string().trim().max(200).optional(), amount: optionalMoney, quantity: z.number().int().min(1).max(9999).optional(), vendor: z.string().trim().max(300).optional(), status: z.enum(["PLANNED", "APPROVED", "ORDERED", "PAID", "RECEIVED", "CANCELED"]).optional() }),
  z.object({ kind: z.literal("BUDGET_LIMITS"), plan: z.string().trim().min(1).max(300), minimum: z.number().finite().min(0).max(10_000_000), maximum: z.number().finite().min(0).max(10_000_000) }),
  z.object({ kind: z.literal("BUDGET_STATUS"), plan: optionalText }),
  z.object({ kind: z.literal("DONATION_STATUS") }),
  z.object({ kind: z.literal("NEXT_EVENT") }),
  z.object({ kind: z.literal("DONATION_CAMPAIGN"), title: z.string().trim().min(2).max(120).optional(), description: z.string().trim().min(2).max(600).optional(), goal: z.number().finite().min(1).max(10_000_000).optional(), suggestedAmounts: z.array(z.number().finite().min(1).max(50_000)).min(1).max(10).optional(), active: z.boolean().optional() }),
  z.object({ kind: z.literal("NOTEBOOK_TODO"), entry: optionalText, items: z.array(z.string().trim().min(1).max(500)).min(1).max(20) }),
  z.object({ kind: z.literal("MEETING_CREATE"), title: z.string().trim().min(2).max(180), heldAt: optionalText, location: z.string().trim().max(300).default(""), notes: z.string().trim().max(10_000).default("") }),
  z.object({ kind: z.literal("ACTIVITY_CREATE"), title: z.string().trim().min(2).max(180), activityType: z.enum(["EVENT", "WORKSHOP", "MEETING", "OUTREACH", "TRAINING"]).default("EVENT"), startsAt: optionalText, endsAt: optionalText, location: z.string().trim().max(300).default(""), description: z.string().trim().max(4000).default("") }),
  z.object({ kind: z.literal("POLL_CREATE"), title: z.string().trim().min(2).max(180), description: z.string().trim().max(2000).default(""), dates: z.array(z.string().trim().min(8).max(20)).max(31).default([]), startTime: z.string().trim().max(10).default("18:00"), endTime: z.string().trim().max(10).default("21:00") }),
  z.object({ kind: z.literal("FORM_CREATE"), title: z.string().trim().min(2).max(180), description: z.string().trim().max(2000).default(""), fields: z.array(z.object({ label: z.string().trim().min(1).max(300), type: z.enum(["SHORT_TEXT", "LONG_TEXT", "MULTIPLE_CHOICE", "MULTI_SELECT", "DROPDOWN", "DATE", "EMAIL", "NUMBER", "LINK", "FILE_UPLOAD"]).default("SHORT_TEXT"), required: z.boolean().default(false), options: z.array(z.string().trim().min(1).max(200)).max(20).default([]) })).max(30).default([]) }),
  z.object({ kind: z.literal("RECOGNITION_CREATE"), title: z.string().trim().min(2).max(180), member: z.string().trim().min(1).max(300), category: z.enum(["MILESTONE", "CERTIFICATION", "CONTRIBUTION", "LEADERSHIP", "SAFETY"]).default("CONTRIBUTION"), description: z.string().trim().max(4000).default("") }),
  z.object({ kind: z.literal("ATTENDANCE_RECORD"), activity: z.string().trim().min(2).max(300), member: z.string().trim().min(1).max(300), status: z.literal("PRESENT").default("PRESENT"), note: z.string().trim().max(1000).default("") }),
  z.object({ kind: z.literal("NEWS_CREATE"), title: z.string().trim().min(2).max(180), excerpt: z.string().trim().max(500).default(""), body: z.string().trim().min(2).max(30_000), status: z.enum(["DRAFT", "PUBLISHED"]).default("DRAFT") }),
  z.object({ kind: z.literal("INVENTORY_UPSERT"), sku: z.string().trim().min(1).max(120), name: z.string().trim().max(500).optional(), quantityOnHand: z.number().int().min(0).max(1_000_000).optional(), reorderPoint: z.number().int().min(0).max(1_000_000).optional(), location: z.string().trim().max(300).optional(), category: z.string().trim().max(200).optional(), unitCost: optionalMoney, supplier: z.string().trim().max(300).optional() }),
  z.object({ kind: z.literal("CONTROL_RECORD_CREATE"), area: z.enum(["LEADERSHIP", "RISK", "APPROVAL", "DEPENDENCY", "TECH_DEBT", "KNOWLEDGE_GAP", "RESPONSIBILITY", "TEMPLATE", "AUTOMATION", "SPONSOR", "GENERAL"]).default("GENERAL"), title: z.string().trim().min(2).max(180), description: z.string().trim().max(5000).default(""), owner: optionalText, priority: z.enum(["LOW", "NORMAL", "HIGH", "CRITICAL"]).default("NORMAL"), dueAt: optionalText }),
  z.object({ kind: z.literal("SPONSOR_FUNDING"), plan: optionalText, sponsorName: z.string().trim().min(2).max(300), amount: z.number().finite().min(0).max(10_000_000), status: z.enum(["PROSPECT", "PLEDGED", "COMMITTED", "RECEIVED"]).default("PLEDGED"), tier: z.string().trim().max(120).default("Partner"), contactName: z.string().trim().max(300).default(""), contactEmail: z.string().trim().max(500).default("") }),
  z.object({ kind: z.literal("PURCHASE_CREATE"), item: z.string().trim().min(2).max(500), quantity: z.number().int().min(1).max(9999).default(1), vendor: z.string().trim().max(300).default(""), estimatedUnitCost: optionalMoney, neededBy: optionalText, notes: z.string().trim().max(4000).default("") }),
  z.object({ kind: z.literal("ENGINEERING_RECORD_CREATE"), recordType: z.enum(["ENGINEERING_QUESTION", "TECH_DEBT", "CORRECTIVE_ACTION", "DEPENDENCY", "ISSUE"]), title: z.string().trim().min(2).max(180), description: z.string().trim().max(4000).default(""), priority: z.enum(["LOW", "NORMAL", "HIGH", "CRITICAL"]).default("NORMAL"), dueAt: optionalText }),
  z.object({
    kind: z.literal("DECISION_MATRIX_CREATE"),
    title: z.string().trim().min(2).max(180),
    criteria: z.array(z.object({
      name: z.string().trim().min(1).max(120),
      weight: z.number().finite().min(0).max(10_000),
      goal: z.enum(["SCORE", "HIGHER", "LOWER"]).default("SCORE"),
    })).min(1).max(20),
    concepts: z.array(z.object({
      name: z.string().trim().min(1).max(160),
      values: z.array(z.number().finite()).min(1).max(20),
    })).min(2).max(50),
    recommendation: z.string().trim().max(4000).default(""),
  }),
  z.object({ kind: z.literal("SPONSOR_RESEARCH"), company: z.string().trim().min(2).max(300), website: z.string().trim().url().max(1000).optional() }),
  z.object({ kind: z.literal("DISCORD_SEND"), channel: z.string().trim().min(1).max(200), message: z.string().trim().min(1).max(1800), mentions: z.array(z.string().trim().min(1).max(300)).max(5).default([]), mentionEveryone: z.boolean().default(false) }),
  z.object({ kind: z.literal("DISCORD_DM"), member: z.string().trim().min(1).max(300), message: z.string().trim().min(1).max(1900) }),
  z.object({ kind: z.literal("DISCORD_SYNC"), includeMessages: z.boolean().default(true) }),
  z.object({ kind: z.literal("DISCORD_CALENDAR_REMINDERS") }),
  z.object({ kind: z.literal("DISCORD_MONTHLY_DIGEST") }),
  z.object({ kind: z.literal("DISCORD_TIMEOUT"), member: z.string().trim().min(1).max(300), durationMinutes: z.number().int().min(0).max(40_320), reason: z.string().trim().max(400).default("") }),
  z.object({ kind: z.literal("CHAT"), reply: z.string().trim().min(1).max(2000) }),
]);

export type AssistantCommand = z.infer<typeof assistantCommandSchema>;

export function isUuidReference(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    value.trim(),
  );
}

function money(prompt: string) {
  const match = prompt.match(/\$\s*([\d,]+(?:\.\d{1,2})?)/);
  return match ? Number(match[1].replaceAll(",", "")) : undefined;
}

export function inferAssistantCommand(promptValue: string): AssistantCommand | null {
  const prompt = promptValue.trim();
  const lower = prompt.toLowerCase();
  if (
    /\bdiscord\b.*\b(?:monthly|month)\b.*\b(?:digest|calendar)\b/i.test(
      prompt,
    )
  )
    return { kind: "DISCORD_MONTHLY_DIGEST" };
  if (
    /\bdiscord\b.*\b(?:calendar|event)\b.*\b(?:reminder|announce|announcement)\b/i.test(
      prompt,
    )
  )
    return { kind: "DISCORD_CALENDAR_REMINDERS" };
  if (
    /\b(?:sync|refresh)\b.*\bdiscord\b/i.test(prompt) ||
    /\bdiscord\b.*\b(?:sync|refresh)\b/i.test(prompt)
  )
    return { kind: "DISCORD_SYNC", includeMessages: true };
  const clearTimeout = prompt.match(
    /(?:clear|remove|end)\s+(?:the\s+)?(?:discord\s+)?timeout\s+(?:for|on)\s+(.+?)(?:\s+on\s+discord)?[.!]?$/i,
  );
  if (clearTimeout)
    return {
      kind: "DISCORD_TIMEOUT",
      member: clearTimeout[1].trim(),
      durationMinutes: 0,
      reason: "",
    };
  const timeout = prompt.match(
    /(?:timeout|time\s+out)\s+(.+?)\s+(?:on\s+discord\s+)?for\s+(\d+)\s*(minutes?|mins?|hours?|hrs?|days?)(?:\s+(?:because|reason)\s*[:,-]?\s*(.+))?$/i,
  );
  if (timeout) {
    const value = Number(timeout[2]);
    const unit = timeout[3].toLowerCase();
    const multiplier = unit.startsWith("day")
      ? 1_440
      : unit.startsWith("hour") || unit.startsWith("hr")
        ? 60
        : 1;
    const durationMinutes = value * multiplier;
    if (durationMinutes <= 40_320)
      return {
        kind: "DISCORD_TIMEOUT",
        member: timeout[1].trim(),
        durationMinutes,
        reason: timeout[4]?.trim() || "",
      };
  }
  const discordDm = prompt.match(
    /^(?:please\s+)?(?:send\s+)?(?:a\s+)?(?:discord\s+)?dm\s+(?:to\s+)?(.+?)(?:\s+on\s+discord)?\s*[:,-]\s*(.+)$/i,
  );
  if (discordDm)
    return {
      kind: "DISCORD_DM",
      member: discordDm[1].trim(),
      message: discordDm[2].trim(),
    };
  const discordMessage = prompt.match(
    /^(?:please\s+)?(?:send|post)\s+(?:a\s+)?(?:discord\s+)?message\s+(?:to|in)\s+#?([a-zA-Z0-9_-]+)\s*[:,-]\s*(.+)$/i,
  );
  if (discordMessage) {
    const rawMessage = discordMessage[2].trim();
    const mentionEveryone =
      /@everyone|\b(?:tag|notify|mention)\s+everyone\b|\bserver-wide notification\b/i.test(
        prompt,
      );
    const message = rawMessage
      .replace(
        /\s*(?:[,;—-]\s*)?(?:and\s+)?(?:tag|notify|mention)\s+everyone[.!]?\s*$/i,
        "",
      )
      .trim();
    return {
      kind: "DISCORD_SEND",
      channel: discordMessage[1],
      message,
      mentions: [],
      mentionEveryone,
    };
  }
  if (
    /\b(?:current|total|how much|amount)\b.*\b(?:donation|donations|donated|raised|fundraising)\b/i.test(
      prompt,
    ) ||
    /\b(?:donation|donations|fundraising)\b.*\b(?:current|total|raised|received)\b/i.test(
      prompt,
    )
  ) {
    return { kind: "DONATION_STATUS" };
  }
  if (
    /\b(?:how much|what(?:'s| is)|show)\b.*\b(?:money|budget|funds?)\b.*\b(?:left|remaining|available)\b/i.test(
      prompt,
    ) ||
    /\b(?:remaining|available)\s+(?:money|budget|funds?)\b/i.test(prompt)
  ) {
    const plan = prompt.match(
      /\bfor\s+(?:the\s+)?(?:budget\s+)?(?:plan\s+)?["']?(.+?)["']?\s*(?:\?|$)/i,
    )?.[1]?.trim();
    return { kind: "BUDGET_STATUS", plan };
  }
  if (
    /\b(?:when|what(?:'s| is)|show)\b.*\bnext\s+(?:event|meeting|activity)\b/i.test(
      prompt,
    ) ||
    /\bupcoming\s+(?:event|meeting|activity)\b/i.test(prompt)
  ) {
    return { kind: "NEXT_EVENT" };
  }
  const createAssignedTask = prompt.match(
    /^(?:please\s+)?assign\s+(?:a\s+)?(?:new\s+)?task\s*[,;:\-]\s*(.+?)\s*[,;]\s*to\s+(.+?)[.!]?$/i,
  );
  if (createAssignedTask) {
    return {
      kind: "TASK_CREATE",
      title: createAssignedTask[1].trim(),
      description: "",
      assignee: createAssignedTask[2].trim(),
      priority: /\b(urgent|critical)\b/i.test(prompt)
        ? "URGENT"
        : /\bhigh priority\b/i.test(prompt)
          ? "HIGH"
          : "NORMAL",
    };
  }
  const giveMemberTask = prompt.match(
    /^(?:please\s+)?(?:assign|give)\s+(.+?)\s+(?:a\s+)?(?:new\s+)?task\s+(?:to|for)\s+(.+?)[.!]?$/i,
  );
  if (giveMemberTask) {
    return {
      kind: "TASK_CREATE",
      title: giveMemberTask[2].trim(),
      description: "",
      assignee: giveMemberTask[1].trim(),
      priority: /\b(urgent|critical)\b/i.test(prompt)
        ? "URGENT"
        : /\bhigh priority\b/i.test(prompt)
          ? "HIGH"
          : "NORMAL",
    };
  }
  const comment = prompt.match(/(?:add|leave|post)\s+(?:a\s+)?(?:deliverable\s+)?comment\s+["']?(.+?)["']?\s+(?:to|on)\s+(?:the\s+)?task\s+["']?(.+?)["']?$/i);
  if (comment)
    return { kind: "TASK_COMMENT", task: comment[2].trim(), comment: comment[1].trim(), isDeliverable: /deliverable\s+comment/i.test(prompt) };
  const taskUpdate = prompt.match(/(?:update|change|set)\s+(?:the\s+)?task\s+["']?(.+?)["']?\s+(?:status|priority)\s+(?:to\s+)?(.+)$/i);
  if (taskUpdate) {
    const value = taskUpdate[2].trim().toLowerCase();
    const status = value.includes("progress") ? "IN_PROGRESS" : value.includes("block") ? "BLOCKED" : value.includes("review") ? "IN_REVIEW" : value.includes("done") || value.includes("complete") ? "DONE" : value.includes("todo") || value.includes("to do") ? "TODO" : undefined;
    const priority = value.includes("urgent") ? "URGENT" : value.includes("high") ? "HIGH" : value.includes("normal") ? "NORMAL" : value.includes("low") ? "LOW" : undefined;
    if (status || priority) return { kind: "TASK_UPDATE", task: taskUpdate[1].trim(), status, priority };
  }
  const complete = prompt.match(/(?:complete|finish|mark)\s+(?:the\s+)?(?:task\s+)?["']?(.+?)["']?\s*(?:as\s+done)?$/i);
  if (complete && /\b(task|complete|finish|done)\b/i.test(prompt))
    return { kind: "TASK_COMPLETE", task: complete[1].trim() };
  const assign = prompt.match(/assign\s+(?:the\s+)?(?:task\s+)?["']?(.+?)["']?\s+to\s+(.+)$/i);
  if (assign)
    return { kind: "TASK_ASSIGN", task: assign[1].trim(), assignee: assign[2].trim() };
  const needsTo = prompt.match(
    /^(?:please\s+)?([A-Za-z][A-Za-z .'-]{1,80}?)\s+(?:needs?|has|should)\s+to\s+(.+?)(?:\s+(?:by|due)\s+.+)?[.!]?$/i,
  );
  if (needsTo) {
    return {
      kind: "TASK_CREATE",
      title: needsTo[2].replace(/\s+(?:by|due)\s+.+$/i, "").trim(),
      description: prompt,
      assignee: needsTo[1].trim(),
      priority: /\b(?:urgent|critical)\b/i.test(prompt)
        ? "URGENT"
        : /\bhigh priority\b/i.test(prompt)
          ? "HIGH"
          : "NORMAL",
    };
  }
  const actionItem = prompt.match(
    /^(?:action\s+item|todo|to-do)\s*[:\-]\s*(.+?)(?:\s+(?:owner|assigned to)\s*[:\-]?\s*([A-Za-z][A-Za-z .'-]+))?[.!]?$/i,
  );
  if (actionItem) {
    return {
      kind: "TASK_CREATE",
      title: actionItem[1].trim(),
      description: prompt,
      assignee: actionItem[2]?.trim(),
      priority: "NORMAL",
    };
  }
  if (/\b(create|add|make|assign)\b.*\btask\b/i.test(prompt)) {
    const assignee = prompt.match(/\bto\s+([\w .@'-]+?)(?:\s+by\b|\s+due\b|$)/i)?.[1]?.trim();
    const title = prompt
      .replace(/^(?:please\s+)?(?:create|add|make|assign)\s+(?:a\s+)?(?:new\s+)?task\s*(?:to\s+[^:]+)?[:\-]?\s*/i, "")
      .replace(/\s+(?:to\s+[^,]+)?\s*(?:by|due)\s+.+$/i, "")
      .trim();
    return { kind: "TASK_CREATE", title: title || "New task", description: prompt, assignee, priority: /\b(urgent|critical)\b/i.test(prompt) ? "URGENT" : /\bhigh priority\b/i.test(prompt) ? "HIGH" : "NORMAL" };
  }
  const limits = prompt.match(/(?:set|change|update).+?(?:budget\s+)?(?:plan\s+)?["']?(.+?)["']?.+?min(?:imum)?\s*\$?([\d,.]+).+?max(?:imum)?\s*\$?([\d,.]+)/i);
  if (limits) return { kind: "BUDGET_LIMITS", plan: limits[1].trim(), minimum: Number(limits[2].replaceAll(",", "")), maximum: Number(limits[3].replaceAll(",", "")) };
  if (/\b(expense|income|budget item)\b/i.test(prompt) && money(prompt) !== undefined) {
    const update = prompt.match(/(?:update|change|edit)\s+(?:the\s+)?(?:expense|income|budget item)\s+["']?(.+?)["']?\s+(?:amount|cost|total)\s+(?:to\s+)?\$?[\d,.]+/i);
    if (update) return { kind: "BUDGET_UPDATE", entry: update[1].trim(), amount: money(prompt) };
    const entryKind = /\bincome\b/i.test(prompt) ? "INCOME" : /\bbudget item\b/i.test(prompt) ? "BUDGET_ITEM" : "EXPENSE";
    const plan = prompt.match(
      /\b(?:to|into|under|for)\s+(?:the\s+)?["']?(.+?)["']?\s+(?:budget|finance)(?:\s+plan)?\b/i,
    )?.[1]?.trim();
    return { kind: "BUDGET_ADD", plan, entryKind, description: prompt.replace(/^.*?\b(?:expense|income|budget item)\b[:\s-]*/i, "").trim(), category: "General", amount: money(prompt)!, quantity: 1, vendor: "" };
  }
  const part = prompt.match(/(?:part|bom item)\s+([A-Za-z0-9_.-]+)/i)?.[1];
  if (part && /\b(update|change|set)\b/i.test(prompt)) {
    const quantity = prompt.match(/\b(?:quantity|qty)\s*(?:to|=|:)??\s*(\d+)/i)?.[1];
    const revision = prompt.match(/\b(?:revision|rev)\s*(?:to|=|:)??\s*([A-Za-z0-9_.-]+)/i)?.[1];
    const cost = money(prompt);
    return { kind: "BOM_UPDATE", part, quantity: quantity ? Number(quantity) : undefined, revision, unitCost: cost };
  }
  if (part && /\b(add|create)\b/i.test(prompt)) {
    const quantity = Number(prompt.match(/\b(?:quantity|qty)\s*(?:=|:)??\s*(\d+)/i)?.[1] || "1");
    return { kind: "BOM_ADD", partNumber: part, name: prompt.match(/\bname\s*(?:=|:)\s*["']?([^,"']+)/i)?.[1]?.trim() || part, description: "", project: "VEX U", quantity, revision: "A", material: "", supplier: "", makeBuy: "MAKE", unitCost: money(prompt) };
  }
  if (/\b(donation|fundraiser|fundraising|campaign)\b/i.test(prompt)) {
    const active = /\b(?:pause|disable|close|stop)\b/i.test(prompt)
      ? false
      : /\b(?:resume|enable|open|activate)\b/i.test(prompt)
        ? true
        : undefined;
    const goal = /\bgoal\b/i.test(prompt) ? money(prompt) : undefined;
    const presetsText = prompt.match(/(?:suggested amounts|presets?)\s+(?:to\s+)?(.+)$/i)?.[1];
    const suggestedAmounts = presetsText
      ? [...presetsText.matchAll(/\$?([\d,]+(?:\.\d{1,2})?)/g)]
          .map((match) => Number(match[1].replaceAll(",", "")))
          .filter((amount) => amount >= 1 && amount <= 50_000)
      : undefined;
    if (active !== undefined || goal !== undefined || suggestedAmounts?.length)
      return { kind: "DONATION_CAMPAIGN", active, goal, suggestedAmounts };
  }
  const notebookTodo = prompt.match(/(?:notebook\s+)?(?:to-?do|checklist)\s*(?:for\s+(?:page|entry)\s+["']?(.+?)["']?)?\s*:\s*(.+)$/i);
  if (notebookTodo) {
    const items = notebookTodo[2]
      .split(/[,;\n]+/)
      .map((item) => item.trim())
      .filter(Boolean);
    if (items.length)
      return { kind: "NOTEBOOK_TODO", entry: notebookTodo[1]?.trim(), items };
  }
  if (/\b(help|what can you do)\b/i.test(lower))
    return { kind: "CHAT", reply: assistantHelpReply };
  return null;
}
