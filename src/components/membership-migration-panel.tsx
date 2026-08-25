import { and, asc, eq, isNull } from "drizzle-orm";
import { getDb } from "@/db";
import { discordGuildMembers, membershipDues, membershipSettings, members } from "@/db/schema";
import { MembershipMigrationTable } from "@/components/membership-migration-table";
import { requirePermission } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";

export async function MembershipMigrationPanel() {
  const actor = await requirePermission("members.approve");
  const [settingsRows, memberRows, discordRows] = await Promise.all([
    getDb().select().from(membershipSettings).where(eq(membershipSettings.id, "membership")).limit(1),
    getDb().select({ member: members }).from(members).orderBy(asc(members.displayName)),
    getDb().select({ linkedMemberId: discordGuildMembers.linkedMemberId, lastSynchronizedAt: discordGuildMembers.lastSynchronizedAt, roleSyncStatus: discordGuildMembers.roleSyncStatus }).from(discordGuildMembers).where(and(isNull(discordGuildMembers.leftAt), eq(discordGuildMembers.isBot, false))),
  ]);
  const period = settingsRows[0]?.membershipYear || "2026-2027";
  const duesRows = await getDb().select().from(membershipDues).where(eq(membershipDues.period, period));
  const duesByMember = new Map(duesRows.map((dues) => [dues.memberId, dues]));
  const discordByMember = new Map(discordRows.filter((row) => row.linkedMemberId).map((row) => [row.linkedMemberId!, row]));
  return (
    <MembershipMigrationTable
      period={period}
      canManageOverrides={hasPermission(actor.accessRole, "access.manage", actor.permissionOverrides)}
      rows={memberRows.map(({ member }) => {
        const dues = duesByMember.get(member.id);
        const discord = discordByMember.get(member.id);
        return {
          id: member.id,
          name: member.displayName,
          email: member.email,
          accessRole: member.accessRole,
          organizationRole: member.organizationRole,
          status: member.status,
          accessState: member.accessState,
          universityVerified: Boolean(member.universityEmailVerifiedAt || member.universityEmailOverrideAt),
          universityOverride: Boolean(member.universityEmailOverrideAt),
          profileComplete: Boolean(member.profileCompletedAt),
          discordLinked: Boolean(discord),
          discordSync: discord?.roleSyncStatus || "UNLINKED",
          duesStatus: dues?.status || "NOT_SET",
          fundraisingRaisedCents: dues?.fundraisingRaisedCents || 0,
          lastSync: discord?.lastSynchronizedAt?.toISOString() || null,
        };
      })}
    />
  );
}
