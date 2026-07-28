export type DiscordRoleOption = {
  id: string;
  name: string;
  position: number;
  managed: boolean;
};

function normalized(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function selectable(roles: DiscordRoleOption[]) {
  return roles.filter((role) => !role.managed && role.name !== "@everyone");
}

export function inferDiscordOnboardingRoleIds(
  roles: DiscordRoleOption[],
  configured: {
    agreedRoleId?: string | null;
    vexUMemberRoleId?: string | null;
  } = {},
) {
  const available = selectable(roles);
  const availableIds = new Set(available.map((role) => role.id));
  const agreed =
    (configured.agreedRoleId &&
      availableIds.has(configured.agreedRoleId) &&
      configured.agreedRoleId) ||
    available.find((role) => normalized(role.name) === "agreed")?.id ||
    available.find((role) => normalized(role.name).includes("agreed"))?.id ||
    null;
  const vexUMember =
    (configured.vexUMemberRoleId &&
      availableIds.has(configured.vexUMemberRoleId) &&
      configured.vexUMemberRoleId) ||
    available.find(
      (role) => normalized(role.name) === "vex u member",
    )?.id ||
    available.find((role) => {
      const name = normalized(role.name);
      return name.includes("vex u") && name.includes("member");
    })?.id ||
    available.find((role) => normalized(role.name) === "vex u")?.id ||
    null;
  return { agreedRoleId: agreed, vexUMemberRoleId: vexUMember };
}
