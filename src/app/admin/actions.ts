"use server";

import sanitizeHtml from "sanitize-html";
import { del } from "@vercel/blob";
import { clerkClient } from "@clerk/nextjs/server";
import { isClerkAPIResponseError } from "@clerk/nextjs/errors";
import { and, eq, inArray, isNull } from "drizzle-orm";
import { revalidatePath, updateTag } from "next/cache";
import { z } from "zod";
import { getDb } from "@/db";
import {
  auditEvents,
  contributions,
  galleryEvents,
  hourEntries,
  inquiries,
  mediaAssets,
  memberProjects,
  members,
  postRevisions,
  posts,
  projects,
  publicProfileCards,
  publicSettings,
  sponsors,
} from "@/db/schema";
import { requireAdminAccess, requirePermission } from "@/lib/auth";
import { syncDrivePhotos } from "@/lib/drive-sync";
import {
  assignableAccessRoles,
  hasPermission,
  permissionKeys,
  rolePresets,
} from "@/lib/permissions";
import { cleanupMediaIfUnused } from "@/lib/media";
import {
  DELETED_GALLERY_MEDIA_SOURCE,
  GALLERY_MEDIA_SOURCE,
} from "@/lib/media-policy";
import { isMissingClerkUserError } from "@/lib/clerk-errors";
import { refreshCalendarEvents } from "@/lib/calendar";
import { runTrackedSyncJob } from "@/lib/sync-jobs";
import {
  getWebsitePageDefinition,
  websiteContentKey,
  websitePages,
} from "@/lib/site-content-schema";
import {
  createCustomPageDraft,
  customPageSectionLayouts,
  isAvailableCustomPageSlug,
  normalizeCustomPageSlug,
  type CustomPage,
} from "@/lib/custom-pages";

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
      displayName: z.string().trim().min(2).max(100),
      organizationRole: z.string().trim().min(2).max(100),
      accessRole: z.enum(assignableAccessRoles),
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
      displayName: data.displayName,
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
  revalidatePath("/team");
}

export async function grantUniversityEmailOverride(formData: FormData) {
  const actor = await requirePermission("access.manage");
  const data = z.object({
    memberId: z.uuid(),
    reason: z.string().trim().min(10).max(500),
  }).parse(Object.fromEntries(formData));
  const now = new Date();
  await getDb().update(members).set({
    universityEmailOverrideAt: now,
    universityEmailOverrideByMemberId: actor.id,
    universityEmailOverrideReason: data.reason,
    accessStateUpdatedAt: now,
    updatedAt: now,
  }).where(eq(members.id, data.memberId));
  await getDb().insert(auditEvents).values({
    actorMemberId: actor.id,
    action: "MEMBER_UNIVERSITY_EMAIL_OVERRIDE_GRANTED",
    entityType: "member",
    entityId: data.memberId,
    details: { reason: data.reason },
  });
  revalidatePath("/admin");
  revalidatePath("/verify");
}

export async function revokeUniversityEmailOverride(formData: FormData) {
  const actor = await requirePermission("access.manage");
  const memberId = z.uuid().parse(formData.get("memberId"));
  await getDb().update(members).set({
    universityEmailOverrideAt: null,
    universityEmailOverrideByMemberId: null,
    universityEmailOverrideReason: null,
    accessStateUpdatedAt: new Date(),
    updatedAt: new Date(),
  }).where(eq(members.id, memberId));
  await getDb().insert(auditEvents).values({
    actorMemberId: actor.id,
    action: "MEMBER_UNIVERSITY_EMAIL_OVERRIDE_REVOKED",
    entityType: "member",
    entityId: memberId,
  });
  revalidatePath("/admin");
  revalidatePath("/verify");
}

export async function updateMemberAccess(
  _previousState: AdminFormState,
  formData: FormData,
): Promise<AdminFormState> {
  const actor = await requirePermission("access.manage");
  const parsed = z
    .object({
      memberId: z.uuid(),
      accessRole: z.enum(assignableAccessRoles),
    })
    .safeParse(Object.fromEntries(formData));
  if (!parsed.success)
    return {
      status: "error",
      message: "Choose a valid access preset and try again.",
      errors: parsed.error.flatten().fieldErrors,
    };
  const data = parsed.data;
  if (data.memberId === actor.id)
    return {
      status: "error",
      message: "Your own owner access cannot be changed here.",
    };
  if (data.accessRole === "FULL_ADMIN" && actor.accessRole !== "SUPER_ADMIN")
    return {
      status: "error",
      message: "Only the super-admin can grant Full Admin.",
    };
  if (
    actor.accessRole !== "SUPER_ADMIN" &&
    rolePresets[data.accessRole].some(
      (permission) =>
        !hasPermission(actor.accessRole, permission, actor.permissionOverrides),
    )
  )
    return {
      status: "error",
      message: "You cannot grant capabilities you do not possess.",
    };
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
    return {
      status: "error",
      message: "Only the super-admin can grant access-management authority.",
    };
  if (
    actor.accessRole !== "SUPER_ADMIN" &&
    allow.some(
      (permission) =>
        !hasPermission(actor.accessRole, permission, actor.permissionOverrides),
    )
  )
    return {
      status: "error",
      message: "You cannot grant capabilities you do not possess.",
    };
  const cleanAllow = allow.filter((permission) => !deny.includes(permission));
  const [updated] = await getDb()
    .update(members)
    .set({
      accessRole: data.accessRole,
      permissionOverrides: { allow: cleanAllow, deny },
      updatedAt: new Date(),
    })
    .where(eq(members.id, data.memberId))
    .returning({ id: members.id });
  if (!updated)
    return {
      status: "error",
      message: "That member account no longer exists.",
    };
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
  revalidatePath("/portal");
  revalidatePath("/team");
  console.info("[admin/access] member access updated", {
    actorId: actor.id,
    memberId: data.memberId,
    accessRole: data.accessRole,
    allowCount: cleanAllow.length,
    denyCount: deny.length,
  });
  return { status: "success", message: "Access settings saved." };
}

export type AdminFormState = {
  status: "idle" | "success" | "error";
  message: string;
  errors?: Record<string, string[]>;
};

function gallerySlug(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 90);
}

function driveFolderId(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const match = trimmed.match(/\/folders\/([a-zA-Z0-9_-]+)/);
  const id = match?.[1] || trimmed;
  if (!/^[a-zA-Z0-9_-]{10,120}$/.test(id))
    throw new Error("Enter a valid Google Drive folder link or folder ID.");
  return id;
}

async function resolvePostGallery(input: {
  galleryEventId?: string;
  newGalleryTitle?: string;
  galleryDriveFolder?: string;
}) {
  if (!input.newGalleryTitle?.trim()) return input.galleryEventId || null;
  const title = input.newGalleryTitle.trim().slice(0, 140);
  const base = gallerySlug(title) || "event-gallery";
  const slug = `${base}-${Date.now().toString(36)}`;
  const [event] = await getDb()
    .insert(galleryEvents)
    .values({
      title,
      slug,
      driveFolderId: driveFolderId(input.galleryDriveFolder || ""),
    })
    .returning({ id: galleryEvents.id });
  return event.id;
}

function postGalleryIds(formData: FormData, createdId: string | null) {
  const selected = z
    .array(z.uuid())
    .max(12)
    .parse(formData.getAll("galleryEventIds").map(String).filter(Boolean));
  return [...new Set([...selected, ...(createdId ? [createdId] : [])])];
}

function postEmbedUrls(value: string | undefined) {
  const values = (value || "")
    .split(/\r?\n/)
    .map((item) => item.trim())
    .filter(Boolean);
  if (values.length > 12) throw new Error("Attach no more than 12 embeds.");
  return values.map((value) => {
    const url = new URL(value);
    if (url.protocol !== "https:")
      throw new Error("Article and social embeds must use secure HTTPS links.");
    return url.toString();
  });
}

async function revalidateNewsLinkedToGallery(eventId: string) {
  const linked = await getDb()
    .select({
      slug: posts.slug,
      galleryEventId: posts.galleryEventId,
      galleryEventIds: posts.galleryEventIds,
    })
    .from(posts);
  for (const post of linked) {
    if (
      post.galleryEventId === eventId ||
      post.galleryEventIds.includes(eventId)
    )
      revalidatePath(`/news/${post.slug}`);
  }
}

export async function updateMemberProfile(
  _previousState: AdminFormState,
  formData: FormData,
): Promise<AdminFormState> {
  const actor = await requirePermission("members.edit");
  const parsed = z
    .object({
      memberId: z.uuid(),
      displayName: z.string().trim().min(2).max(100),
      organizationRole: z.string().trim().min(2).max(100),
      bio: z.string().trim().max(700),
      isPublic: z.string().optional(),
      photoMediaId: z.union([z.uuid(), z.literal("")]),
      removePhoto: z.string().optional(),
    })
    .safeParse(Object.fromEntries(formData));
  if (!parsed.success)
    return {
      status: "error",
      message: "Please correct the account fields.",
      errors: parsed.error.flatten().fieldErrors,
    };
  const data = parsed.data;
  const [target] = await getDb()
    .select()
    .from(members)
    .where(eq(members.id, data.memberId))
    .limit(1);
  if (!target) return { status: "error", message: "Account not found." };
  if (target.accessRole === "SUPER_ADMIN" && actor.accessRole !== "SUPER_ADMIN")
    return {
      status: "error",
      message: "Only the owner can edit the owner profile.",
    };
  if (data.photoMediaId) {
    const [owned] = await getDb()
      .select({ id: mediaAssets.id })
      .from(mediaAssets)
      .where(
        and(
          eq(mediaAssets.id, data.photoMediaId),
          eq(mediaAssets.uploadedByMemberId, actor.id),
        ),
      )
      .limit(1);
    if (!owned)
      return {
        status: "error",
        message: "The selected image could not be verified.",
      };
  }
  const changingPhoto = Boolean(data.photoMediaId) || data.removePhoto === "on";
  await getDb()
    .update(members)
    .set({
      displayName: data.displayName,
      organizationRole: data.organizationRole,
      bio: data.bio,
      isPublic: data.isPublic === "on",
      ...(changingPhoto
        ? { photoMediaId: data.photoMediaId || null, photoUrl: null }
        : {}),
      updatedAt: new Date(),
    })
    .where(eq(members.id, data.memberId));
  await assignProjects(data.memberId, formData.getAll("projects").map(String));
  await getDb().insert(auditEvents).values({
    actorMemberId: actor.id,
    action: "member.profile_updated",
    entityType: "member",
    entityId: data.memberId,
  });
  revalidatePath("/admin");
  revalidatePath("/portal");
  revalidatePath("/members");
  revalidatePath("/team");
  if (changingPhoto && target.photoMediaId !== data.photoMediaId)
    await cleanupMediaIfUnused(target.photoMediaId);
  return { status: "success", message: "Account saved." };
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
  revalidatePath("/team");
  revalidatePath("/portal");
}

export async function restoreMember(
  _previousState: AdminFormState,
  formData: FormData,
): Promise<AdminFormState> {
  const actor = await requirePermission("members.approve");
  const parsedId = z.uuid().safeParse(formData.get("memberId"));
  if (!parsedId.success)
    return { status: "error", message: "The account identifier is invalid." };
  const id = parsedId.data;
  const [target] = await getDb()
    .select({ status: members.status, accessRole: members.accessRole })
    .from(members)
    .where(eq(members.id, id))
    .limit(1);
  if (!target)
    return { status: "error", message: "That account no longer exists." };
  if (target.status === "PENDING")
    return {
      status: "error",
      message: "Approve this pending account instead.",
    };
  if (target.status === "ACTIVE")
    return { status: "success", message: "This account is already active." };
  if (target.accessRole === "SUPER_ADMIN")
    return {
      status: "error",
      message: "The owner account cannot be restored here.",
    };
  await getDb()
    .update(members)
    .set({ status: "ACTIVE", updatedAt: new Date() })
    .where(eq(members.id, id));
  await getDb().insert(auditEvents).values({
    actorMemberId: actor.id,
    action: "member.restored",
    entityType: "member",
    entityId: id,
  });
  revalidatePath("/admin");
  revalidatePath("/portal");
  revalidatePath("/members");
  revalidatePath("/team");
  return {
    status: "success",
    message: "Account restored. The member can sign in again.",
  };
}

const sponsorSchema = z.object({
  sponsorId: z.union([z.uuid(), z.literal("")]),
  name: z.string().trim().min(2).max(120),
  sponsorship: z.string().trim().min(2).max(180),
  tier: z.string().trim().min(2).max(80),
  websiteUrl: z.union([z.literal(""), z.url().max(500)]),
  logoMediaId: z.union([z.uuid(), z.literal("")]),
  removeLogo: z.string().optional(),
  sortOrder: z.coerce.number().int().min(0).max(9999),
  published: z.string().optional(),
});

export async function saveSponsor(
  _previousState: AdminFormState,
  formData: FormData,
): Promise<AdminFormState> {
  const actor = await requirePermission("sponsors.manage");
  const parsed = sponsorSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success)
    return {
      status: "error",
      message: "Please correct the sponsor details.",
      errors: parsed.error.flatten().fieldErrors,
    };
  const data = parsed.data;
  const [existing] = data.sponsorId
    ? await getDb()
        .select()
        .from(sponsors)
        .where(eq(sponsors.id, data.sponsorId))
        .limit(1)
    : [];
  if (data.sponsorId && !existing)
    return { status: "error", message: "That sponsor no longer exists." };
  if (data.logoMediaId) {
    const [owned] = await getDb()
      .select({ id: mediaAssets.id })
      .from(mediaAssets)
      .where(
        and(
          eq(mediaAssets.id, data.logoMediaId),
          eq(mediaAssets.uploadedByMemberId, actor.id),
        ),
      )
      .limit(1);
    if (!owned)
      return {
        status: "error",
        message: "The selected logo could not be verified.",
      };
  }
  const changingLogo = Boolean(data.logoMediaId) || data.removeLogo === "on";
  if (!existing && !data.logoMediaId)
    return { status: "error", message: "Upload a sponsor logo before saving." };
  if (existing && data.removeLogo === "on" && !data.logoMediaId)
    return {
      status: "error",
      message: "Replace the logo before removing the current one.",
    };
  const values = {
    name: data.name,
    sponsorship: data.sponsorship,
    tier: data.tier,
    websiteUrl: data.websiteUrl || null,
    ...(changingLogo
      ? { logoMediaId: data.logoMediaId || null, logoUrl: null }
      : {}),
    sortOrder: data.sortOrder,
    published: data.published === "on",
    updatedAt: new Date(),
  };
  const [saved] = existing
    ? await getDb()
        .update(sponsors)
        .set(values)
        .where(eq(sponsors.id, existing.id))
        .returning({ id: sponsors.id })
    : await getDb()
        .insert(sponsors)
        .values(values)
        .returning({ id: sponsors.id });
  await getDb()
    .insert(auditEvents)
    .values({
      actorMemberId: actor.id,
      action: existing ? "sponsor.updated" : "sponsor.created",
      entityType: "sponsor",
      entityId: saved.id,
      details: { name: data.name, published: data.published === "on" },
    });
  revalidatePath("/admin");
  revalidatePath("/");
  revalidatePath("/sponsors");
  if (existing && changingLogo && existing.logoMediaId !== data.logoMediaId)
    await cleanupMediaIfUnused(existing.logoMediaId);
  return {
    status: "success",
    message: existing ? "Sponsor changes saved." : "Sponsor added.",
  };
}

export async function deleteSponsor(
  _previousState: AdminFormState,
  formData: FormData,
): Promise<AdminFormState> {
  const actor = await requirePermission("sponsors.manage");
  const parsedId = z.uuid().safeParse(formData.get("sponsorId"));
  if (!parsedId.success)
    return { status: "error", message: "The sponsor identifier is invalid." };
  const [existing] = await getDb()
    .select({
      id: sponsors.id,
      name: sponsors.name,
      logoMediaId: sponsors.logoMediaId,
    })
    .from(sponsors)
    .where(eq(sponsors.id, parsedId.data))
    .limit(1);
  if (!existing)
    return { status: "success", message: "The sponsor was already removed." };
  await getDb().delete(sponsors).where(eq(sponsors.id, existing.id));
  await getDb()
    .insert(auditEvents)
    .values({
      actorMemberId: actor.id,
      action: "sponsor.deleted",
      entityType: "sponsor",
      entityId: existing.id,
      details: { name: existing.name },
    });
  revalidatePath("/admin");
  revalidatePath("/");
  revalidatePath("/sponsors");
  await cleanupMediaIfUnused(existing.logoMediaId);
  return { status: "success", message: "Sponsor deleted." };
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
      coverMediaId: z.union([z.uuid(), z.literal("")]),
      removeCover: z.string().optional(),
      embedUrls: z.string().max(6000).optional(),
      newGalleryTitle: z.string().trim().max(140).optional(),
      galleryDriveFolder: z.string().trim().max(500).optional(),
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
  const createdGalleryId = await resolvePostGallery(data);
  const galleryEventIds = postGalleryIds(formData, createdGalleryId);
  const galleryEventId = galleryEventIds[0] || null;
  const embedUrls = postEmbedUrls(data.embedUrls);
  if (data.coverMediaId) {
    const [owned] = await getDb()
      .select({ id: mediaAssets.id })
      .from(mediaAssets)
      .where(
        and(
          eq(mediaAssets.id, data.coverMediaId),
          eq(mediaAssets.uploadedByMemberId, actor.id),
        ),
      )
      .limit(1);
    if (!owned)
      throw new Error("The selected cover image could not be verified.");
  }
  const [post] = await getDb()
    .insert(posts)
    .values({
      title: data.title,
      slug: data.slug,
      excerpt: data.excerpt,
      bodyHtml,
      coverMediaId: data.coverMediaId || null,
      galleryEventId,
      galleryEventIds,
      embedUrls,
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
        coverMediaId: data.coverMediaId || null,
        galleryEventId,
        galleryEventIds,
        embedUrls,
        coverImageUrl: null,
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
      coverMediaId: z.union([z.uuid(), z.literal("")]),
      removeCover: z.string().optional(),
      embedUrls: z.string().max(6000).optional(),
      newGalleryTitle: z.string().trim().max(140).optional(),
      galleryDriveFolder: z.string().trim().max(500).optional(),
      status: z.enum(["DRAFT", "PUBLISHED"]),
    })
    .parse(Object.fromEntries(formData));
  const [existing] = await getDb()
    .select({
      slug: posts.slug,
      publishedAt: posts.publishedAt,
      coverMediaId: posts.coverMediaId,
    })
    .from(posts)
    .where(eq(posts.id, data.postId))
    .limit(1);
  if (!existing) throw new Error("Post not found.");
  if (data.coverMediaId) {
    const [owned] = await getDb()
      .select({ id: mediaAssets.id })
      .from(mediaAssets)
      .where(
        and(
          eq(mediaAssets.id, data.coverMediaId),
          eq(mediaAssets.uploadedByMemberId, actor.id),
        ),
      )
      .limit(1);
    if (!owned)
      throw new Error("The selected cover image could not be verified.");
  }
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
  const changingCover = Boolean(data.coverMediaId) || data.removeCover === "on";
  const createdGalleryId = await resolvePostGallery(data);
  const galleryEventIds = postGalleryIds(formData, createdGalleryId);
  const galleryEventId = galleryEventIds[0] || null;
  const embedUrls = postEmbedUrls(data.embedUrls);
  await getDb()
    .update(posts)
    .set({
      title: data.title,
      slug: data.slug,
      excerpt: data.excerpt,
      bodyHtml,
      ...(changingCover
        ? { coverMediaId: data.coverMediaId || null, coverImageUrl: null }
        : {}),
      galleryEventId,
      galleryEventIds,
      embedUrls,
      status: data.status,
      publishedAt:
        data.status === "PUBLISHED"
          ? (existing.publishedAt ?? new Date())
          : null,
      updatedAt: new Date(),
    })
    .where(eq(posts.id, data.postId));
  await getDb().insert(postRevisions).values({
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
  if (changingCover && existing.coverMediaId !== data.coverMediaId)
    await cleanupMediaIfUnused(existing.coverMediaId);
}

export async function deletePost(formData: FormData) {
  const actor = await requirePermission("content.manage");
  const id = z.uuid().parse(formData.get("postId"));
  const [existing] = await getDb()
    .select({ slug: posts.slug, coverMediaId: posts.coverMediaId })
    .from(posts)
    .where(eq(posts.id, id))
    .limit(1);
  if (!existing) return;
  await getDb().delete(posts).where(eq(posts.id, id));
  await getDb().insert(auditEvents).values({
    actorMemberId: actor.id,
    action: "post.deleted",
    entityType: "post",
    entityId: id,
  });
  revalidatePath("/admin");
  revalidatePath("/news");
  revalidatePath(`/news/${existing.slug}`);
  await cleanupMediaIfUnused(existing.coverMediaId);
}

export async function deleteMember(
  _previousState: AdminFormState,
  formData: FormData,
): Promise<AdminFormState> {
  const actor = await requirePermission("access.manage");
  if (actor.accessRole !== "SUPER_ADMIN")
    return {
      status: "error",
      message: "Only the super-admin can delete accounts.",
    };
  const parsedId = z.uuid().safeParse(formData.get("memberId"));
  if (!parsedId.success)
    return { status: "error", message: "The account identifier is invalid." };
  const id = parsedId.data;
  if (id === actor.id)
    return {
      status: "error",
      message: "You cannot delete your own owner account.",
    };
  const [target] = await getDb()
    .select({
      clerkUserId: members.clerkUserId,
      accessRole: members.accessRole,
      photoMediaId: members.photoMediaId,
    })
    .from(members)
    .where(eq(members.id, id))
    .limit(1);
  if (!target)
    return { status: "success", message: "The account was already removed." };
  if (target.accessRole === "SUPER_ADMIN")
    return {
      status: "error",
      message: "Transfer ownership before deleting the owner account.",
    };
  const client = await clerkClient();
  try {
    await client.users.deleteUser(target.clerkUserId);
  } catch (error) {
    if (!isMissingClerkUserError(error)) {
      console.error("[admin/delete-member] Clerk deletion failed", {
        actorId: actor.id,
        memberId: id,
        clerkStatus: isClerkAPIResponseError(error) ? error.status : null,
      });
      return {
        status: "error",
        message:
          "Clerk could not delete this identity. The portal account was left unchanged.",
      };
    }
    console.warn("[admin/delete-member] Clerk identity already absent", {
      actorId: actor.id,
      memberId: id,
    });
  }
  await getDb().delete(members).where(eq(members.id, id));
  await getDb().insert(auditEvents).values({
    actorMemberId: actor.id,
    action: "member.deleted",
    entityType: "member",
    entityId: id,
  });
  revalidatePath("/admin");
  revalidatePath("/members");
  revalidatePath("/team");
  await cleanupMediaIfUnused(target.photoMediaId);
  console.info("[admin/delete-member] account deleted", {
    actorId: actor.id,
    memberId: id,
  });
  return { status: "success", message: "Account permanently deleted." };
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
    .where(and(eq(hourEntries.id, data.hourId), isNull(hourEntries.deletedAt)));
  await getDb().insert(auditEvents).values({
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
    .where(and(eq(hourEntries.id, id), isNull(hourEntries.deletedAt)));
  await getDb().insert(auditEvents).values({
    actorMemberId: actor.id,
    action: "hour.voided",
    entityType: "hour_entry",
    entityId: id,
  });
  revalidatePath("/admin");
  revalidatePath("/portal");
}

export async function updateTeamContribution(formData: FormData) {
  const actor = await requirePermission("activity.edit_all");
  const data = z
    .object({
      contributionId: z.uuid(),
      date: z.string().date(),
      title: z.string().trim().min(3).max(160),
      project: z.string().trim().min(2).max(100),
      category: z.string().trim().min(2).max(100),
      description: z.string().trim().min(3).max(1000),
      link: z.union([z.literal(""), z.url()]).default(""),
    })
    .parse(Object.fromEntries(formData));
  await getDb()
    .update(contributions)
    .set({
      contributionDate: new Date(`${data.date}T12:00:00Z`),
      title: data.title,
      project: data.project,
      category: data.category,
      description: data.description,
      evidenceUrl: data.link || null,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(contributions.id, data.contributionId),
        isNull(contributions.deletedAt),
      ),
    );
  await getDb().insert(auditEvents).values({
    actorMemberId: actor.id,
    action: "contribution.corrected",
    entityType: "contribution",
    entityId: data.contributionId,
  });
  revalidatePath("/admin");
  revalidatePath("/portal");
}

export async function voidTeamContribution(formData: FormData) {
  const actor = await requirePermission("activity.edit_all");
  const id = z.uuid().parse(formData.get("contributionId"));
  await getDb()
    .update(contributions)
    .set({ deletedAt: new Date(), updatedAt: new Date() })
    .where(and(eq(contributions.id, id), isNull(contributions.deletedAt)));
  await getDb().insert(auditEvents).values({
    actorMemberId: actor.id,
    action: "contribution.voided",
    entityType: "contribution",
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
  await getDb().insert(auditEvents).values({
    actorMemberId: actor.id,
    action: "site.member_count_updated",
    entityType: "public_settings",
    entityId: "site",
    details: { enabled, value },
  });
  revalidatePath("/admin");
  revalidatePath("/");
}

function validWebsiteImage(value: string) {
  if (value.startsWith("/")) return value.length <= 1000;
  try {
    const url = new URL(value);
    return (
      url.protocol === "https:" &&
      (url.hostname.endsWith(".public.blob.vercel-storage.com") ||
        url.hostname === "news.utsa.edu" ||
        url.hostname === "img.clerk.com")
    );
  } catch {
    return false;
  }
}

function validOptionalWebsiteImage(value: string) {
  return value === "" || validWebsiteImage(value);
}

function validWebsiteLink(value: string) {
  if (!value) return true;
  if (value.startsWith("/") && !value.startsWith("//")) return true;
  try {
    const url = new URL(value);
    return url.protocol === "https:";
  } catch {
    return false;
  }
}

async function readCustomPages() {
  const [current] = await getDb()
    .select({ customPages: publicSettings.customPages })
    .from(publicSettings)
    .where(eq(publicSettings.id, "site"))
    .limit(1);
  return current?.customPages ?? [];
}

async function writeCustomPages(pages: CustomPage[]) {
  await getDb()
    .insert(publicSettings)
    .values({ id: "site", customPages: pages })
    .onConflictDoUpdate({
      target: publicSettings.id,
      set: { customPages: pages, updatedAt: new Date() },
    });
}

export async function createCustomWebsitePage(formData: FormData) {
  const actor = await requirePermission("content.manage");
  const data = z
    .object({
      pageLabel: z.string().trim().min(2).max(50),
      pageSlug: z.string().trim().max(80).optional().default(""),
    })
    .parse(Object.fromEntries(formData));
  const pages = await readCustomPages();
  const slug = normalizeCustomPageSlug(data.pageSlug || data.pageLabel);
  if (!isAvailableCustomPageSlug(slug, pages))
    throw new Error("Choose a unique page address that is not already in use.");
  const page = createCustomPageDraft({
    id: crypto.randomUUID(),
    label: data.pageLabel,
    slug,
    now: new Date().toISOString(),
  });
  await writeCustomPages([...pages, page]);
  await getDb()
    .insert(auditEvents)
    .values({
      actorMemberId: actor.id,
      action: "site.custom_page_created",
      entityType: "custom_page",
      entityId: page.id,
      details: { route: `/${page.slug}`, label: page.navLabel },
    });
  revalidatePath("/admin");
}

const customSectionSchema = z.object({
  id: z.string().min(1).max(100),
  eyebrow: z.string().trim().max(100),
  title: z.string().trim().min(1).max(200),
  body: z.string().trim().max(5000),
  image: z.string().trim().max(1000),
  layout: z.enum(customPageSectionLayouts.map((layout) => layout.value)),
  buttonLabel: z.string().trim().max(80),
  buttonHref: z.string().trim().max(1000),
});

export async function saveCustomWebsitePage(
  pageId: string,
  formData: FormData,
) {
  const actor = await requirePermission("content.manage");
  const data = z
    .object({
      navLabel: z.string().trim().min(1).max(50),
      slug: z.string().trim().min(1).max(80),
      seoTitle: z.string().trim().min(1).max(100),
      seoDescription: z.string().trim().max(300),
      status: z.enum(["DRAFT", "PUBLISHED"]),
      navigationOrder: z.coerce.number().int().min(0).max(999),
      heroEyebrow: z.string().trim().max(100),
      heroTitle: z.string().trim().min(1).max(200),
      heroBody: z.string().trim().max(2000),
      heroImage: z.string().trim().max(1000),
      sectionsJson: z.string().max(100000),
    })
    .parse(Object.fromEntries(formData));
  const pages = await readCustomPages();
  const index = pages.findIndex((page) => page.id === pageId);
  if (index < 0) throw new Error("Custom page not found.");
  const previous = pages[index];
  const slug = normalizeCustomPageSlug(data.slug);
  if (!isAvailableCustomPageSlug(slug, pages, pageId))
    throw new Error("Choose a unique page address that is not already in use.");
  let sections: z.infer<typeof customSectionSchema>[];
  try {
    sections = z
      .array(customSectionSchema)
      .max(12)
      .parse(JSON.parse(data.sectionsJson));
  } catch {
    throw new Error("One or more page sections are incomplete.");
  }
  const uploadIds = [
    String(formData.get("upload_heroImage") || ""),
    ...sections.map((section) =>
      String(formData.get(`upload_section_${section.id}`) || ""),
    ),
  ].filter((id) => z.uuid().safeParse(id).success);
  const uploaded = uploadIds.length
    ? await getDb()
        .select({ id: mediaAssets.id, blobUrl: mediaAssets.blobUrl })
        .from(mediaAssets)
        .where(inArray(mediaAssets.id, uploadIds))
    : [];
  const uploadedById = new Map(
    uploaded.map((asset) => [asset.id, asset.blobUrl]),
  );
  const heroUploadId = String(formData.get("upload_heroImage") || "");
  const heroImage =
    formData.get("remove_heroImage") === "on"
      ? ""
      : (uploadedById.get(heroUploadId) ?? data.heroImage);
  if (!validOptionalWebsiteImage(heroImage))
    throw new Error("The hero image must use an approved image URL.");
  const finalizedSections = sections.map((section) => {
    const uploadId = String(formData.get(`upload_section_${section.id}`) || "");
    const image =
      formData.get(`remove_section_${section.id}`) === "on"
        ? ""
        : (uploadedById.get(uploadId) ?? section.image);
    if (!validOptionalWebsiteImage(image))
      throw new Error(`${section.title} must use an approved image URL.`);
    if (!validWebsiteLink(section.buttonHref))
      throw new Error(`${section.title} has an invalid button link.`);
    return { ...section, image };
  });
  const nextPage: CustomPage = {
    ...previous,
    slug,
    navLabel: data.navLabel,
    seoTitle: data.seoTitle,
    seoDescription: data.seoDescription,
    status: data.status,
    showInNavigation: formData.get("showInNavigation") === "on",
    navigationOrder: data.navigationOrder,
    heroEyebrow: data.heroEyebrow,
    heroTitle: data.heroTitle,
    heroBody: data.heroBody,
    heroImage,
    showJoinCta: formData.get("showJoinCta") === "on",
    sections: finalizedSections,
    updatedAt: new Date().toISOString(),
  };
  const nextPages = [...pages];
  nextPages[index] = nextPage;
  await writeCustomPages(nextPages);
  await getDb()
    .insert(auditEvents)
    .values({
      actorMemberId: actor.id,
      action: "site.custom_page_updated",
      entityType: "custom_page",
      entityId: pageId,
      details: {
        route: `/${slug}`,
        status: data.status,
        sectionCount: finalizedSections.length,
        navigation: nextPage.showInNavigation,
      },
    });
  revalidatePath(`/${previous.slug}`);
  revalidatePath(`/${slug}`);
  revalidatePath("/api/site-navigation");
  revalidatePath("/admin");
}

export async function unpublishCustomWebsitePage(pageId: string) {
  const actor = await requirePermission("content.manage");
  const pages = await readCustomPages();
  const index = pages.findIndex((page) => page.id === pageId);
  if (index < 0) throw new Error("Custom page not found.");
  const page = pages[index];
  const nextPages = [...pages];
  nextPages[index] = {
    ...page,
    status: "DRAFT",
    showInNavigation: false,
    updatedAt: new Date().toISOString(),
  };
  await writeCustomPages(nextPages);
  await getDb()
    .insert(auditEvents)
    .values({
      actorMemberId: actor.id,
      action: "site.custom_page_unpublished",
      entityType: "custom_page",
      entityId: pageId,
      details: { route: `/${page.slug}` },
    });
  revalidatePath(`/${page.slug}`);
  revalidatePath("/api/site-navigation");
  revalidatePath("/admin");
}

export async function saveWebsitePageContent(
  pageId: string,
  formData: FormData,
) {
  const actor = await requirePermission("content.manage");
  if (!websitePages.some((page) => page.id === pageId))
    throw new Error("Unknown website page.");
  const page = getWebsitePageDefinition(pageId);
  const [current] = await getDb()
    .select({ pageContent: publicSettings.pageContent })
    .from(publicSettings)
    .where(eq(publicSettings.id, "site"))
    .limit(1);
  const next = { ...(current?.pageContent ?? {}) };
  const uploadIds = page.fields
    .filter((field) => field.type === "image")
    .map((field) => String(formData.get(`upload_${field.key}`) || ""))
    .filter((id) => z.uuid().safeParse(id).success);
  const uploaded = uploadIds.length
    ? await getDb()
        .select({ id: mediaAssets.id, blobUrl: mediaAssets.blobUrl })
        .from(mediaAssets)
        .where(inArray(mediaAssets.id, uploadIds))
    : [];
  const uploadedById = new Map(
    uploaded.map((asset) => [asset.id, asset.blobUrl]),
  );
  for (const field of page.fields) {
    const storageKey = websiteContentKey(page.id, field.key);
    if (field.type === "image") {
      const remove = formData.get(`remove_${field.key}`) === "on";
      const uploadId = String(formData.get(`upload_${field.key}`) || "");
      const typedValue = String(formData.get(field.key) || "").trim();
      const value = remove
        ? field.defaultValue
        : (uploadedById.get(uploadId) ?? typedValue);
      if (!validWebsiteImage(value))
        throw new Error(`${field.label} must be a valid image URL.`);
      next[storageKey] = value;
      continue;
    }
    const value = String(formData.get(field.key) || "").trim();
    const limit = field.type === "textarea" ? 5000 : 300;
    if (value.length > limit) throw new Error(`${field.label} is too long.`);
    if (
      page.id === "contact" &&
      field.key === "contactEmail" &&
      !z.email().safeParse(value).success
    )
      throw new Error("Enter a valid public contact email.");
    next[storageKey] = value;
  }
  await getDb()
    .insert(publicSettings)
    .values({ id: "site", pageContent: next })
    .onConflictDoUpdate({
      target: publicSettings.id,
      set: { pageContent: next, updatedAt: new Date() },
    });
  await getDb()
    .insert(auditEvents)
    .values({
      actorMemberId: actor.id,
      action: "site.page_content_updated",
      entityType: "public_settings",
      entityId: page.id,
      details: { route: page.route, fieldCount: page.fields.length },
    });
  revalidatePath(page.route);
  revalidatePath("/admin");
}

export async function resetWebsitePageContent(pageId: string) {
  const actor = await requirePermission("content.manage");
  if (!websitePages.some((page) => page.id === pageId))
    throw new Error("Unknown website page.");
  const page = getWebsitePageDefinition(pageId);
  const [current] = await getDb()
    .select({ pageContent: publicSettings.pageContent })
    .from(publicSettings)
    .where(eq(publicSettings.id, "site"))
    .limit(1);
  const next = { ...(current?.pageContent ?? {}) };
  for (const field of page.fields)
    delete next[websiteContentKey(page.id, field.key)];
  await getDb()
    .insert(publicSettings)
    .values({ id: "site", pageContent: next })
    .onConflictDoUpdate({
      target: publicSettings.id,
      set: { pageContent: next, updatedAt: new Date() },
    });
  await getDb()
    .insert(auditEvents)
    .values({
      actorMemberId: actor.id,
      action: "site.page_content_reset",
      entityType: "public_settings",
      entityId: page.id,
      details: { route: page.route },
    });
  revalidatePath(page.route);
  revalidatePath("/admin");
}

export type SyncMediaState = {
  status: "idle" | "success" | "error";
  message: string;
};

export async function syncMedia(
  _previousState: SyncMediaState,
  _formData: FormData,
): Promise<SyncMediaState> {
  void _previousState;
  void _formData;
  const actor = await requirePermission("media.manage");
  try {
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
    return {
      status: "success",
      message: `Refresh complete: ${result.imported} imported, ${result.skipped} unchanged or skipped, ${result.discovered} found.`,
    };
  } catch (error) {
    console.error("Manual Drive media sync failed", error);
    return {
      status: "error",
      message:
        "Drive could not be refreshed. Confirm the shared media folder is set to Anyone with the link can view, then try again.",
    };
  }
}

export type CalendarRefreshState = {
  status: "idle" | "success" | "error";
  message: string;
  refreshedAt?: string;
};

export async function refreshSharedCalendar(
  _previousState: CalendarRefreshState,
  _formData: FormData,
): Promise<CalendarRefreshState> {
  void _previousState;
  void _formData;
  const actor = await requirePermission("events.manage");
  try {
    const result = await runTrackedSyncJob({
      job: "GOOGLE_CALENDAR",
      source: "MANUAL",
      run: refreshCalendarEvents,
      recordsChanged: (value) => value.count,
    });
    await getDb()
      .insert(auditEvents)
      .values({
        actorMemberId: actor.id,
        action: "calendar.refreshed",
        entityType: "calendar",
        entityId: "shared",
        details: { eventCount: result.count },
      });
    updateTag("calendar");
    revalidatePath("/admin");
    revalidatePath("/events");
    revalidatePath("/");
    return {
      status: "success",
      message: `${result.count} shared-calendar ${result.count === 1 ? "event" : "events"} refreshed.`,
      refreshedAt: result.syncedAt.toISOString(),
    };
  } catch (error) {
    console.error("Manual calendar refresh failed", error);
    return {
      status: "error",
      message:
        "The shared calendar could not be refreshed. Confirm it is still public, then try again.",
    };
  }
}

export async function deleteGalleryMediaBatch(
  _previousState: AdminFormState,
  formData: FormData,
): Promise<AdminFormState> {
  const actor = await requirePermission("media.manage");
  const parsedIds = z
    .array(z.uuid())
    .min(1)
    .max(200)
    .safeParse([...new Set(formData.getAll("mediaIds").map(String))]);
  if (!parsedIds.success)
    return {
      status: "error",
      message: "Select between 1 and 200 gallery items.",
    };
  const assets = await getDb()
    .select({
      id: mediaAssets.id,
      filename: mediaAssets.filename,
      pathname: mediaAssets.pathname,
      source: mediaAssets.source,
    })
    .from(mediaAssets)
    .where(
      and(
        inArray(mediaAssets.id, parsedIds.data),
        eq(mediaAssets.source, GALLERY_MEDIA_SOURCE),
      ),
    );
  if (!assets.length)
    return {
      status: "error",
      message: "The selected gallery items are no longer available.",
    };

  await getDb()
    .update(mediaAssets)
    .set({
      source: DELETED_GALLERY_MEDIA_SOURCE,
      published: false,
      archivedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(
      inArray(
        mediaAssets.id,
        assets.map((asset) => asset.id),
      ),
    );
  await getDb()
    .insert(auditEvents)
    .values(
      assets.map((asset) => ({
        actorMemberId: actor.id,
        action: "media.deleted_from_gallery",
        entityType: "media",
        entityId: asset.id,
        details: { filename: asset.filename, batchSize: assets.length },
      })),
    );
  revalidatePath("/admin");
  revalidatePath("/media");
  revalidatePath("/");
  try {
    await del(assets.map((asset) => asset.pathname));
  } catch (error) {
    console.error("Deleted gallery Blob cleanup failed", error);
  }
  return {
    status: "success",
    message: `${assets.length} gallery ${assets.length === 1 ? "item" : "items"} deleted.`,
  };
}

export async function saveGalleryEvent(
  _previousState: AdminFormState,
  formData: FormData,
): Promise<AdminFormState> {
  void _previousState;
  try {
    const actor = await requirePermission("media.manage");
    const data = z
      .object({
        eventId: z.union([z.uuid(), z.literal("")]).optional(),
        legacyAlbum: z.string().trim().max(160).optional(),
        title: z.string().trim().min(2).max(140),
        description: z.string().trim().max(800).optional(),
        eventDate: z.string().trim().max(20).optional(),
        driveFolder: z.string().trim().max(500).optional(),
        published: z.string().optional(),
      })
      .parse(Object.fromEntries(formData));
    const values = {
      title: data.title,
      description: data.description || "",
      eventDate: data.eventDate ? new Date(`${data.eventDate}T12:00:00`) : null,
      driveFolderId: driveFolderId(data.driveFolder || ""),
      published: data.published === "on",
      updatedAt: new Date(),
    };
    let id: string;
    if (data.eventId) {
      const [event] = await getDb()
        .update(galleryEvents)
        .set(values)
        .where(eq(galleryEvents.id, data.eventId))
        .returning({ id: galleryEvents.id });
      if (!event) throw new Error("Gallery event not found.");
      id = event.id;
    } else {
      const base = gallerySlug(data.title) || "event-gallery";
      const [event] = await getDb()
        .insert(galleryEvents)
        .values({ ...values, slug: `${base}-${Date.now().toString(36)}` })
        .returning({ id: galleryEvents.id });
      id = event.id;
      if (data.legacyAlbum) {
        await getDb()
          .update(mediaAssets)
          .set({
            galleryEventId: id,
            album: data.title,
            source: GALLERY_MEDIA_SOURCE,
            published: true,
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(mediaAssets.album, data.legacyAlbum),
              isNull(mediaAssets.galleryEventId),
              isNull(mediaAssets.archivedAt),
            ),
          );
      }
    }
    await getDb()
      .insert(auditEvents)
      .values({
        actorMemberId: actor.id,
        action: data.eventId
          ? "gallery.event_updated"
          : data.legacyAlbum
            ? "gallery.album_converted"
            : "gallery.event_created",
        entityType: "gallery_event",
        entityId: id,
        details: {
          title: data.title,
          hasDriveFolder: Boolean(values.driveFolderId),
        },
      });
    revalidatePath("/admin");
    revalidatePath("/media");
    revalidatePath("/news");
    await revalidateNewsLinkedToGallery(id);
    return {
      status: "success",
      message: data.eventId
        ? "Gallery event updated."
        : data.legacyAlbum
          ? "Existing album is now an editable gallery."
          : "Gallery event created.",
    };
  } catch (error) {
    return {
      status: "error",
      message:
        error instanceof Error
          ? error.message
          : "Gallery event could not be saved.",
    };
  }
}

export async function attachGalleryMedia(eventId: string, mediaIds: string[]) {
  const actor = await requirePermission("media.manage");
  const eventUuid = z.uuid().parse(eventId);
  const ids = z.array(z.uuid()).min(1).max(100).parse(mediaIds);
  const [event] = await getDb()
    .select({ id: galleryEvents.id, title: galleryEvents.title })
    .from(galleryEvents)
    .where(
      and(eq(galleryEvents.id, eventUuid), isNull(galleryEvents.archivedAt)),
    )
    .limit(1);
  if (!event) throw new Error("Choose an active gallery event.");
  await getDb()
    .update(mediaAssets)
    .set({
      galleryEventId: event.id,
      album: event.title,
      source: GALLERY_MEDIA_SOURCE,
      published: true,
      archivedAt: null,
      updatedAt: new Date(),
    })
    .where(and(inArray(mediaAssets.id, ids), isNull(mediaAssets.archivedAt)));
  await getDb()
    .insert(auditEvents)
    .values({
      actorMemberId: actor.id,
      action: "gallery.media_attached",
      entityType: "gallery_event",
      entityId: event.id,
      details: { mediaIds: ids },
    });
  revalidatePath("/admin");
  revalidatePath("/media");
  revalidatePath("/news");
  await revalidateNewsLinkedToGallery(event.id);
  return {
    status: "success" as const,
    message: `${ids.length} photo${ids.length === 1 ? "" : "s"} moved to ${event.title}.`,
  };
}

export async function deleteGalleryEvent(eventId: string) {
  const actor = await requirePermission("media.manage");
  const id = z.uuid().parse(eventId);
  const [event] = await getDb()
    .select({ id: galleryEvents.id, title: galleryEvents.title })
    .from(galleryEvents)
    .where(eq(galleryEvents.id, id))
    .limit(1);
  if (!event) throw new Error("Gallery event not found.");

  const linkedPosts = await getDb()
    .select({
      id: posts.id,
      slug: posts.slug,
      galleryEventId: posts.galleryEventId,
      galleryEventIds: posts.galleryEventIds,
    })
    .from(posts);
  for (const post of linkedPosts) {
    if (!post.galleryEventIds.includes(id)) continue;
    await getDb()
      .update(posts)
      .set({
        galleryEventIds: post.galleryEventIds.filter(
          (galleryId) => galleryId !== id,
        ),
        updatedAt: new Date(),
      })
      .where(eq(posts.id, post.id));
  }
  await getDb()
    .update(mediaAssets)
    .set({ galleryEventId: null, updatedAt: new Date() })
    .where(eq(mediaAssets.galleryEventId, id));
  await getDb().delete(galleryEvents).where(eq(galleryEvents.id, id));
  await getDb()
    .insert(auditEvents)
    .values({
      actorMemberId: actor.id,
      action: "gallery.event_deleted",
      entityType: "gallery_event",
      entityId: id,
      details: { title: event.title, photosPreserved: true },
    });
  revalidatePath("/admin");
  revalidatePath("/media");
  revalidatePath("/news");
  for (const post of linkedPosts) {
    if (post.galleryEventId === id || post.galleryEventIds.includes(id))
      revalidatePath(`/news/${post.slug}`);
  }
  revalidatePath("/", "layout");
  return {
    status: "success" as const,
    message: `Gallery “${event.title}” deleted. Its photos remain available under Unsorted photos.`,
  };
}

export async function archiveGalleryEvent(eventId: string) {
  const actor = await requirePermission("media.manage");
  const id = z.uuid().parse(eventId);
  const [event] = await getDb()
    .update(galleryEvents)
    .set({ archivedAt: new Date(), published: false, updatedAt: new Date() })
    .where(eq(galleryEvents.id, id))
    .returning({ title: galleryEvents.title });
  if (!event) throw new Error("Gallery event not found.");
  await getDb()
    .insert(auditEvents)
    .values({
      actorMemberId: actor.id,
      action: "gallery.event_archived",
      entityType: "gallery_event",
      entityId: id,
      details: { title: event.title },
    });
  revalidatePath("/admin");
  revalidatePath("/media");
  revalidatePath("/news");
  await revalidateNewsLinkedToGallery(id);
  return { status: "success" as const, message: "Gallery event archived." };
}

function revalidateRoster(page: "TEAM" | "VEX_U" | "SIDC" | "ROBOROWDY") {
  revalidatePath("/admin");
  revalidatePath(
    page === "TEAM"
      ? "/team"
      : page === "VEX_U"
        ? "/programs/vex-u"
        : page === "SIDC"
          ? "/programs/sidc"
          : "/projects/roborowdy",
  );
}

const rosterSchema = z.object({
  cardId: z.union([z.uuid(), z.literal("")]),
  page: z.enum(["TEAM", "VEX_U", "SIDC", "ROBOROWDY"]),
  section: z.string().trim().min(2).max(50),
  name: z.string().trim().min(2).max(120),
  title: z.string().trim().min(2).max(140),
  bio: z.string().trim().min(2).max(700),
  sortOrder: z.coerce.number().int().min(0).max(9999),
  published: z.string().optional(),
  photoMediaId: z.union([z.uuid(), z.literal("")]),
  removePhoto: z.string().optional(),
});

export async function saveRosterCard(
  _previousState: AdminFormState,
  formData: FormData,
): Promise<AdminFormState> {
  const actor = await requirePermission("directory.manage");
  const parsed = rosterSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success)
    return {
      status: "error",
      message: "Please correct the roster card fields.",
      errors: parsed.error.flatten().fieldErrors,
    };
  const data = parsed.data;
  if (data.photoMediaId) {
    const [owned] = await getDb()
      .select({ id: mediaAssets.id })
      .from(mediaAssets)
      .where(
        and(
          eq(mediaAssets.id, data.photoMediaId),
          eq(mediaAssets.uploadedByMemberId, actor.id),
        ),
      )
      .limit(1);
    if (!owned)
      return {
        status: "error",
        message: "The selected image could not be verified.",
      };
  }
  const existing = data.cardId
    ? (
        await getDb()
          .select()
          .from(publicProfileCards)
          .where(eq(publicProfileCards.id, data.cardId))
          .limit(1)
      )[0]
    : null;
  const changingPhoto = Boolean(data.photoMediaId) || data.removePhoto === "on";
  const values = {
    page: data.page,
    section: data.section,
    name: data.name,
    title: data.title,
    bio: data.bio,
    sortOrder: data.sortOrder,
    published: data.published === "on",
    ...(changingPhoto
      ? { photoMediaId: data.photoMediaId || null, photoUrl: null }
      : {}),
    archivedAt: null,
    updatedAt: new Date(),
  };
  let id: string;
  if (existing) {
    await getDb()
      .update(publicProfileCards)
      .set(values)
      .where(eq(publicProfileCards.id, existing.id));
    id = existing.id;
  } else {
    const [created] = await getDb()
      .insert(publicProfileCards)
      .values(values)
      .returning({ id: publicProfileCards.id });
    id = created.id;
  }
  await getDb()
    .insert(auditEvents)
    .values({
      actorMemberId: actor.id,
      action: existing ? "roster_card.updated" : "roster_card.created",
      entityType: "public_profile_card",
      entityId: id,
      details: { page: data.page, section: data.section },
    });
  revalidateRoster(data.page);
  if (existing && changingPhoto && existing.photoMediaId !== data.photoMediaId)
    await cleanupMediaIfUnused(existing.photoMediaId);
  return {
    status: "success",
    message: existing ? "Roster card saved." : "Roster card added.",
  };
}

export async function archiveRosterCard(formData: FormData) {
  const actor = await requirePermission("directory.manage");
  const id = z.uuid().parse(formData.get("cardId"));
  const [card] = await getDb()
    .select()
    .from(publicProfileCards)
    .where(eq(publicProfileCards.id, id))
    .limit(1);
  if (!card) return;
  await getDb()
    .update(publicProfileCards)
    .set({ archivedAt: new Date(), published: false, updatedAt: new Date() })
    .where(eq(publicProfileCards.id, id));
  await getDb().insert(auditEvents).values({
    actorMemberId: actor.id,
    action: "roster_card.archived",
    entityType: "public_profile_card",
    entityId: id,
  });
  revalidateRoster(card.page);
}

export async function restoreRosterCard(formData: FormData) {
  const actor = await requirePermission("directory.manage");
  const id = z.uuid().parse(formData.get("cardId"));
  const [card] = await getDb()
    .select()
    .from(publicProfileCards)
    .where(eq(publicProfileCards.id, id))
    .limit(1);
  if (!card) return;
  await getDb()
    .update(publicProfileCards)
    .set({ archivedAt: null, published: true, updatedAt: new Date() })
    .where(eq(publicProfileCards.id, id));
  await getDb().insert(auditEvents).values({
    actorMemberId: actor.id,
    action: "roster_card.restored",
    entityType: "public_profile_card",
    entityId: id,
  });
  revalidateRoster(card.page);
}

export async function assertAdmin() {
  return requireAdminAccess();
}
