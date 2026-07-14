import {
  boolean,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

export const memberStatus = pgEnum("member_status", ["PENDING", "ACTIVE", "SUSPENDED"]);
export const accessRole = pgEnum("access_role", [
  "MEMBER",
  "OFFICER",
  "CONTENT_ADMIN",
  "RECORDS_ADMIN",
  "FULL_ADMIN",
  "SUPER_ADMIN",
]);
export const postStatus = pgEnum("post_status", ["DRAFT", "PUBLISHED", "ARCHIVED"]);
export const inquiryKind = pgEnum("inquiry_kind", ["contact", "join", "sponsor"]);
export const inquiryStatus = pgEnum("inquiry_status", ["NEW", "IN_PROGRESS", "CLOSED", "SPAM"]);
export const deliveryStatus = pgEnum("delivery_status", ["PENDING", "SENT", "FAILED", "DELIVERED", "BOUNCED", "SUPPRESSED"]);

export const members = pgTable("members", {
  id: uuid("id").defaultRandom().primaryKey(),
  clerkUserId: text("clerk_user_id").notNull().unique(),
  email: text("email").notNull().unique(),
  displayName: text("display_name").notNull(),
  organizationRole: text("organization_role").notNull().default("Member"),
  bio: text("bio").notNull().default(""),
  photoUrl: text("photo_url"),
  status: memberStatus("status").notNull().default("PENDING"),
  accessRole: accessRole("access_role").notNull().default("MEMBER"),
  permissionOverrides: jsonb("permission_overrides").$type<{ allow: string[]; deny: string[] }>().notNull().default({ allow: [], deny: [] }),
  isPublic: boolean("is_public").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const projects = pgTable("projects", {
  id: uuid("id").defaultRandom().primaryKey(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  description: text("description").notNull().default(""),
  isPublic: boolean("is_public").notNull().default(true),
});

export const memberProjects = pgTable("member_projects", {
  memberId: uuid("member_id").notNull().references(() => members.id, { onDelete: "cascade" }),
  projectId: uuid("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  contribution: text("contribution").notNull().default("Contributor"),
}, (table) => [primaryKey({ columns: [table.memberId, table.projectId] })]);

export const hourEntries = pgTable("hour_entries", {
  id: uuid("id").defaultRandom().primaryKey(),
  memberId: uuid("member_id").references(() => members.id).notNull(),
  workDate: timestamp("work_date", { withTimezone: true }).notNull(),
  minutes: integer("minutes").notNull(),
  project: text("project").notNull(),
  category: text("category").notNull(),
  description: text("description").notNull(),
  eventId: text("event_id"),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [index("hour_member_date_idx").on(table.memberId, table.workDate)]);

export const contributions = pgTable("contributions", {
  id: uuid("id").defaultRandom().primaryKey(),
  memberId: uuid("member_id").references(() => members.id).notNull(),
  contributionDate: timestamp("contribution_date", { withTimezone: true }).notNull(),
  title: text("title").notNull(),
  project: text("project").notNull(),
  category: text("category").notNull(),
  description: text("description").notNull(),
  evidenceUrl: text("evidence_url"),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [index("contribution_member_date_idx").on(table.memberId, table.contributionDate)]);

export const mediaAssets = pgTable("media_assets", {
  id: uuid("id").defaultRandom().primaryKey(),
  driveFileId: text("drive_file_id").unique(),
  driveModifiedAt: timestamp("drive_modified_at", { withTimezone: true }),
  blobUrl: text("blob_url").notNull(),
  pathname: text("pathname").notNull().unique(),
  filename: text("filename").notNull(),
  mimeType: text("mime_type").notNull(),
  alt: text("alt").notNull().default("210 Robotics team photo"),
  caption: text("caption").notNull().default(""),
  album: text("album").notNull().default("Team photos"),
  width: integer("width"),
  height: integer("height"),
  bytes: integer("bytes"),
  published: boolean("published").notNull().default(true),
  archivedAt: timestamp("archived_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const posts = pgTable("posts", {
  id: uuid("id").defaultRandom().primaryKey(),
  slug: text("slug").notNull().unique(),
  title: text("title").notNull(),
  excerpt: text("excerpt").notNull(),
  bodyHtml: text("body_html").notNull(),
  coverMediaId: uuid("cover_media_id").references(() => mediaAssets.id, { onDelete: "set null" }),
  coverImageUrl: text("cover_image_url"),
  authorMemberId: uuid("author_member_id").references(() => members.id, { onDelete: "set null" }),
  status: postStatus("status").notNull().default("DRAFT"),
  publishedAt: timestamp("published_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [index("posts_status_published_idx").on(table.status, table.publishedAt)]);

export const postRevisions = pgTable("post_revisions", {
  id: uuid("id").defaultRandom().primaryKey(),
  postId: uuid("post_id").notNull().references(() => posts.id, { onDelete: "cascade" }),
  editorMemberId: uuid("editor_member_id").references(() => members.id, { onDelete: "set null" }),
  title: text("title").notNull(),
  excerpt: text("excerpt").notNull(),
  bodyHtml: text("body_html").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const resources = pgTable("resources", {
  id: uuid("id").defaultRandom().primaryKey(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  url: text("url").notNull(),
  category: text("category").notNull(),
  public: boolean("public").notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const inquiries = pgTable("inquiries", {
  id: uuid("id").defaultRandom().primaryKey(),
  kind: inquiryKind("kind").notNull(),
  status: inquiryStatus("status").notNull().default("NEW"),
  name: text("name").notNull(),
  email: text("email").notNull(),
  organization: text("organization"),
  interest: text("interest"),
  message: text("message").notNull(),
  sourcePath: text("source_path").notNull().default("/"),
  requestFingerprint: text("request_fingerprint").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [index("inquiries_created_idx").on(table.createdAt), index("inquiries_fingerprint_idx").on(table.requestFingerprint)]);

export const emailDeliveries = pgTable("email_deliveries", {
  id: uuid("id").defaultRandom().primaryKey(),
  inquiryId: uuid("inquiry_id").notNull().references(() => inquiries.id, { onDelete: "cascade" }),
  recipient: text("recipient").notNull(),
  providerId: text("provider_id"),
  status: deliveryStatus("status").notNull().default("PENDING"),
  attempts: integer("attempts").notNull().default(0),
  lastError: text("last_error"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [uniqueIndex("delivery_inquiry_recipient_idx").on(table.inquiryId, table.recipient)]);

export const calendarSnapshots = pgTable("calendar_snapshots", {
  id: text("id").primaryKey().default("shared"),
  events: jsonb("events").$type<Record<string, unknown>[]>().notNull().default([]),
  syncedAt: timestamp("synced_at", { withTimezone: true }).defaultNow().notNull(),
});

export const auditEvents = pgTable("audit_events", {
  id: uuid("id").defaultRandom().primaryKey(),
  actorMemberId: uuid("actor_member_id").references(() => members.id),
  action: text("action").notNull(),
  entityType: text("entity_type").notNull(),
  entityId: text("entity_id").notNull(),
  details: jsonb("details").$type<Record<string, unknown>>().notNull().default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [index("audit_created_idx").on(table.createdAt)]);
