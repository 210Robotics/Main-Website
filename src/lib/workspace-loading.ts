export const portalTabs = [
  "dashboard",
  "attendance",
  "hours",
  "forms",
  "polls",
  "tasks",
  "portfolio",
  "templates",
  "scouting",
  "engineering",
  "connections",
  "glossary",
] as const;

export type PortalTab = (typeof portalTabs)[number];

export function normalizePortalTab(value?: string): PortalTab {
  return portalTabs.includes(value as PortalTab)
    ? (value as PortalTab)
    : "dashboard";
}

export function portalLoadPlan(tab: PortalTab) {
  return {
    profile: tab === "dashboard",
    hours: tab === "dashboard" || tab === "hours",
    contributions: tab === "dashboard" || tab === "portfolio",
    activeTimer: tab === "hours",
    members: ["hours", "tasks", "engineering"].includes(tab),
    teamHours: tab === "hours",
    attendance: tab === "attendance",
    activities: tab === "attendance",
    forms: tab === "forms",
    polls: tab === "polls",
    tasks: ["dashboard", "tasks", "portfolio"].includes(tab),
    taskComments: tab === "tasks",
    glossary: tab === "glossary",
    seasons: tab === "dashboard" || tab === "scouting",
    scouting: tab === "scouting",
    hub: ["dashboard", "portfolio", "templates"].includes(tab),
    projects: tab === "dashboard" || tab === "engineering",
    portfolioNotebook: tab === "portfolio",
    portfolioDesign: tab === "portfolio",
    engineering: tab === "engineering",
  };
}

export const adminTabs = [
  "overview",
  "assistant",
  "events",
  "activity",
  "members",
  "forms",
  "polls",
  "website",
  "content",
  "docs",
  "documents",
  "constitution",
  "sponsors",
  "media",
  "inquiries",
  "discord",
  "dues",
] as const;

export type AdminTab = (typeof adminTabs)[number];

export function normalizeAdminTab(value?: string): AdminTab {
  return adminTabs.includes(value as AdminTab)
    ? (value as AdminTab)
    : "overview";
}

export function adminLoadPlan(tab: AdminTab) {
  const overview = tab === "overview";
  return {
    members: overview || tab === "events" || tab === "members",
    inquiries: overview || tab === "inquiries",
    posts: overview || tab === "content",
    media: ["members", "content", "sponsors", "media"].includes(tab),
    galleryAssets: tab === "media",
    galleries: overview || tab === "content" || tab === "media",
    projects: tab === "members",
    assignments: tab === "members",
    activity: tab === "activity" || tab === "members",
    settings:
      tab === "website" || tab === "members" || tab === "constitution",
    roster: tab === "members",
    sponsors: tab === "sponsors",
    events: overview || tab === "events" || tab === "members",
    attendance: tab === "events" || tab === "members",
    attendanceTokens: tab === "events",
    docs: overview || tab === "docs",
    calendar: tab === "events",
    forms: overview || tab === "forms",
    formResponses: overview || tab === "forms",
    polls: tab === "polls",
    pollResponses: tab === "polls",
    documents: tab === "documents" || tab === "constitution",
  };
}

export const operationTools = [
  "overview",
  "tasks",
  "meetings",
  "finance",
  "structure",
  "notebook",
  "scouting",
  "engineering",
  "inventory",
  "purchasing",
  "changes",
  "glossary",
] as const;

export type OperationTool = (typeof operationTools)[number];

export function normalizeOperationTool(value?: string): OperationTool {
  return operationTools.includes(value as OperationTool)
    ? (value as OperationTool)
    : "overview";
}

export function operationsLoadPlan(tool: OperationTool) {
  const overview = tool === "overview";
  return {
    members: [
      "tasks",
      "meetings",
      "finance",
      "structure",
      "notebook",
      "engineering",
      "purchasing",
      "changes",
    ].includes(tool),
    activities: tool === "meetings",
    tasks: overview || tool === "tasks" || tool === "meetings",
    taskComments: tool === "tasks",
    meetings: overview || tool === "meetings",
    meetingDetails: tool === "meetings",
    financePlans: overview || tool === "finance" || tool === "purchasing",
    financeEntries: overview || tool === "finance",
    financeSponsors: tool === "finance",
    parts: overview || ["engineering", "inventory", "changes"].includes(tool),
    manufacturing: tool === "engineering",
    glossary: overview || tool === "glossary",
    seasons: ["finance", "structure", "notebook", "scouting", "engineering", "inventory", "purchasing", "changes"].includes(tool),
    projects: ["finance", "structure", "notebook", "engineering", "inventory", "purchasing", "changes"].includes(tool),
    subsystems: ["structure", "notebook", "engineering", "inventory", "purchasing", "changes"].includes(tool),
    notebook: tool === "notebook",
    scouting: tool === "scouting",
    inventory: tool === "inventory" || tool === "purchasing",
    purchasing: tool === "purchasing",
    designChanges: tool === "changes",
  };
}
