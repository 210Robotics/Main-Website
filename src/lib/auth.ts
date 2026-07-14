import "server-only";
import { auth, currentUser } from "@clerk/nextjs/server";
import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { getDb, hasDatabase } from "@/db";
import { members } from "@/db/schema";
import { hasPermission, type PermissionKey } from "@/lib/permissions";

export function hasClerk() {
  return Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY && process.env.CLERK_SECRET_KEY);
}

async function findOrCreateMember(userId: string) {
  const [existing] = await getDb().select().from(members).where(eq(members.clerkUserId, userId)).limit(1);
  if (existing) return existing;
  const user = await currentUser();
  const email = user?.primaryEmailAddress?.emailAddress?.toLowerCase();
  if (!user || !email) return null;
  if (user.externalAccounts.length && !user.passwordEnabled) throw new Error("Social sign-in is not available. Use email and password.");
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
  const [created] = await getDb().insert(members).values({ clerkUserId: user.id, email, displayName, photoUrl: user.imageUrl || null, status: isOwner ? "ACTIVE" : "PENDING", accessRole: isOwner ? "SUPER_ADMIN" : "MEMBER", organizationRole: isOwner ? "President" : "Member", isPublic: isOwner }).onConflictDoNothing().returning();
  if (created) return created;
  const [concurrent] = await getDb().select().from(members).where(eq(members.clerkUserId, userId)).limit(1);
  return concurrent ?? null;
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

export async function requirePermission(permission: PermissionKey) {
  const member = await requireActiveMember();
  if (!hasPermission(member.accessRole, permission, member.permissionOverrides)) redirect("/portal");
  return member;
}
