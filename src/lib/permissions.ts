export const permissionKeys = [
  "members.approve",
  "members.edit",
  "activity.view_all",
  "activity.edit_all",
  "reports.export",
  "content.manage",
  "documents.manage",
  "forms.manage",
  "events.manage",
  "directory.manage",
  "sponsors.manage",
  "media.manage",
  "inquiries.manage",
  "audit.view",
  "access.manage",
  "tasks.manage",
  "meetings.manage",
  "finance.manage",
  "engineering.manage",
  "seasons.manage",
  "notebook.view",
  "notebook.manage",
  "scouting.manage",
  "inventory.manage",
  "purchasing.manage",
  "design_changes.manage",
  "glossary.manage",
  "integrations.manage",
  "dues.manage",
] as const;

export type PermissionKey = (typeof permissionKeys)[number];

const fullAdminPermissions = permissionKeys.filter(
  (permission) => permission !== "access.manage",
);

export const rolePresets = {
  MEMBER: [] as PermissionKey[],
  MENTOR: [
    "activity.view_all",
    "activity.edit_all",
    "reports.export",
  ] as PermissionKey[],
  LEAD: [...fullAdminPermissions],
  OPERATIONS_LEAD: [
    "tasks.manage",
    "meetings.manage",
    "glossary.manage",
    "integrations.manage",
  ] as PermissionKey[],
  ENGINEERING_MEMBER: [
    "engineering.manage",
    "notebook.view",
    "notebook.manage",
    "scouting.manage",
  ] as PermissionKey[],
  ENGINEERING_LEAD: [
    "engineering.manage",
    "seasons.manage",
    "notebook.view",
    "notebook.manage",
    "scouting.manage",
    "inventory.manage",
    "purchasing.manage",
    "design_changes.manage",
  ] as PermissionKey[],
  NOTEBOOK_EDITOR: ["notebook.view", "notebook.manage"] as PermissionKey[],
  SCOUTING_LEAD: ["notebook.view", "scouting.manage"] as PermissionKey[],
  LOGISTICS_LEAD: [
    "notebook.view",
    "inventory.manage",
    "purchasing.manage",
    "design_changes.manage",
  ] as PermissionKey[],
  FINANCE_LEAD: ["finance.manage", "dues.manage"] as PermissionKey[],
  OUTREACH_LEAD: [
    "sponsors.manage",
    "media.manage",
    "inquiries.manage",
  ] as PermissionKey[],
  CONTENT_LEAD: [
    "content.manage",
    "forms.manage",
    "events.manage",
    "directory.manage",
  ] as PermissionKey[],
  DIRECTOR: [...fullAdminPermissions],
  OFFICER: [...fullAdminPermissions],
  CONTENT_ADMIN: [
    "content.manage",
    "documents.manage",
    "forms.manage",
    "events.manage",
    "directory.manage",
    "sponsors.manage",
    "media.manage",
    "inquiries.manage",
    "glossary.manage",
  ] as PermissionKey[],
  RECORDS_ADMIN: [
    "members.approve",
    "members.edit",
    "activity.view_all",
    "activity.edit_all",
    "reports.export",
    "audit.view",
    "tasks.manage",
    "meetings.manage",
    "finance.manage",
    "dues.manage",
  ] as PermissionKey[],
  FULL_ADMIN: [...fullAdminPermissions],
  SUPER_ADMIN: [...permissionKeys],
} as const;

export type AccessRole = keyof typeof rolePresets;

export const assignableAccessRoles = [
  "MEMBER",
  "MENTOR",
  "LEAD",
  "OPERATIONS_LEAD",
  "ENGINEERING_MEMBER",
  "ENGINEERING_LEAD",
  "NOTEBOOK_EDITOR",
  "SCOUTING_LEAD",
  "LOGISTICS_LEAD",
  "FINANCE_LEAD",
  "OUTREACH_LEAD",
  "CONTENT_LEAD",
  "DIRECTOR",
  "OFFICER",
  "CONTENT_ADMIN",
  "RECORDS_ADMIN",
  "FULL_ADMIN",
] as const satisfies readonly Exclude<AccessRole, "SUPER_ADMIN">[];

export const accessRoleLabels: Record<AccessRole, string> = {
  MEMBER: "Member",
  MENTOR: "Mentor",
  LEAD: "Team lead",
  OPERATIONS_LEAD: "Operations subteam lead",
  ENGINEERING_MEMBER: "Engineering subteam member",
  ENGINEERING_LEAD: "Engineering subteam lead",
  NOTEBOOK_EDITOR: "Engineering notebook editor",
  SCOUTING_LEAD: "Scouting lead",
  LOGISTICS_LEAD: "Inventory and logistics lead",
  FINANCE_LEAD: "Finance subteam lead",
  OUTREACH_LEAD: "Outreach subteam lead",
  CONTENT_LEAD: "Content subteam lead",
  DIRECTOR: "Director",
  OFFICER: "Officer",
  CONTENT_ADMIN: "Content admin",
  RECORDS_ADMIN: "Records admin",
  FULL_ADMIN: "Full admin",
  SUPER_ADMIN: "Super admin",
};

export const permissionLabels: Record<PermissionKey, string> = {
  "members.approve": "Approve and suspend accounts",
  "members.edit": "Edit member profiles and roles",
  "activity.view_all": "View team activity records",
  "activity.edit_all": "Correct team activity records",
  "reports.export": "Export reports",
  "content.manage": "Manage pages and news",
  "documents.manage": "Manage the private document archive",
  "forms.manage": "Create forms and view responses",
  "events.manage": "Manage events",
  "directory.manage": "Manage public directory",
  "sponsors.manage": "Manage sponsors",
  "media.manage": "Manage media",
  "inquiries.manage": "Manage inquiries",
  "audit.view": "View audit history",
  "access.manage": "Assign roles and permissions",
  "tasks.manage": "Assign and manage team tasks",
  "meetings.manage": "Create meeting records and decisions",
  "finance.manage": "Manage budgets, expenses, and sponsor funding",
  "engineering.manage": "Manage BOM, manufacturing, and verification records",
  "seasons.manage": "Manage engineering seasons, projects, and subsystems",
  "notebook.view": "View and export the private engineering notebook",
  "notebook.manage": "Create and revise engineering notebook entries",
  "scouting.manage": "Review and manage match scouting records",
  "inventory.manage": "Manage parts and material inventory",
  "purchasing.manage": "Manage purchasing requests and receipts",
  "design_changes.manage": "Review and control engineering design changes",
  "glossary.manage": "Manage organization glossary terms",
  "integrations.manage": "Manage Discord and team integrations",
  "dues.manage": "Track and update membership dues",
};

export function canGrantPermission(
  actorRole: AccessRole,
  permission: PermissionKey,
) {
  return rolePresets[actorRole].includes(permission as never);
}

export function hasPermission(
  role: AccessRole,
  permission: PermissionKey,
  overrides: { allow: string[]; deny: string[] } = { allow: [], deny: [] },
) {
  if (overrides.deny.includes(permission)) return false;
  return (
    rolePresets[role].includes(permission as never) ||
    overrides.allow.includes(permission)
  );
}

export function hasAnyPermission(
  role: AccessRole,
  permissions: readonly PermissionKey[],
  overrides: { allow: string[]; deny: string[] } = { allow: [], deny: [] },
) {
  return permissions.some((permission) =>
    hasPermission(role, permission, overrides),
  );
}

export function canAccessAdmin(
  role: AccessRole,
  overrides: { allow: string[]; deny: string[] } = { allow: [], deny: [] },
) {
  return hasAnyPermission(role, permissionKeys, overrides);
}
