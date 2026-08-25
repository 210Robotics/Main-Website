import "server-only";
import { auth, currentUser } from "@clerk/nextjs/server";
import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { getDb, hasDatabase } from "@/db";
import { members } from "@/db/schema";
import {
  canAccessAdmin,
  hasPermission,
  type PermissionKey,
} from "@/lib/permissions";
import { isUtsaStudentEmail, normalizeEmail } from "@/lib/membership-policy";
import {
  getMembershipSettings,
  reconcileMemberMembership,
} from "@/lib/membership-access-server";

export function hasClerk() {
  return Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY && process.env.CLERK_SECRET_KEY);
}

async function findOrCreateMember(userId: string) {
  const [existing] = await getDb().select().from(members).where(eq(members.clerkUserId, userId)).limit(1);
  if (existing) return existing;
  const user = await currentUser();
  const email = user?.primaryEmailAddress?.emailAddress?.toLowerCase();
  if (!user || !email) return null;
  const [emailMatch] = await getDb()
    .select()
    .from(members)
    .where(eq(members.email, email))
    .limit(1);
  if (emailMatch) {
    const [relinked] = await getDb()
      .update(members)
      .set({ clerkUserId: user.id, updatedAt: new Date() })
      .where(eq(members.id, emailMatch.id))
      .returning();
    return relinked;
  }
  const isOwner = email === (process.env.INITIAL_SUPER_ADMIN_EMAIL || "admin@210robotics.com").toLowerCase();
  const displayName = [user.firstName, user.lastName].filter(Boolean).join(" ") || email.split("@")[0];
  const verifiedUniversityEmail = user.emailAddresses.find(
    (address) =>
      address.verification?.status === "verified" &&
      isUtsaStudentEmail(address.emailAddress),
  )?.emailAddress;
  const [created] = await getDb().insert(members).values({
    clerkUserId: user.id,
    email,
    normalizedUniversityEmail: verifiedUniversityEmail
      ? normalizeEmail(verifiedUniversityEmail)
      : null,
    universityEmailVerifiedAt: verifiedUniversityEmail ? new Date() : null,
    firstName: user.firstName || "",
    lastName: user.lastName || "",
    displayName,
    photoUrl: user.imageUrl || null,
    status: isOwner ? "ACTIVE" : "PENDING",
    accessRole: isOwner ? "SUPER_ADMIN" : "MEMBER",
    organizationRole: isOwner ? "President" : "Member",
    accessState: isOwner
      ? "ACTIVE_MEMBER"
      : verifiedUniversityEmail
        ? "PROFILE_INCOMPLETE"
        : "UTSA_EMAIL_PENDING",
    isPublic: false,
  }).onConflictDoNothing().returning();
  if (created) return created;
  const [concurrent] = await getDb().select().from(members).where(eq(members.clerkUserId, userId)).limit(1);
  return concurrent ?? null;
}

export async function synchronizeCurrentMemberIdentity() {
  if (!hasClerk() || !hasDatabase()) return null;
  const { userId } = await auth();
  if (!userId) return null;
  const [member, user] = await Promise.all([
    findOrCreateMember(userId),
    currentUser(),
  ]);
  if (!member || !user) return member;
  const primaryEmail = user.primaryEmailAddress?.emailAddress;
  const verifiedUniversityEmail = user.emailAddresses.find(
    (address) =>
      address.verification?.status === "verified" &&
      isUtsaStudentEmail(address.emailAddress),
  )?.emailAddress;
  const now = new Date();
  const [updated] = await getDb()
    .update(members)
    .set({
      email: primaryEmail ? normalizeEmail(primaryEmail) : member.email,
      normalizedUniversityEmail: verifiedUniversityEmail
        ? normalizeEmail(verifiedUniversityEmail)
        : null,
      universityEmailVerifiedAt: verifiedUniversityEmail
        ? member.universityEmailVerifiedAt ?? now
        : null,
      firstName: member.firstName || user.firstName || "",
      lastName: member.lastName || user.lastName || "",
      photoUrl: member.photoMediaId ? member.photoUrl : user.imageUrl || null,
      updatedAt: now,
    })
    .where(eq(members.id, member.id))
    .returning();
  return updated ?? member;
}

export async function getCurrentMember() {
  if (!hasClerk() || !hasDatabase()) return null;
  const { userId } = await auth();
  if (!userId) return null;
  return findOrCreateMember(userId);
}

export async function requireActiveMember() {
  if (!hasClerk()) redirect("/sign-in");
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");
  if (!hasDatabase()) throw new Error("Member database is not configured.");
  const member = await findOrCreateMember(userId);
  if (!member || member.status !== "ACTIVE") redirect("/pending");
  return member;
}

export async function requireMemberEntitlement() {
  const member = await requireActiveMember();
  const settings = await getMembershipSettings();
  const snapshot = await reconcileMemberMembership(member.id);
  if (settings.accessEnforcementEnabled && !snapshot?.entitled) redirect("/verify");
  return member;
}

export async function requirePermission(permission: PermissionKey) {
  const member = await requireActiveMember();
  if (!hasPermission(member.accessRole, permission, member.permissionOverrides)) redirect("/portal");
  return member;
}

export async function requireAdminAccess() {
  const member = await requireActiveMember();
  if (
    !canAccessAdmin(
      member.accessRole,
      member.permissionOverrides,
    )
  )
    redirect("/portal");
  return member;
}
