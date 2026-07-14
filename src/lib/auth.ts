import "server-only";
import { auth } from "@clerk/nextjs/server";
import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { getDb, hasDatabase } from "@/db";
import { members } from "@/db/schema";
import { hasPermission, type PermissionKey } from "@/lib/permissions";

export function hasClerk() {
  return Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY && process.env.CLERK_SECRET_KEY);
}

export async function getCurrentMember() {
  if (!hasClerk() || !hasDatabase()) return null;
  const { userId } = await auth();
  if (!userId) return null;
  const [member] = await getDb().select().from(members).where(eq(members.clerkUserId, userId)).limit(1);
  return member ?? null;
}

export async function requireActiveMember() {
  if (!hasClerk()) redirect("/sign-in");
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");
  if (!hasDatabase()) throw new Error("Member database is not configured.");
  const [member] = await getDb().select().from(members).where(eq(members.clerkUserId, userId)).limit(1);
  if (!member || member.status !== "ACTIVE") redirect("/pending");
  return member;
}

export async function requirePermission(permission: PermissionKey) {
  const member = await requireActiveMember();
  if (!hasPermission(member.accessRole, permission, member.permissionOverrides)) redirect("/portal");
  return member;
}
