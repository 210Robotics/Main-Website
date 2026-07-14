"use server";

import sanitizeHtml from "sanitize-html";
import { clerkClient } from "@clerk/nextjs/server";
import { eq, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getDb } from "@/db";
import {
  auditEvents,
  hourEntries,
  inquiries,
  memberProjects,
  members,
  postRevisions,
  posts,
  projects,
  publicSettings,
} from "@/db/schema";
import { requireActiveMember, requirePermission } from "@/lib/auth";
import { syncDrivePhotos } from "@/lib/drive-sync";
import { hasPermission, permissionKeys, rolePresets } from "@/lib/permissions";

async function assignProjects(memberId: string, slugs: string[]) {
  await getDb()
    .delete(memberProjects)
    .where(eq(memberProjects.memberId, memberId));
  if (!slugs.length) return;
  const rows = await getDb()
    .select({ id: projects.id })
    .from(projects)
    .where(inArray(projects.slug, slugs));
  if (rows.length)
    await getDb()
      .insert(memberProjects)
      .values(rows.map((project) => ({ memberId, projectId: project.id })));
}

export async function approveMember(formData: FormData) {
  const actor = await requirePermission("members.approve");
  const data = z
    .object({
      memberId: z.uuid(),
      organizationRole: z.string().trim().min(2).max(100),
      accessRole: z.enum([
        "MEMBER",
        "OFFICER",
        "CONTENT_ADMIN",
        "RECORDS_ADMIN",
        "FULL_ADMIN",
      ]),
    })
    .parse(Object.fromEntries(formData));
  if (data.accessRole === "FULL_ADMIN" && actor.accessRole !== "SUPER_ADMIN")
    throw new Error("Only the super-admin can grant Full Admin.");
  if (
    actor.accessRole !== "SUPER_ADMIN" &&
    rolePresets[data.accessRole].some(
      (permission) =>
        !hasPermission(actor.accessRole, permission, actor.permissionOverrides),
    )
  )
    throw new Error("You cannot grant capabilities you do not possess.");
  await getDb()
    .update(members)
    .set({
      status: "ACTIVE",
      organizationRole: data.organizationRole,
      accessRole: data.accessRole,
      isPublic: true,
      updatedAt: new Date(),
    })
    .where(eq(members.id, data.memberId));
  await assignProjects(data.memberId, formData.getAll("projects").map(String));
  await getDb()
    .insert(auditEvents)
    .values({
      actorMemberId: actor.id,
      action: "member.approved",
      entityType: "member",
      entityId: data.memberId,
      details: { accessRole: data.accessRole },
    });
  revalidatePath("/admin");
  revalidatePath("/members");
}

export async function updateMemberAccess(formData: FormData) {
  const actor = await requirePermission("access.manage");
  const data = z
    .object({
      memberId: z.uuid(),
      displayName: z.string().trim().min(2).max(100),
      organizationRole: z.string().trim().min(2).max(100),
      bio: z.string().trim().max(700),
      accessRole: z.enum([
        "MEMBER",
        "OFFICER",
        "CONTENT_ADMIN",
        "RECORDS_ADMIN",
        "FULL_ADMIN",
      ]),
      isPublic: z.string().optional(),
    })
    .parse(Object.fromEntries(formData));
  if (data.memberId === actor.id)
    throw new Error(
      "Owner access must be changed through an ownership transfer.",
    );
  if (data.accessRole === "FULL_ADMIN" && actor.accessRole !== "SUPER_ADMIN")
    throw new Error("Only the super-admin can grant Full Admin.");
  if (
    actor.accessRole !== "SUPER_ADMIN" &&
    rolePresets[data.accessRole].some(
      (permission) =>
        !hasPermission(actor.accessRole, permission, actor.permissionOverrides),
    )
  )
    throw new Error("You cannot grant capabilities you do not possess.");
  const allow = formData
    .getAll("allow")
    .map(String)
    .filter((value): value is (typeof permissionKeys)[number] =>
      permissionKeys.includes(value as (typeof permissionKeys)[number]),
    );
  const deny = formData
    .getAll("deny")
    .map(String)
    .filter((value): value is (typeof permissionKeys)[number] =>
      permissionKeys.includes(value as (typeof permissionKeys)[number]),
    );
  if (allow.includes("access.manage") && actor.accessRole !== "SUPER_ADMIN")
    throw new Error(
      "Only the super-admin can grant access-management authority.",
    );
  if (
    actor.accessRole !== "SUPER_ADMIN" &&
    allow.some(
      (permission) =>
        !hasPermission(actor.accessRole, permission, actor.permissionOverrides),
    )
  )
    throw new Error("You cannot grant capabilities you do not possess.");
  const cleanAllow = allow.filter((permission) => !deny.includes(permission));
  await getDb()
    .update(members)
    .set({
      displayName: data.displayName,
      organizationRole: data.organizationRole,
      bio: data.bio,
      accessRole: data.accessRole,
      permissionOverrides: { allow: cleanAllow, deny },
      isPublic: data.isPublic === "on",
      updatedAt: new Date(),
    })
    .where(eq(members.id, data.memberId));
  await assignProjects(data.memberId, formData.getAll("projects").map(String));
  await getDb()
    .insert(auditEvents)
    .values({
      actorMemberId: actor.id,
      action: "member.access_updated",
      entityType: "member",
      entityId: data.memberId,
      details: { accessRole: data.accessRole, allow: cleanAllow, deny },
    });
  revalidatePath("/admin");
  revalidatePath("/members");
}

export async function suspendMember(formData: FormData) {
  const actor = await requirePermission("members.approve");
  const id = z.uuid().parse(formData.get("memberId"));
  const [target] = await getDb()
    .select({ accessRole: members.accessRole })
    .from(members)
    .where(eq(members.id, id))
    .limit(1);
  if (!target) throw new Error("Member not found.");
  if (id === actor.id) throw new Error("You cannot suspend your own account.");
  if (target.accessRole === "SUPER_ADMIN")
    throw new Error("The super-admin cannot be suspended here.");
  await getDb()
    .update(members)
    .set({ status: "SUSPENDED", isPublic: false, updatedAt: new Date() })
    .where(eq(members.id, id));
  await getDb().insert(auditEvents).values({
    actorMemberId: actor.id,
    action: "member.suspended",
    entityType: "member",
    entityId: id,
  });
  revalidatePath("/admin");
  revalidatePath("/members");
}

export async function createPost(formData: FormData) {
  const actor = await requirePermission("content.manage");
  const data = z
    .object({
      title: z.string().trim().min(5).max(180),
      slug: z
        .string()
        .trim()
        .regex(/^[a-z0-9-]+$/)
        .max(180),
      excerpt: z.string().trim().min(10).max(400),
      bodyHtml: z.string().min(10).max(50000),
      coverImageUrl: z.union([z.url(), z.literal("")]),
      status: z.enum(["DRAFT", "PUBLISHED"]),
    })
    .parse(Object.fromEntries(formData));
  const bodyHtml = sanitizeHtml(data.bodyHtml, {
    allowedTags: [
      "p",
      "h2",
      "h3",
      "strong",
      "em",
      "ul",
      "ol",
      "li",
      "blockquote",
      "a",
      "img",
      "br",
    ],
    allowedAttributes: {
      a: ["href", "target", "rel"],
      img: ["src", "alt", "title"],
    },
    allowedSchemes: ["https"],
  });
  const publishedAt = data.status === "PUBLISHED" ? new Date() : null;
  const [post] = await getDb()
    .insert(posts)
    .values({
      title: data.title,
      slug: data.slug,
      excerpt: data.excerpt,
      bodyHtml,
      coverImageUrl: data.coverImageUrl || null,
      status: data.status,
      publishedAt,
      authorMemberId: actor.id,
    })
    .onConflictDoUpdate({
      target: posts.slug,
      set: {
        title: data.title,
        excerpt: data.excerpt,
        bodyHtml,
        coverImageUrl: data.coverImageUrl || null,
        status: data.status,
        publishedAt,
        updatedAt: new Date(),
      },
    })
    .returning({ id: posts.id });
  await getDb().insert(postRevisions).values({
    postId: post.id,
    editorMemberId: actor.id,
    title: data.title,
    excerpt: data.excerpt,
    bodyHtml,
  });
  await getDb()
    .insert(auditEvents)
    .values({
      actorMemberId: actor.id,
      action: "post.saved",
      entityType: "post",
      entityId: post.id,
      details: { status: data.status },
    });
  revalidatePath("/admin");
  revalidatePath("/news");
  revalidatePath(`/news/${data.slug}`);
}

export async function updateInquiry(formData: FormData) {
  const actor = await requirePermission("inquiries.manage");
  const data = z
    .object({
      inquiryId: z.uuid(),
      status: z.enum(["NEW", "IN_PROGRESS", "CLOSED", "SPAM"]),
    })
    .parse(Object.fromEntries(formData));
  await getDb()
    .update(inquiries)
    .set({ status: data.status, updatedAt: new Date() })
    .where(eq(inquiries.id, data.inquiryId));
  await getDb()
    .insert(auditEvents)
    .values({
      actorMemberId: actor.id,
      action: "inquiry.updated",
      entityType: "inquiry",
      entityId: data.inquiryId,
      details: { status: data.status },
    });
  revalidatePath("/admin");
}

export async function deleteInquiry(formData: FormData) {
  const actor = await requirePermission("inquiries.manage");
  const id = z.uuid().parse(formData.get("inquiryId"));
  await getDb().delete(inquiries).where(eq(inquiries.id, id));
  await getDb().insert(auditEvents).values({
    actorMemberId: actor.id,
    action: "inquiry.deleted",
    entityType: "inquiry",
    entityId: id,
  });
  revalidatePath("/admin");
}

export async function updatePost(formData: FormData) {
  const actor = await requirePermission("content.manage");
  const data = z
    .object({
      postId: z.uuid(),
      title: z.string().trim().min(5).max(180),
      slug: z
        .string()
        .trim()
        .regex(/^[a-z0-9-]+$/)
        .max(180),
      excerpt: z.string().trim().min(10).max(400),
      bodyHtml: z.string().min(10).max(50000),
      coverImageUrl: z.union([z.url(), z.literal("")]),
      status: z.enum(["DRAFT", "PUBLISHED"]),
    })
    .parse(Object.fromEntries(formData));
  const [existing] = await getDb()
    .select({ slug: posts.slug, publishedAt: posts.publishedAt })
    .from(posts)
    .where(eq(posts.id, data.postId))
    .limit(1);
  if (!existing) throw new Error("Post not found.");
  const bodyHtml = sanitizeHtml(data.bodyHtml, {
    allowedTags: [
      "p",
      "h2",
      "h3",
      "strong",
      "em",
      "ul",
      "ol",
      "li",
      "blockquote",
      "a",
      "img",
      "br",
    ],
    allowedAttributes: {
      a: ["href", "target", "rel"],
      img: ["src", "alt", "title"],
    },
    allowedSchemes: ["https"],
  });
  await getDb()
    .update(posts)
    .set({
      title: data.title,
      slug: data.slug,
      excerpt: data.excerpt,
      bodyHtml,
      coverImageUrl: data.coverImageUrl || null,
      status: data.status,
      publishedAt:
        data.status === "PUBLISHED"
          ? (existing.publishedAt ?? new Date())
          : null,
      updatedAt: new Date(),
    })
    .where(eq(posts.id, data.postId));
  await getDb()
    .insert(postRevisions)
    .values({
      postId: data.postId,
      editorMemberId: actor.id,
      title: data.title,
      excerpt: data.excerpt,
      bodyHtml,
    });
  await getDb()
    .insert(auditEvents)
    .values({
      actorMemberId: actor.id,
      action: "post.updated",
      entityType: "post",
      entityId: data.postId,
      details: { status: data.status },
    });
  revalidatePath("/admin");
  revalidatePath("/news");
  revalidatePath(`/news/${existing.slug}`);
  revalidatePath(`/news/${data.slug}`);
}

export async function deletePost(formData: FormData) {
  const actor = await requirePermission("content.manage");
  const id = z.uuid().parse(formData.get("postId"));
  const [existing] = await getDb()
    .select({ slug: posts.slug })
    .from(posts)
    .where(eq(posts.id, id))
    .limit(1);
  if (!existing) return;
  await getDb().delete(posts).where(eq(posts.id, id));
  await getDb()
    .insert(auditEvents)
    .values({
      actorMemberId: actor.id,
      action: "post.deleted",
      entityType: "post",
      entityId: id,
    });
  revalidatePath("/admin");
  revalidatePath("/news");
  revalidatePath(`/news/${existing.slug}`);
}

export async function deleteMember(formData: FormData) {
  const actor = await requirePermission("access.manage");
  if (actor.accessRole !== "SUPER_ADMIN")
    throw new Error("Only the super-admin can delete accounts.");
  const id = z.uuid().parse(formData.get("memberId"));
  if (id === actor.id)
    throw new Error("You cannot delete your own owner account.");
  const [target] = await getDb()
    .select({
      clerkUserId: members.clerkUserId,
      accessRole: members.accessRole,
    })
    .from(members)
    .where(eq(members.id, id))
    .limit(1);
  if (!target) return;
  if (target.accessRole === "SUPER_ADMIN")
    throw new Error("Transfer ownership before deleting the owner account.");
  const client = await clerkClient();
  await client.users.deleteUser(target.clerkUserId);
  await getDb().delete(members).where(eq(members.id, id));
  await getDb()
    .insert(auditEvents)
    .values({
      actorMemberId: actor.id,
      action: "member.deleted",
      entityType: "member",
      entityId: id,
    });
  revalidatePath("/admin");
  revalidatePath("/members");
}

export async function updateTeamHour(formData: FormData) {
  const actor = await requirePermission("activity.edit_all");
  const data = z
    .object({
      hourId: z.uuid(),
      date: z.string().date(),
      hours: z.coerce.number().positive().max(24),
      project: z.string().trim().min(2).max(100),
      category: z.string().trim().min(2).max(100),
      description: z.string().trim().min(3).max(1000),
    })
    .parse(Object.fromEntries(formData));
  await getDb()
    .update(hourEntries)
    .set({
      workDate: new Date(`${data.date}T12:00:00Z`),
      minutes: Math.round(data.hours * 60),
      project: data.project,
      category: data.category,
      description: data.description,
      updatedAt: new Date(),
    })
    .where(eq(hourEntries.id, data.hourId));
  await getDb()
    .insert(auditEvents)
    .values({
      actorMemberId: actor.id,
      action: "hour.corrected",
      entityType: "hour_entry",
      entityId: data.hourId,
    });
  revalidatePath("/admin");
  revalidatePath("/portal");
}

export async function voidTeamHour(formData: FormData) {
  const actor = await requirePermission("activity.edit_all");
  const id = z.uuid().parse(formData.get("hourId"));
  await getDb()
    .update(hourEntries)
    .set({ deletedAt: new Date(), updatedAt: new Date() })
    .where(eq(hourEntries.id, id));
  await getDb()
    .insert(auditEvents)
    .values({
      actorMemberId: actor.id,
      action: "hour.voided",
      entityType: "hour_entry",
      entityId: id,
    });
  revalidatePath("/admin");
  revalidatePath("/portal");
}

export async function updatePublicMemberCount(formData: FormData) {
  const actor = await requirePermission("access.manage");
  if (actor.accessRole !== "SUPER_ADMIN")
    throw new Error("Only the super-admin can override public statistics.");
  const enabled = formData.get("enabled") === "on";
  const value = z.coerce
    .number()
    .int()
    .min(0)
    .max(9999)
    .parse(formData.get("memberCount"));
  await getDb()
    .insert(publicSettings)
    .values({
      id: "site",
      memberCountOverrideEnabled: enabled,
      memberCountOverride: value,
    })
    .onConflictDoUpdate({
      target: publicSettings.id,
      set: {
        memberCountOverrideEnabled: enabled,
        memberCountOverride: value,
        updatedAt: new Date(),
      },
    });
  await getDb()
    .insert(auditEvents)
    .values({
      actorMemberId: actor.id,
      action: "site.member_count_updated",
      entityType: "public_settings",
      entityId: "site",
      details: { enabled, value },
    });
  revalidatePath("/admin");
  revalidatePath("/");
}

export async function syncMedia() {
  const actor = await requirePermission("media.manage");
  const result = await syncDrivePhotos();
  await getDb().insert(auditEvents).values({
    actorMemberId: actor.id,
    action: "media.drive_synced",
    entityType: "media",
    entityId: "drive",
    details: result,
  });
  revalidatePath("/admin");
  revalidatePath("/media");
  revalidatePath("/");
}

export async function assertAdmin() {
  const member = await requireActiveMember();
  if (
    !["CONTENT_ADMIN", "RECORDS_ADMIN", "FULL_ADMIN", "SUPER_ADMIN"].includes(
      member.accessRole,
    )
  )
    throw new Error("Admin access required.");
  return member;
}
