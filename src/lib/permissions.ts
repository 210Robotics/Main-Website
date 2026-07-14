export const permissionKeys = [
  "members.approve",
  "members.edit",
  "activity.view_all",
  "activity.edit_all",
  "reports.export",
  "content.manage",
  "events.manage",
  "directory.manage",
  "sponsors.manage",
  "media.manage",
  "inquiries.manage",
  "audit.view",
  "access.manage",
] as const;

export type PermissionKey = (typeof permissionKeys)[number];

export const rolePresets = {
  MEMBER: [] as PermissionKey[],
  OFFICER: ["activity.view_all"] as PermissionKey[],
  CONTENT_ADMIN: [
    "content.manage",
    "events.manage",
    "directory.manage",
    "sponsors.manage",
    "media.manage",
    "inquiries.manage",
  ] as PermissionKey[],
  RECORDS_ADMIN: [
    "members.approve",
    "members.edit",
    "activity.view_all",
    "activity.edit_all",
    "reports.export",
    "audit.view",
  ] as PermissionKey[],
  FULL_ADMIN: permissionKeys.filter((key) => key !== "access.manage"),
  SUPER_ADMIN: [...permissionKeys],
} as const;

export type AccessRole = keyof typeof rolePresets;

export const permissionLabels: Record<PermissionKey, string> = {
  "members.approve": "Approve and suspend accounts",
  "members.edit": "Edit member profiles and roles",
  "activity.view_all": "View team activity records",
  "activity.edit_all": "Correct team activity records",
  "reports.export": "Export reports",
  "content.manage": "Manage pages and news",
  "events.manage": "Manage events",
  "directory.manage": "Manage public directory",
  "sponsors.manage": "Manage sponsors",
  "media.manage": "Manage media",
  "inquiries.manage": "Manage inquiries",
  "audit.view": "View audit history",
  "access.manage": "Assign roles and permissions",
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
  return rolePresets[role].includes(permission as never) || overrides.allow.includes(permission);
}
