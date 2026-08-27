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

const forbiddenInterestRoleTerms =
  /\b(admin|administrator|officer|director|lead|captain|president|vice president|treasurer|secretary|mentor|verified|unverified|member|agreed|paid|dues|suspended|alumni|guest|bot|moderator|owner)\b/;

const interestRoleDefinitions = [
  { test: /\bmechanical\b/, emoji: "🔧" },
  { test: /\belectrical\b/, emoji: "⚡" },
  { test: /\b(programming|software|code|controls?)\b/, emoji: "💻" },
  { test: /\b(cad|design)\b/, emoji: "📐" },
  { test: /\b(manufacturing|fabrication|machine shop)\b/, emoji: "🏭" },
  { test: /\b(outreach|community)\b/, emoji: "🤝" },
  { test: /\b(marketing|media|social media)\b/, emoji: "📣" },
  { test: /\b(sponsor|fundraising|business)\b/, emoji: "💼" },
  { test: /\b(scouting|strategy)\b/, emoji: "📊" },
  { test: /\b(notebook|documentation)\b/, emoji: "📓" },
  { test: /\b(vex u|vexu)\b/, emoji: "🤖" },
  { test: /\b(sidc|rover|roborowdy)\b/, emoji: "🚀" },
] as const;

export function discordInterestRoleEmoji(role: DiscordRoleOption) {
  if (role.managed || role.name === "@everyone") return null;
  const name = normalized(role.name);
  if (forbiddenInterestRoleTerms.test(name)) return null;
  return interestRoleDefinitions.find((definition) =>
    definition.test.test(name),
  )?.emoji ?? null;
}

export function isDiscordInterestRole(role: DiscordRoleOption) {
  return Boolean(discordInterestRoleEmoji(role));
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
