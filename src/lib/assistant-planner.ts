import "server-only";

import {
  assistantCommandSchema,
  type AssistantCommand,
} from "@/lib/assistant-commands";
import { generateGeminiText, teamAiIsConfigured } from "@/lib/team-ai";
import {
  applyAutomaticDueDates,
  applyNaturalLanguageContext,
} from "@/lib/assistant-context";

const plannerInstructions = `You are the secure command planner for the private 210 Robotics administration portal.
Read the user's entire request carefully, including ordinary language, fragments, misspellings, and references to recent conversation. Determine the intended outcome before selecting a command.
Convert the request into one or more supported commands that together achieve the user's outcome. Preserve the names, titles, part numbers, plan names, dates, and values supplied by the user so the application can resolve the real records. Never invent a database identifier, member, task, part, or finance plan. Do not perform destructive actions.
Use CHAT for questions, explanations, unsupported actions, or when a required detail is genuinely missing. For a missing detail, ask one short, specific follow-up question. For a question, answer it directly and concisely instead of returning a generic capability list.
When a prompt contains multiple actions, return each action in the order it should be executed. When it mixes a question and an action, include both when the question maps to a live-data command. Do not claim an action succeeded; the application will report execution results.

Supported work:
- Create, assign, update, comment on, or complete tasks.
- Allocate up to 10 new tasks to different members in one request.
- Add or update BOM parts. A BOM update automatically creates a design-change review.
- Add or update expenses, income, budget items, and budget limits.
- Answer live questions about remaining budget, the next event, the current donation total, donor count, campaign goal, and recent fundraising.
- Add an actionable to-do checklist to a named notebook page, or the latest page when none is named.
- Update the public donation campaign title, message, goal, presets, or active state.
- Create meetings, events, attendance activities, scheduling polls, and forms.
- Create recognition, purchase requests, engineering tracking records, decision matrices, and sponsor research records.
- Log member hours and attendance, draft or publish news, update inventory, add sponsor funding, and create records for the Control Center.
- Send a message to a named Discord channel, privately message a linked member, synchronize Discord members/messages, announce eligible calendar reminders, or publish the upcoming-month calendar digest. Discord actions are permission-protected by the application.

Dates should be ISO timestamps when the user gives enough information. Amounts are dollar values, not cents.`;

const interpretationRules = `
Natural-language interpretation rules:
- Do not require command syntax, punctuation, field labels, or a particular word order. Infer the outcome from the whole request.
- Correct obvious spelling mistakes and understand conversational verbs such as "put", "make", "give", "track", "record", "log", "publish", "remember", and "add this to".
- Use surrounding nouns to select the area: work/time/hours -> HOUR_LOG; article/update/blog/news -> NEWS_CREATE; stock/on hand/bin/reorder -> INVENTORY_UPSERT; present/attendance/check in -> ATTENDANCE_RECORD; risk/approval/dependency/leadership/owner -> CONTROL_RECORD_CREATE; sponsor pledge/commitment/gift -> SPONSOR_FUNDING.
- Choose DECISION_MATRIX_CREATE only when the request says decision matrix, concept comparison/selection, weighted scoring, trade study, or unmistakably asks to score several design alternatives against criteria. A wide table, a budget plan, or several rows by itself is not a decision matrix.
- Choose BUDGET_ADD, BUDGET_UPDATE, or BUDGET_LIMITS only when the request includes finance evidence such as budget, expense, income, cost, price, vendor, funding, amount, or a priced-material table. Preserve the named budget plan in the plan field.
- Treat softer action cues as task intent: "needs to", "should finish", "follow up", "have [person] do", an owner plus a deadline, or an action item all indicate TASK_CREATE unless the user clearly names another record type.
- Classify from the user's goal and domain words before considering table shape. When two record types are plausible, prefer the type named by the user and do not create the other type as a guess.
- A priced material list normally becomes BUDGET_ADD expense or budget-item commands; a parts list with part numbers and quantities normally becomes BOM_ADD commands.
- If the user provides several independent items, return several commands. Do not collapse them into one description field.
- Use recent conversation only for clear pronouns or omitted record names. Never invent missing money amounts, people, dates, part numbers, or record identities.
- If a request is only asking where to sign in or open an admin area, return CHAT with a concise answer and a Markdown link to the relevant site page.
- Choose a DISCORD command only when the user explicitly says Discord, bot, a Discord channel, DM, server sync, Discord reminder, or Discord calendar digest. A normal task that happens to mention messaging remains a task unless Discord is explicit.
- For DISCORD_SEND, preserve the named channel without a leading # when possible, keep the exact message content, and put people who should be tagged in mentions. Set mentionEveryone true only when the user explicitly says @everyone, tag everyone, notify everyone, or server-wide notification. For DISCORD_DM, require one named member. Never infer recipients or send a server-wide broadcast.`;

const taskPlanningRules = `
Task intent rules:
- Use TASK_CREATE when the user describes new work to be done, including shorthand such as "Assign Task, Update google Calendar, to Dyshana", "make Alex do the intake inspection", or "give Sam a task to update sponsors." The task title in the first example is "Update Google Calendar" and the assignee is "Dyshana".
- Use TASK_ASSIGN only when the user clearly refers to an already-existing task and wants its assignee changed.
- Use TASK_BATCH_CREATE when two or more new work items are allocated in one request.`;

const datePlanningRules = `
Date and deadline rules:
- The current date and time in America/Chicago are supplied with every request. Resolve relative phrases from that value.
- "due next Friday", "by tomorrow", "due in two weeks", and similar phrases belong in dueAt as an ISO timestamp. They are never part of a task title.
- If no time is supplied for a task deadline, use 5:00 PM America/Chicago.
- When creating actionable work without an explicit deadline, choose a practical due date based on urgency and scope. Explicit user dates always win. The application also applies safe business-day defaults when a date is omitted.
- Example: "Create a task to update the calendar, have it due next Friday, and assign it to Dyshana" becomes TASK_CREATE {title:"Update the calendar", assignee:"Dyshana", dueAt:<the next Friday at 5 PM Chicago time>}.`;

const bomPlanningRules = `
BOM intent rules:
- Treat "edit BOM to add", "put this in the BOM", "add a part", and similar wording as BOM_ADD when an actual part number and part name are supplied.
- Treat "edit/update/change part" as BOM_UPDATE when the user identifies an existing part and supplies at least one change.
- Never use placeholder text such as "this", "____", "something", or "a part" as a real part number or name.
- If a BOM add request is missing its part number or part name, return CHAT and ask one concise question requesting the missing part number, name, quantity, and make-or-buy choice.`;

const pollPlanningRules = `
Scheduling poll rules:
- Use POLL_CREATE for prompts such as "Create a Scheduling poll called General meeting #2, have the date range from 9/3/26 to 9/7/26, 8AM to 11PM. Make it open."
- Convert short U.S. dates to ISO dates using month/day/year. "9/3/26" means "2026-09-03".
- Expand an inclusive date range into every individual date. September 3 through September 7 becomes ["2026-09-03","2026-09-04","2026-09-05","2026-09-06","2026-09-07"].
- Convert times to 24-hour HH:mm values. "8AM to 11PM" becomes startTime "08:00" and endTime "23:00".
- New scheduling polls are opened automatically, so do not ask for a status field.`;

const liveDataRules = `
Live-data question rules:
- Use DONATION_STATUS for questions such as "What is the current donations raised?", "How much have we raised?", or "Show the donation total."
- Use BUDGET_STATUS for questions such as "How much money is left in the budget?", "What is our remaining budget?", or "How much is available in the competition budget?" Include plan only when the user names a specific budget plan.
- Use NEXT_EVENT for questions such as "When is the next event?", "What is our next meeting?", or "Show the upcoming activity."
- Never invent or estimate live values. The application will query the current records and return the answer with a useful link.`;

const geminiJsonInstructions = `${plannerInstructions}
${interpretationRules}
${taskPlanningRules}
${datePlanningRules}
${bomPlanningRules}
${pollPlanningRules}
${liveDataRules}

Return only one valid JSON object without markdown or commentary. It must contain a "commands" array with between 1 and 12 commands. Example: {"commands":[{"kind":"TASK_ASSIGN","task":"Inspect intake","assignee":"Alex"}]}.
Use one of these exact command kinds and fields:
TASK_CREATE {title, description, assignee?, priority?, dueAt?}
TASK_BATCH_CREATE {tasks:[{title, description, assignee?, priority?, dueAt?}]}
TASK_COMPLETE {task}; TASK_ASSIGN {task, assignee}; TASK_UPDATE {task, status?, priority?, dueAt?, description?}; TASK_COMMENT {task, comment, isDeliverable?}
HOUR_LOG {member?, hours, date?, project?, category?, description}
BOM_ADD {partNumber, name, description?, project?, quantity?, revision?, material?, supplier?, makeBuy?, unitCost?}; BOM_UPDATE {part, name?, project?, quantity?, revision?, material?, supplier?, unitCost?}
BUDGET_ADD {plan?, entryKind, description, category?, amount, quantity?, vendor?}; BUDGET_UPDATE {entry, plan?, description?, category?, amount?, quantity?, vendor?, status?}; BUDGET_LIMITS {plan, minimum, maximum}; BUDGET_STATUS {plan?}
NOTEBOOK_TODO {entry?, items:[string]}; DONATION_STATUS {}; NEXT_EVENT {}; DONATION_CAMPAIGN {title?, description?, goal?, suggestedAmounts?, active?}; CHAT {reply}.
MEETING_CREATE {title, heldAt?, location?, notes?}; ACTIVITY_CREATE {title, activityType?, startsAt?, endsAt?, location?, description?}; POLL_CREATE {title, description?, dates?, startTime?, endTime?}; FORM_CREATE {title, description?, fields?:[{label,type,required?,options?}]}.
RECOGNITION_CREATE {title, member, category?, description?}; ATTENDANCE_RECORD {activity, member, status:"PRESENT", note?}; NEWS_CREATE {title, excerpt?, body, status?}; INVENTORY_UPSERT {sku, name?, quantityOnHand?, reorderPoint?, location?, category?, unitCost?, supplier?}; CONTROL_RECORD_CREATE {area?, title, description?, owner?, priority?, dueAt?}; SPONSOR_FUNDING {plan?, sponsorName, amount, status?, tier?, contactName?, contactEmail?}; PURCHASE_CREATE {item, quantity?, vendor?, estimatedUnitCost?, neededBy?, notes?}; ENGINEERING_RECORD_CREATE {recordType, title, description?, priority?, dueAt?}; DECISION_MATRIX_CREATE {title, criteria:[{name,weight,goal}], concepts:[{name,values}], recommendation?}; SPONSOR_RESEARCH {company, website?}.
DISCORD_SEND {channel, message, mentions?, mentionEveryone?}; DISCORD_DM {member, message}; DISCORD_SYNC {includeMessages?}; DISCORD_CALENDAR_REMINDERS {}; DISCORD_MONTHLY_DIGEST {}; DISCORD_TIMEOUT {member, durationMinutes, reason?}. Use durationMinutes 0 only to clear an existing timeout and never exceed 40320 minutes.
For allocation requests, use TASK_BATCH_CREATE. Never infer a member the user did not name.`;

const commandKinds: AssistantCommand["kind"][] = [
  "TASK_CREATE",
  "TASK_BATCH_CREATE",
  "TASK_COMPLETE",
  "TASK_ASSIGN",
  "TASK_UPDATE",
  "TASK_COMMENT",
  "HOUR_LOG",
  "BOM_ADD",
  "BOM_UPDATE",
  "BUDGET_ADD",
  "BUDGET_UPDATE",
  "BUDGET_LIMITS",
  "BUDGET_STATUS",
  "DONATION_STATUS",
  "NEXT_EVENT",
  "NOTEBOOK_TODO",
  "DONATION_CAMPAIGN",
  "CHAT",
  "MEETING_CREATE",
  "ACTIVITY_CREATE",
  "POLL_CREATE",
  "FORM_CREATE",
  "RECOGNITION_CREATE",
  "ATTENDANCE_RECORD",
  "NEWS_CREATE",
  "INVENTORY_UPSERT",
  "CONTROL_RECORD_CREATE",
  "SPONSOR_FUNDING",
  "PURCHASE_CREATE",
  "ENGINEERING_RECORD_CREATE",
  "DECISION_MATRIX_CREATE",
  "SPONSOR_RESEARCH",
  "DISCORD_SEND",
  "DISCORD_DM",
  "DISCORD_SYNC",
  "DISCORD_CALENDAR_REMINDERS",
  "DISCORD_MONTHLY_DIGEST",
  "DISCORD_TIMEOUT",
];

const commandJsonSchema: Record<string, unknown> = {
  type: "object",
  properties: {
    kind: {
      type: "string",
      enum: commandKinds,
    },
    title: { type: "string" },
    description: { type: "string" },
    assignee: { type: "string" },
    priority: {
      type: "string",
      enum: ["LOW", "NORMAL", "HIGH", "URGENT", "CRITICAL"],
    },
    dueAt: { type: "string" },
    task: { type: "string" },
    status: {
      type: "string",
      enum: [
        "TODO",
        "IN_PROGRESS",
        "BLOCKED",
        "IN_REVIEW",
        "DONE",
        "PLANNED",
        "APPROVED",
        "ORDERED",
        "PAID",
        "RECEIVED",
        "CANCELED",
        "DRAFT",
        "PUBLISHED",
        "PRESENT",
        "LATE",
        "EXCUSED",
        "ABSENT",
        "PROSPECT",
        "PLEDGED",
        "COMMITTED",
      ],
    },
    comment: { type: "string" },
    isDeliverable: { type: "boolean" },
    hours: { type: "number", exclusiveMinimum: 0, maximum: 24 },
    date: { type: "string" },
    tasks: {
      type: "array",
      maxItems: 10,
      items: {
        type: "object",
        properties: {
          title: { type: "string" },
          description: { type: "string" },
          assignee: { type: "string" },
          priority: {
            type: "string",
            enum: ["LOW", "NORMAL", "HIGH", "URGENT"],
          },
          dueAt: { type: "string" },
        },
        required: ["title"],
      },
    },
    partNumber: { type: "string" },
    name: { type: "string" },
    part: { type: "string" },
    project: { type: "string" },
    quantity: { type: "integer", minimum: 1 },
    revision: { type: "string" },
    material: { type: "string" },
    supplier: { type: "string" },
    makeBuy: { type: "string", enum: ["MAKE", "BUY"] },
    unitCost: { type: "number", minimum: 0 },
    plan: { type: "string" },
    entryKind: {
      type: "string",
      enum: ["EXPENSE", "INCOME", "BUDGET_ITEM"],
    },
    entry: { type: "string" },
    category: { type: "string" },
    amount: { type: "number", minimum: 0 },
    vendor: { type: "string" },
    minimum: { type: "number", minimum: 0 },
    maximum: { type: "number", minimum: 0 },
    items: {
      type: "array",
      items: { type: "string" },
    },
    goal: { type: "number", minimum: 1 },
    suggestedAmounts: {
      type: "array",
      items: { type: "number", minimum: 1 },
    },
    active: { type: "boolean" },
    reply: { type: "string" },
    heldAt: { type: "string" },
    location: { type: "string" },
    notes: { type: "string" },
    activityType: {
      type: "string",
      enum: ["EVENT", "WORKSHOP", "MEETING", "OUTREACH", "TRAINING"],
    },
    startsAt: { type: "string" },
    endsAt: { type: "string" },
    dates: {
      type: "array",
      items: { type: "string" },
    },
    startTime: { type: "string" },
    endTime: { type: "string" },
    fields: {
      type: "array",
      items: {
        type: "object",
        properties: {
          label: { type: "string" },
          type: {
            type: "string",
            enum: [
              "SHORT_TEXT",
              "LONG_TEXT",
              "MULTIPLE_CHOICE",
              "MULTI_SELECT",
              "DROPDOWN",
              "DATE",
              "EMAIL",
              "NUMBER",
              "LINK",
              "FILE_UPLOAD",
            ],
          },
          required: { type: "boolean" },
          options: {
            type: "array",
            items: { type: "string" },
          },
        },
        required: ["label", "type"],
      },
    },
    member: { type: "string" },
    activity: { type: "string" },
    body: { type: "string" },
    excerpt: { type: "string" },
    sku: { type: "string" },
    quantityOnHand: { type: "integer", minimum: 0 },
    reorderPoint: { type: "integer", minimum: 0 },
    area: {
      type: "string",
      enum: [
        "LEADERSHIP",
        "RISK",
        "APPROVAL",
        "DEPENDENCY",
        "TECH_DEBT",
        "KNOWLEDGE_GAP",
        "RESPONSIBILITY",
        "TEMPLATE",
        "AUTOMATION",
        "SPONSOR",
        "GENERAL",
      ],
    },
    owner: { type: "string" },
    sponsorName: { type: "string" },
    tier: { type: "string" },
    contactName: { type: "string" },
    contactEmail: { type: "string" },
    item: { type: "string" },
    neededBy: { type: "string" },
    estimatedUnitCost: { type: "number", minimum: 0 },
    recordType: {
      type: "string",
      enum: [
        "ENGINEERING_QUESTION",
        "TECH_DEBT",
        "CORRECTIVE_ACTION",
        "DEPENDENCY",
        "ISSUE",
      ],
    },
    criteria: {
      type: "array",
      minItems: 1,
      maxItems: 20,
      items: {
        type: "object",
        properties: {
          name: { type: "string" },
          weight: { type: "number", minimum: 0, maximum: 10000 },
          goal: {
            type: "string",
            enum: ["SCORE", "HIGHER", "LOWER"],
          },
        },
        required: ["name", "weight", "goal"],
        additionalProperties: false,
      },
    },
    concepts: {
      type: "array",
      minItems: 2,
      maxItems: 50,
      items: {
        type: "object",
        properties: {
          name: { type: "string" },
          values: {
            type: "array",
            minItems: 1,
            maxItems: 20,
            items: { type: "number" },
          },
        },
        required: ["name", "values"],
        additionalProperties: false,
      },
    },
    recommendation: { type: "string" },
    company: { type: "string" },
    website: { type: "string" },
    channel: { type: "string" },
    message: { type: "string" },
    mentions: {
      type: "array",
      maxItems: 5,
      items: { type: "string" },
    },
    includeMessages: { type: "boolean" },
    mentionEveryone: { type: "boolean" },
    durationMinutes: {
      type: "integer",
      minimum: 0,
      maximum: 40320,
    },
    reason: { type: "string" },
  },
  required: ["kind"],
  additionalProperties: false,
};

export const documentJsonSchema: Record<string, unknown> = {
  type: "object",
  properties: {
    commands: {
      type: "array",
      maxItems: 80,
      items: commandJsonSchema,
    },
  },
  required: ["commands"],
  additionalProperties: false,
};

export const requestJsonSchema: Record<string, unknown> = {
  type: "object",
  properties: {
    commands: {
      type: "array",
      minItems: 1,
      maxItems: 12,
      items: commandJsonSchema,
    },
  },
  required: ["commands"],
  additionalProperties: false,
};

export function parseGeminiCommands(
  value: string,
  maximum = 12,
): AssistantCommand[] {
  const cleaned = value
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "");
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start < 0 || end <= start) return [];
  try {
    const parsed = JSON.parse(cleaned.slice(start, end + 1)) as {
      commands?: unknown[];
      kind?: unknown;
    };
    const candidates = Array.isArray(parsed.commands)
      ? parsed.commands
      : parsed.kind
        ? [parsed]
        : [];
    return candidates.slice(0, maximum).flatMap((candidate) => {
      const command = assistantCommandSchema.safeParse(candidate);
      return command.success ? [command.data] : [];
    });
  } catch {
    return [];
  }
}

export async function planAssistantCommands(
  prompt: string,
  actorId: string,
  conversation = "",
): Promise<AssistantCommand[]> {
  if (!teamAiIsConfigured()) return [];
  const context = conversation.trim().slice(-6000);
  const result = await generateGeminiText({
    system: geminiJsonInstructions,
    prompt: `Current date and time (America/Chicago): ${new Intl.DateTimeFormat(
      "en-US",
      {
        timeZone: "America/Chicago",
        dateStyle: "full",
        timeStyle: "long",
      },
    ).format(new Date())}

${context ? `Recent conversation (use only to resolve references):\n${context}\n\n` : ""}Current user request:\n${prompt}`,
    userId: actorId,
    feature: "action-assistant",
    maxOutputTokens: 2400,
  });
  return result
    ? applyNaturalLanguageContext(parseGeminiCommands(result), prompt)
    : [];
}

export async function planAssistantCommand(
  prompt: string,
  actorId: string,
  conversation = "",
): Promise<AssistantCommand | null> {
  return (await planAssistantCommands(prompt, actorId, conversation))[0] ?? null;
}

export async function planAssistantDocument(
  sourceText: string,
  actorId: string,
): Promise<AssistantCommand[]> {
  if (!teamAiIsConfigured()) return [];
  const maximumChunkLength = 52_000;
  const chunks: string[] = [];
  let remaining = sourceText.slice(0, maximumChunkLength * 6);
  while (remaining.length) {
    if (remaining.length <= maximumChunkLength) {
      chunks.push(remaining);
      break;
    }
    const boundary = Math.max(
      remaining.lastIndexOf("\n\n", maximumChunkLength),
      remaining.lastIndexOf("\n", maximumChunkLength),
    );
    const splitAt = boundary >= maximumChunkLength * 0.65
      ? boundary
      : maximumChunkLength;
    chunks.push(remaining.slice(0, splitAt));
    remaining = remaining.slice(splitAt).trimStart();
  }

  const creationKinds = new Set<AssistantCommand["kind"]>([
    "TASK_CREATE",
    "TASK_BATCH_CREATE",
    "HOUR_LOG",
    "BOM_ADD",
    "BUDGET_ADD",
    "NOTEBOOK_TODO",
    "MEETING_CREATE",
    "ACTIVITY_CREATE",
    "POLL_CREATE",
    "FORM_CREATE",
    "RECOGNITION_CREATE",
    "ATTENDANCE_RECORD",
    "NEWS_CREATE",
    "INVENTORY_UPSERT",
    "CONTROL_RECORD_CREATE",
    "SPONSOR_FUNDING",
    "PURCHASE_CREATE",
    "ENGINEERING_RECORD_CREATE",
    "DECISION_MATRIX_CREATE",
    "SPONSOR_RESEARCH",
  ]);
  const commands: AssistantCommand[] = [];
  const seen = new Set<string>();
  for (let index = 0; index < chunks.length; index += 1) {
    const result = await generateGeminiText({
      system: `${geminiJsonInstructions}

You are processing an uploaded team document or spreadsheet. Return one JSON object containing a "commands" array of at most 80 supported commands.
First classify the material from its headers, title, tables, and narrative. Route:
- decision matrices and concept-comparison scoring to DECISION_MATRIX_CREATE;
- BOM/parts rows to BOM_ADD;
- priced materials, income, or expense rows to BUDGET_ADD and requested purchases to PURCHASE_CREATE;
- schedules to ACTIVITY_CREATE or POLL_CREATE;
- action items, commitments, and clearly implied follow-up work to TASK_CREATE;
- meeting material to MEETING_CREATE;
- sponsor/contact rows to SPONSOR_RESEARCH or SPONSOR_FUNDING;
- open technical questions, concerns, failures, corrective actions, and dependencies to ENGINEERING_RECORD_CREATE;
- decisions, risks, approvals, responsibilities, assumptions, and other operational registers to CONTROL_RECORD_CREATE;
- inventory quantities to INVENTORY_UPSERT, attendance to ATTENDANCE_RECORD, and awards or certifications to RECOGNITION_CREATE.
Decision-matrix routing requires an explicit phrase such as decision matrix, concept comparison/selection, weighted scoring, or trade study, or an unmistakable alternatives-versus-criteria scoring structure. Never infer a decision matrix merely because a finance or budget table is wide.
Finance routing requires finance evidence such as budget, expense, income, amount, cost, price, vendor, invoice, funding, or a conventional priced-material table. Preserve any named finance plan in every BUDGET_ADD command.
Task routing may use softer evidence: action item, owner, assignee, due date, needs to, should finish, follow up, review, update, or other clearly unfinished work.
Mandatory labeled-record rules: "Primary concept selected:" is a decision record, "Key concerns raised:" is an ENGINEERING_QUESTION, "Runner-up / backup concept:" belongs in the decision context, and unfinished work such as "write it up later" is a TASK_CREATE.
Preserve quantities and treat unit prices as unitCost for BOM parts but total line prices as amount for finance entries. Import every distinct supported operational record. A clearly labeled decision, concern, assumption, or action item in narrative text is a record even when it is not written as an imperative sentence. You may use an explicitly stated range midpoint or nearby evidence as an estimate; label that estimate in the description. Do not invent people, contact details, prices, dates, or parts without source evidence. Do not duplicate the same record across command types.`,
      prompt: `${chunks.length > 1 ? `Document section ${index + 1} of ${chunks.length}. Extract only records present in this section.\n\n` : ""}${chunks[index]}`,
      userId: actorId,
      feature: "assistant-document-intake",
      maxOutputTokens: 10_000,
      timeoutMs: 45_000,
    });
    if (!result) continue;
    for (const command of parseGeminiCommands(result, 80)) {
      if (!creationKinds.has(command.kind)) continue;
      const signature = JSON.stringify(command);
      if (seen.has(signature)) continue;
      seen.add(signature);
      commands.push(command);
      if (commands.length >= 160)
        return applyAutomaticDueDates(commands);
    }
  }
  return applyAutomaticDueDates(commands);
}
