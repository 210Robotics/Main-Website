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
import { sql } from "drizzle-orm";
import type { PublicFormAnswer, PublicFormField } from "@/lib/form-types";
import type { CustomPage } from "@/lib/custom-pages";

export const memberStatus = pgEnum("member_status", [
  "PENDING",
  "ACTIVE",
  "SUSPENDED",
]);
export const accessRole = pgEnum("access_role", [
  "MEMBER",
  "MENTOR",
  "LEAD",
  "OPERATIONS_LEAD",
  "ENGINEERING_MEMBER",
  "ENGINEERING_LEAD",
  "NOTEBOOK_EDITOR",
  "SCOUTING_LEAD",
  "LOGISTICS_LEAD",
  "FINANCE_LEAD",
  "OUTREACH_LEAD",
  "CONTENT_LEAD",
  "DIRECTOR",
  "OFFICER",
  "CONTENT_ADMIN",
  "RECORDS_ADMIN",
  "FULL_ADMIN",
  "SUPER_ADMIN",
]);
export const postStatus = pgEnum("post_status", [
  "DRAFT",
  "PUBLISHED",
  "ARCHIVED",
]);
export const inquiryKind = pgEnum("inquiry_kind", [
  "contact",
  "join",
  "sponsor",
]);
export const inquiryStatus = pgEnum("inquiry_status", [
  "NEW",
  "IN_PROGRESS",
  "CLOSED",
  "SPAM",
]);
export const deliveryStatus = pgEnum("delivery_status", [
  "PENDING",
  "SENT",
  "FAILED",
  "DELIVERED",
  "BOUNCED",
  "SUPPRESSED",
]);
export const rosterPage = pgEnum("roster_page", [
  "TEAM",
  "VEX_U",
  "SIDC",
  "ROBOROWDY",
]);
export const activityType = pgEnum("activity_type", [
  "EVENT",
  "WORKSHOP",
  "MEETING",
  "OUTREACH",
  "TRAINING",
]);
export const activityStatus = pgEnum("activity_status", [
  "SCHEDULED",
  "CANCELED",
  "COMPLETED",
]);
export const attendanceStatus = pgEnum("attendance_status", [
  "PRESENT",
  "VOID",
]);
export const docVisibility = pgEnum("doc_visibility", [
  "PUBLIC",
  "MEMBERS_ONLY",
]);
export const docStatus = pgEnum("doc_status", [
  "DRAFT",
  "PUBLISHED",
  "ARCHIVED",
]);
export const publicFormStatus = pgEnum("public_form_status", [
  "DRAFT",
  "OPEN",
  "CLOSED",
]);
export const availabilityPollStatus = pgEnum("availability_poll_status", [
  "DRAFT",
  "OPEN",
  "CLOSED",
]);

export const members = pgTable("members", {
  id: uuid("id").defaultRandom().primaryKey(),
  clerkUserId: text("clerk_user_id").notNull().unique(),
  email: text("email").notNull().unique(),
  normalizedUniversityEmail: text("normalized_university_email"),
  universityEmailVerifiedAt: timestamp("university_email_verified_at", {
    withTimezone: true,
  }),
  universityEmailOverrideAt: timestamp("university_email_override_at", {
    withTimezone: true,
  }),
  universityEmailOverrideByMemberId: uuid(
    "university_email_override_by_member_id",
  ),
  universityEmailOverrideReason: text("university_email_override_reason"),
  firstName: text("first_name").notNull().default(""),
  lastName: text("last_name").notNull().default(""),
  displayName: text("display_name").notNull(),
  academicLevel: text("academic_level"),
  major: text("major").notNull().default(""),
  expectedGraduationYear: integer("expected_graduation_year"),
  teamInterests: jsonb("team_interests")
    .$type<string[]>()
    .notNull()
    .default([]),
  profileCompletedAt: timestamp("profile_completed_at", {
    withTimezone: true,
  }),
  accessState: text("access_state").notNull().default("ACCOUNT_CREATED"),
  accessStateReason: text("access_state_reason").notNull().default(""),
  accessStateUpdatedAt: timestamp("access_state_updated_at", {
    withTimezone: true,
  })
    .defaultNow()
    .notNull(),
  membershipExpiresAt: timestamp("membership_expires_at", {
    withTimezone: true,
  }),
  gracePeriodEndsAt: timestamp("grace_period_ends_at", {
    withTimezone: true,
  }),
  nicknameSyncEnabled: boolean("nickname_sync_enabled")
    .notNull()
    .default(true),
  discordNicknameSyncedAt: timestamp("discord_nickname_synced_at", {
    withTimezone: true,
  }),
  organizationRole: text("organization_role").notNull().default("Member"),
  bio: text("bio").notNull().default(""),
  photoUrl: text("photo_url"),
  photoMediaId: uuid("photo_media_id"),
  status: memberStatus("status").notNull().default("PENDING"),
  accessRole: accessRole("access_role").notNull().default("MEMBER"),
  permissionOverrides: jsonb("permission_overrides")
    .$type<{ allow: string[]; deny: string[] }>()
    .notNull()
    .default({ allow: [], deny: [] }),
  isPublic: boolean("is_public").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
}, (table) => [
  uniqueIndex("member_verified_university_email_idx")
    .on(table.normalizedUniversityEmail)
    .where(sql`${table.normalizedUniversityEmail} is not null`),
  index("member_access_state_idx").on(table.accessState, table.status),
]);

export const projects = pgTable("projects", {
  id: uuid("id").defaultRandom().primaryKey(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  description: text("description").notNull().default(""),
  isPublic: boolean("is_public").notNull().default(true),
});

export const memberProjects = pgTable(
  "member_projects",
  {
    memberId: uuid("member_id")
      .notNull()
      .references(() => members.id, { onDelete: "cascade" }),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    contribution: text("contribution").notNull().default("Contributor"),
  },
  (table) => [primaryKey({ columns: [table.memberId, table.projectId] })],
);

export const hourEntries = pgTable(
  "hour_entries",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    memberId: uuid("member_id")
      .references(() => members.id, { onDelete: "cascade" })
      .notNull(),
    workDate: timestamp("work_date", { withTimezone: true }).notNull(),
    minutes: integer("minutes").notNull(),
    project: text("project").notNull(),
    category: text("category").notNull(),
    description: text("description").notNull(),
    eventId: text("event_id"),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [index("hour_member_date_idx").on(table.memberId, table.workDate)],
);

export const timeSessions = pgTable(
  "time_sessions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    memberId: uuid("member_id")
      .notNull()
      .references(() => members.id, { onDelete: "cascade" }),
    clockIn: timestamp("clock_in", { withTimezone: true })
      .defaultNow()
      .notNull(),
    clockOut: timestamp("clock_out", { withTimezone: true }),
    project: text("project").notNull(),
    category: text("category").notNull(),
    description: text("description").notNull(),
    hourEntryId: uuid("hour_entry_id").references(() => hourEntries.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("time_session_member_clock_idx").on(table.memberId, table.clockIn),
    uniqueIndex("time_session_one_active_member_idx")
      .on(table.memberId)
      .where(sql`${table.clockOut} is null`),
  ],
);

export const contributions = pgTable(
  "contributions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    memberId: uuid("member_id")
      .references(() => members.id, { onDelete: "cascade" })
      .notNull(),
    contributionDate: timestamp("contribution_date", {
      withTimezone: true,
    }).notNull(),
    title: text("title").notNull(),
    project: text("project").notNull(),
    category: text("category").notNull(),
    description: text("description").notNull(),
    evidenceUrl: text("evidence_url"),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("contribution_member_date_idx").on(
      table.memberId,
      table.contributionDate,
    ),
  ],
);

export const teamActivities = pgTable(
  "team_activities",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    slug: text("slug").notNull().unique(),
    title: text("title").notNull(),
    description: text("description").notNull().default(""),
    type: activityType("type").notNull(),
    topic: text("topic"),
    location: text("location").notNull().default(""),
    startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
    endsAt: timestamp("ends_at", { withTimezone: true }).notNull(),
    isPublic: boolean("is_public").notNull().default(false),
    status: activityStatus("status").notNull().default("SCHEDULED"),
    attendanceOpenedAt: timestamp("attendance_opened_at", {
      withTimezone: true,
    }),
    attendanceClosesAt: timestamp("attendance_closes_at", {
      withTimezone: true,
    }),
    createdByMemberId: uuid("created_by_member_id").references(
      () => members.id,
      {
        onDelete: "set null",
      },
    ),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("team_activity_start_idx").on(table.startsAt),
    index("team_activity_public_idx").on(table.isPublic, table.status),
  ],
);

export const attendanceTokens = pgTable(
  "attendance_tokens",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    activityId: uuid("activity_id")
      .notNull()
      .references(() => teamActivities.id, { onDelete: "cascade" }),
    tokenHash: text("token_hash").notNull().unique(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdByMemberId: uuid("created_by_member_id").references(
      () => members.id,
      {
        onDelete: "set null",
      },
    ),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("attendance_token_activity_idx").on(
      table.activityId,
      table.createdAt,
    ),
  ],
);

export const activityAttendance = pgTable(
  "activity_attendance",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    activityId: uuid("activity_id")
      .notNull()
      .references(() => teamActivities.id, { onDelete: "cascade" }),
    memberId: uuid("member_id")
      .notNull()
      .references(() => members.id, { onDelete: "cascade" }),
    status: attendanceStatus("status").notNull().default("PRESENT"),
    method: text("method").notNull().default("QR_LINK"),
    checkedInAt: timestamp("checked_in_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    recordedByMemberId: uuid("recorded_by_member_id").references(
      () => members.id,
      {
        onDelete: "set null",
      },
    ),
    note: text("note").notNull().default(""),
    voidedAt: timestamp("voided_at", { withTimezone: true }),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("activity_attendance_member_idx").on(
      table.activityId,
      table.memberId,
    ),
    index("member_attendance_history_idx").on(
      table.memberId,
      table.checkedInAt,
    ),
  ],
);

export const docCategories = pgTable(
  "doc_categories",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    parentId: uuid("parent_id"),
    slug: text("slug").notNull().unique(),
    title: text("title").notNull(),
    description: text("description").notNull().default(""),
    sortOrder: integer("sort_order").notNull().default(0),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("doc_category_order_idx").on(table.parentId, table.sortOrder),
  ],
);

export const docPages = pgTable(
  "doc_pages",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    categoryId: uuid("category_id")
      .notNull()
      .references(() => docCategories.id, { onDelete: "cascade" }),
    slug: text("slug").notNull(),
    path: text("path").notNull().unique(),
    title: text("title").notNull(),
    summary: text("summary").notNull().default(""),
    bodyJson: jsonb("body_json")
      .$type<Record<string, unknown>>()
      .notNull()
      .default({ type: "doc", content: [] }),
    bodyHtml: text("body_html").notNull().default("<p></p>"),
    searchText: text("search_text").notNull().default(""),
    visibility: docVisibility("visibility").notNull().default("PUBLIC"),
    status: docStatus("status").notNull().default("DRAFT"),
    sortOrder: integer("sort_order").notNull().default(0),
    authorMemberId: uuid("author_member_id").references(() => members.id, {
      onDelete: "set null",
    }),
    lastEditorMemberId: uuid("last_editor_member_id").references(
      () => members.id,
      { onDelete: "set null" },
    ),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("doc_page_category_slug_idx").on(table.categoryId, table.slug),
    index("doc_page_visibility_status_idx").on(table.visibility, table.status),
    index("doc_page_category_order_idx").on(table.categoryId, table.sortOrder),
  ],
);

export const docRevisions = pgTable(
  "doc_revisions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    pageId: uuid("page_id")
      .notNull()
      .references(() => docPages.id, { onDelete: "cascade" }),
    editorMemberId: uuid("editor_member_id").references(() => members.id, {
      onDelete: "set null",
    }),
    title: text("title").notNull(),
    summary: text("summary").notNull(),
    bodyJson: jsonb("body_json").$type<Record<string, unknown>>().notNull(),
    bodyHtml: text("body_html").notNull(),
    visibility: docVisibility("visibility").notNull(),
    status: docStatus("status").notNull(),
    reason: text("reason").notNull().default("autosave"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("doc_revision_page_created_idx").on(table.pageId, table.createdAt),
  ],
);

export const docEditorLocks = pgTable("doc_editor_locks", {
  pageId: uuid("page_id")
    .primaryKey()
    .references(() => docPages.id, { onDelete: "cascade" }),
  memberId: uuid("member_id")
    .notNull()
    .references(() => members.id, { onDelete: "cascade" }),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export type InternalDocumentAsset = {
  pathname: string;
  filename: string;
  mimeType: string;
  bytes: number;
};

export const internalDocuments = pgTable(
  "internal_documents",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    title: text("title").notNull(),
    description: text("description").notNull().default(""),
    category: text("category").notNull().default("General"),
    originalFilename: text("original_filename").notNull(),
    mimeType: text("mime_type").notNull(),
    bytes: integer("bytes").notNull().default(0),
    pathname: text("pathname").notNull().unique(),
    contentHtml: text("content_html").notNull().default("<p></p>"),
    editable: boolean("editable").notNull().default(false),
    embeddedAssets: jsonb("embedded_assets")
      .$type<InternalDocumentAsset[]>()
      .notNull()
      .default([]),
    storageProvider: text("storage_provider").notNull().default("BLOB"),
    driveFileId: text("drive_file_id").unique(),
    driveWebViewLink: text("drive_web_view_link"),
    driveModifiedAt: timestamp("drive_modified_at", { withTimezone: true }),
    driveSyncStatus: text("drive_sync_status").notNull().default("LOCAL_ONLY"),
    currentVersion: integer("current_version").notNull().default(1),
    createdByMemberId: uuid("created_by_member_id").references(
      () => members.id,
      { onDelete: "set null" },
    ),
    updatedByMemberId: uuid("updated_by_member_id").references(
      () => members.id,
      { onDelete: "set null" },
    ),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("internal_document_category_updated_idx").on(
      table.category,
      table.updatedAt,
    ),
    index("internal_document_drive_status_idx").on(
      table.driveSyncStatus,
      table.updatedAt,
    ),
  ],
);

export const internalDocumentRevisions = pgTable(
  "internal_document_revisions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    documentId: uuid("document_id")
      .notNull()
      .references(() => internalDocuments.id, { onDelete: "cascade" }),
    versionNumber: integer("version_number").notNull(),
    title: text("title").notNull(),
    description: text("description").notNull().default(""),
    category: text("category").notNull().default("General"),
    contentHtml: text("content_html").notNull(),
    reason: text("reason").notNull().default("Saved in document studio"),
    editorMemberId: uuid("editor_member_id").references(() => members.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("internal_document_revision_number_idx").on(
      table.documentId,
      table.versionNumber,
    ),
  ],
);

export const publicForms = pgTable(
  "public_forms",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    accessKey: text("access_key").notNull().unique(),
    title: text("title").notNull(),
    descriptionHtml: text("description_html").notNull().default("<p></p>"),
    confirmationMessage: text("confirmation_message")
      .notNull()
      .default("Thanks! Your response has been recorded."),
    fields: jsonb("fields").$type<PublicFormField[]>().notNull().default([]),
    status: publicFormStatus("status").notNull().default("DRAFT"),
    responseCount: integer("response_count").notNull().default(0),
    createdByMemberId: uuid("created_by_member_id").references(
      () => members.id,
      {
        onDelete: "set null",
      },
    ),
    lastEditorMemberId: uuid("last_editor_member_id").references(
      () => members.id,
      {
        onDelete: "set null",
      },
    ),
    openedAt: timestamp("opened_at", { withTimezone: true }),
    closedAt: timestamp("closed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("public_forms_status_updated_idx").on(table.status, table.updatedAt),
  ],
);

export const publicFormResponses = pgTable(
  "public_form_responses",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    formId: uuid("form_id")
      .notNull()
      .references(() => publicForms.id, { onDelete: "cascade" }),
    answers: jsonb("answers").$type<PublicFormAnswer[]>().notNull(),
    respondentName: text("respondent_name").notNull().default("Anonymous"),
    respondentEmail: text("respondent_email").notNull().default(""),
    submittedByMemberId: uuid("submitted_by_member_id").references(
      () => members.id,
      {
        onDelete: "set null",
      },
    ),
    requestFingerprint: text("request_fingerprint").notNull(),
    submittedAt: timestamp("submitted_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("public_form_response_form_date_idx").on(
      table.formId,
      table.submittedAt,
    ),
    index("public_form_response_rate_idx").on(
      table.formId,
      table.requestFingerprint,
      table.submittedAt,
    ),
  ],
);

export const publicFormUploads = pgTable(
  "public_form_uploads",
  {
    id: uuid("id").primaryKey(),
    formId: uuid("form_id")
      .notNull()
      .references(() => publicForms.id, { onDelete: "cascade" }),
    fieldId: text("field_id").notNull(),
    responseId: uuid("response_id").references(() => publicFormResponses.id, {
      onDelete: "cascade",
    }),
    blobUrl: text("blob_url"),
    pathname: text("pathname").notNull().unique(),
    filename: text("filename").notNull(),
    mimeType: text("mime_type").notNull(),
    bytes: integer("bytes").notNull(),
    requestFingerprint: text("request_fingerprint").notNull(),
    claimedAt: timestamp("claimed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("public_form_upload_form_field_idx").on(table.formId, table.fieldId),
    index("public_form_upload_response_idx").on(table.responseId),
    index("public_form_upload_rate_idx").on(
      table.formId,
      table.requestFingerprint,
      table.createdAt,
    ),
  ],
);

export const availabilityPolls = pgTable(
  "availability_polls",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    accessKey: text("access_key").notNull().unique(),
    title: text("title").notNull(),
    description: text("description").notNull().default(""),
    timezone: text("timezone").notNull().default("America/Chicago"),
    dates: jsonb("dates").$type<string[]>().notNull().default([]),
    startTime: text("start_time").notNull().default("18:00"),
    endTime: text("end_time").notNull().default("21:00"),
    slotMinutes: integer("slot_minutes").notNull().default(30),
    status: availabilityPollStatus("status").notNull().default("DRAFT"),
    responseCount: integer("response_count").notNull().default(0),
    createdByMemberId: uuid("created_by_member_id").references(
      () => members.id,
      { onDelete: "set null" },
    ),
    lastEditorMemberId: uuid("last_editor_member_id").references(
      () => members.id,
      { onDelete: "set null" },
    ),
    openedAt: timestamp("opened_at", { withTimezone: true }),
    closedAt: timestamp("closed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("availability_poll_status_updated_idx").on(
      table.status,
      table.updatedAt,
    ),
  ],
);

export const availabilityPollResponses = pgTable(
  "availability_poll_responses",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    pollId: uuid("poll_id")
      .notNull()
      .references(() => availabilityPolls.id, { onDelete: "cascade" }),
    participantKey: uuid("participant_key").notNull(),
    name: text("name").notNull(),
    email: text("email").notNull().default(""),
    availableSlots: jsonb("available_slots")
      .$type<string[]>()
      .notNull()
      .default([]),
    submittedByMemberId: uuid("submitted_by_member_id").references(
      () => members.id,
      { onDelete: "set null" },
    ),
    requestFingerprint: text("request_fingerprint").notNull(),
    submittedAt: timestamp("submitted_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("availability_poll_participant_idx").on(
      table.pollId,
      table.participantKey,
    ),
    index("availability_poll_response_date_idx").on(
      table.pollId,
      table.updatedAt,
    ),
    index("availability_poll_response_rate_idx").on(
      table.pollId,
      table.requestFingerprint,
      table.updatedAt,
    ),
  ],
);

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
  galleryEventId: uuid("gallery_event_id"),
  width: integer("width"),
  height: integer("height"),
  bytes: integer("bytes"),
  source: text("source").notNull().default("drive"),
  uploadedByMemberId: uuid("uploaded_by_member_id"),
  published: boolean("published").notNull().default(true),
  archivedAt: timestamp("archived_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const galleryEvents = pgTable(
  "gallery_events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    slug: text("slug").notNull().unique(),
    title: text("title").notNull(),
    description: text("description").notNull().default(""),
    eventDate: timestamp("event_date", { withTimezone: true }),
    driveFolderId: text("drive_folder_id").unique(),
    published: boolean("published").notNull().default(true),
    sortOrder: integer("sort_order").notNull().default(0),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("gallery_event_published_order_idx").on(
      table.published,
      table.sortOrder,
      table.eventDate,
    ),
  ],
);

export const publicProfileCards = pgTable(
  "public_profile_cards",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    legacyKey: text("legacy_key").unique(),
    page: rosterPage("page").notNull(),
    section: text("section").notNull().default("people"),
    name: text("name").notNull(),
    title: text("title").notNull(),
    bio: text("bio").notNull().default(""),
    photoUrl: text("photo_url"),
    photoMediaId: uuid("photo_media_id").references(() => mediaAssets.id, {
      onDelete: "set null",
    }),
    sortOrder: integer("sort_order").notNull().default(0),
    published: boolean("published").notNull().default(true),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("profile_cards_page_section_order_idx").on(
      table.page,
      table.section,
      table.sortOrder,
    ),
  ],
);

export const sponsors = pgTable(
  "sponsors",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    name: text("name").notNull(),
    sponsorship: text("sponsorship").notNull(),
    tier: text("tier").notNull().default("Partner"),
    websiteUrl: text("website_url"),
    logoUrl: text("logo_url"),
    logoMediaId: uuid("logo_media_id").references(() => mediaAssets.id, {
      onDelete: "set null",
    }),
    sortOrder: integer("sort_order").notNull().default(0),
    published: boolean("published").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("sponsors_published_order_idx").on(table.published, table.sortOrder),
  ],
);

export const posts = pgTable(
  "posts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    slug: text("slug").notNull().unique(),
    title: text("title").notNull(),
    excerpt: text("excerpt").notNull(),
    bodyHtml: text("body_html").notNull(),
    coverMediaId: uuid("cover_media_id").references(() => mediaAssets.id, {
      onDelete: "set null",
    }),
    coverImageUrl: text("cover_image_url"),
    galleryEventId: uuid("gallery_event_id").references(() => galleryEvents.id, {
      onDelete: "set null",
    }),
    galleryEventIds: jsonb("gallery_event_ids")
      .$type<string[]>()
      .notNull()
      .default([]),
    embedUrls: jsonb("embed_urls")
      .$type<string[]>()
      .notNull()
      .default([]),
    authorMemberId: uuid("author_member_id").references(() => members.id, {
      onDelete: "set null",
    }),
    status: postStatus("status").notNull().default("DRAFT"),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("posts_status_published_idx").on(table.status, table.publishedAt),
  ],
);

export const postRevisions = pgTable("post_revisions", {
  id: uuid("id").defaultRandom().primaryKey(),
  postId: uuid("post_id")
    .notNull()
    .references(() => posts.id, { onDelete: "cascade" }),
  editorMemberId: uuid("editor_member_id").references(() => members.id, {
    onDelete: "set null",
  }),
  title: text("title").notNull(),
  excerpt: text("excerpt").notNull(),
  bodyHtml: text("body_html").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const resources = pgTable("resources", {
  id: uuid("id").defaultRandom().primaryKey(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  url: text("url").notNull(),
  category: text("category").notNull(),
  public: boolean("public").notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const inquiries = pgTable(
  "inquiries",
  {
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
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("inquiries_created_idx").on(table.createdAt),
    index("inquiries_fingerprint_idx").on(table.requestFingerprint),
  ],
);

export const emailDeliveries = pgTable(
  "email_deliveries",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    inquiryId: uuid("inquiry_id")
      .notNull()
      .references(() => inquiries.id, { onDelete: "cascade" }),
    recipient: text("recipient").notNull(),
    providerId: text("provider_id"),
    status: deliveryStatus("status").notNull().default("PENDING"),
    attempts: integer("attempts").notNull().default(0),
    lastError: text("last_error"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("delivery_inquiry_recipient_idx").on(
      table.inquiryId,
      table.recipient,
    ),
  ],
);

export const calendarSnapshots = pgTable("calendar_snapshots", {
  id: text("id").primaryKey().default("shared"),
  events: jsonb("events")
    .$type<Record<string, unknown>[]>()
    .notNull()
    .default([]),
  syncedAt: timestamp("synced_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const publicSettings = pgTable("public_settings", {
  id: text("id").primaryKey().default("site"),
  memberCountOverrideEnabled: boolean("member_count_override_enabled")
    .notNull()
    .default(false),
  memberCountOverride: integer("member_count_override"),
  pageContent: jsonb("page_content")
    .$type<Record<string, string>>()
    .notNull()
    .default({}),
  customPages: jsonb("custom_pages")
    .$type<CustomPage[]>()
    .notNull()
    .default([]),
  constitutionDocumentId: uuid("constitution_document_id").references(
    () => internalDocuments.id,
    { onDelete: "set null" },
  ),
  constitutionVersion: text("constitution_version"),
  constitutionEffectiveDate: timestamp("constitution_effective_date", {
    withTimezone: true,
  }),
  constitutionPublishedAt: timestamp("constitution_published_at", {
    withTimezone: true,
  }),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const auditEvents = pgTable(
  "audit_events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    actorMemberId: uuid("actor_member_id").references(() => members.id, {
      onDelete: "set null",
    }),
    action: text("action").notNull(),
    entityType: text("entity_type").notNull(),
    entityId: text("entity_id").notNull(),
    details: jsonb("details")
      .$type<Record<string, unknown>>()
      .notNull()
      .default({}),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [index("audit_created_idx").on(table.createdAt)],
);

export const syncJobRuns = pgTable(
  "sync_job_runs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    job: text("job").notNull(),
    status: text("status").notNull().default("RUNNING"),
    source: text("source").notNull().default("SCHEDULED"),
    attemptedAt: timestamp("attempted_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    durationMs: integer("duration_ms"),
    recordsChanged: integer("records_changed").notNull().default(0),
    error: text("error"),
    details: jsonb("details")
      .$type<Record<string, unknown>>()
      .notNull()
      .default({}),
  },
  (table) => [
    index("sync_job_status_attempt_idx").on(
      table.job,
      table.status,
      table.attemptedAt,
    ),
  ],
);

export const engineeringSeasons = pgTable(
  "engineering_seasons",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    name: text("name").notNull(),
    competition: text("competition").notNull().default("VEX U"),
    gameName: text("game_name").notNull().default("Override"),
    gameManualVersion: text("game_manual_version").notNull().default("1.0"),
    status: text("status").notNull().default("ACTIVE"),
    startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
    endsAt: timestamp("ends_at", { withTimezone: true }).notNull(),
    isDefault: boolean("is_default").notNull().default(false),
    createdByMemberId: uuid("created_by_member_id").references(
      () => members.id,
      { onDelete: "set null" },
    ),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("engineering_season_name_idx").on(table.name),
    index("engineering_season_status_idx").on(table.status, table.startsAt),
  ],
);

export const engineeringProjects = pgTable(
  "engineering_projects",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    seasonId: uuid("season_id")
      .notNull()
      .references(() => engineeringSeasons.id, { onDelete: "cascade" }),
    code: text("code").notNull(),
    name: text("name").notNull(),
    description: text("description").notNull().default(""),
    status: text("status").notNull().default("ACTIVE"),
    leadMemberId: uuid("lead_member_id").references(() => members.id, {
      onDelete: "set null",
    }),
    startsAt: timestamp("starts_at", { withTimezone: true }),
    dueAt: timestamp("due_at", { withTimezone: true }),
    createdByMemberId: uuid("created_by_member_id").references(
      () => members.id,
      { onDelete: "set null" },
    ),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("engineering_project_season_code_idx").on(
      table.seasonId,
      table.code,
    ),
    index("engineering_project_status_idx").on(table.seasonId, table.status),
  ],
);

export const engineeringSubsystems = pgTable(
  "engineering_subsystems",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => engineeringProjects.id, { onDelete: "cascade" }),
    code: text("code").notNull(),
    name: text("name").notNull(),
    description: text("description").notNull().default(""),
    status: text("status").notNull().default("ACTIVE"),
    leadMemberId: uuid("lead_member_id").references(() => members.id, {
      onDelete: "set null",
    }),
    createdByMemberId: uuid("created_by_member_id").references(
      () => members.id,
      { onDelete: "set null" },
    ),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("engineering_subsystem_project_code_idx").on(
      table.projectId,
      table.code,
    ),
  ],
);

export const financePlans = pgTable(
  "finance_plans",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    seasonId: uuid("season_id").references(() => engineeringSeasons.id, {
      onDelete: "set null",
    }),
    engineeringProjectId: uuid("engineering_project_id").references(
      () => engineeringProjects.id,
      { onDelete: "set null" },
    ),
    name: text("name").notNull(),
    fiscalYear: integer("fiscal_year").notNull(),
    project: text("project").notNull().default("Organization"),
    status: text("status").notNull().default("DRAFT"),
    minimumBudgetCents: integer("minimum_budget_cents").notNull().default(0),
    maximumBudgetCents: integer("maximum_budget_cents").notNull().default(0),
    notes: text("notes").notNull().default(""),
    createdByMemberId: uuid("created_by_member_id").references(
      () => members.id,
      { onDelete: "set null" },
    ),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("finance_plan_year_status_idx").on(table.fiscalYear, table.status),
  ],
);

export const financeEntries = pgTable(
  "finance_entries",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    planId: uuid("plan_id").references(() => financePlans.id, {
      onDelete: "set null",
    }),
    subsystemId: uuid("subsystem_id").references(
      () => engineeringSubsystems.id,
      { onDelete: "set null" },
    ),
    kind: text("kind").notNull().default("EXPENSE"),
    category: text("category").notNull().default("General"),
    description: text("description").notNull(),
    vendor: text("vendor").notNull().default(""),
    quantity: integer("quantity").notNull().default(1),
    unitCostCents: integer("unit_cost_cents").notNull().default(0),
    amountCents: integer("amount_cents").notNull().default(0),
    status: text("status").notNull().default("PLANNED"),
    occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull(),
    receiptUrl: text("receipt_url"),
    notes: text("notes").notNull().default(""),
    createdByMemberId: uuid("created_by_member_id").references(
      () => members.id,
      { onDelete: "set null" },
    ),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("finance_entry_plan_date_idx").on(table.planId, table.occurredAt),
    index("finance_entry_kind_status_idx").on(table.kind, table.status),
  ],
);

export const financeSponsorCommitments = pgTable(
  "finance_sponsor_commitments",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    planId: uuid("plan_id").references(() => financePlans.id, {
      onDelete: "cascade",
    }),
    sponsorName: text("sponsor_name").notNull(),
    tier: text("tier").notNull().default("Partner"),
    amountCents: integer("amount_cents").notNull(),
    status: text("status").notNull().default("PLEDGED"),
    contactName: text("contact_name").notNull().default(""),
    contactEmail: text("contact_email").notNull().default(""),
    receivedAt: timestamp("received_at", { withTimezone: true }),
    restrictions: text("restrictions").notNull().default(""),
    createdByMemberId: uuid("created_by_member_id").references(
      () => members.id,
      { onDelete: "set null" },
    ),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("finance_sponsor_plan_status_idx").on(table.planId, table.status),
  ],
);

export const donationCampaignSettings = pgTable("donation_campaign_settings", {
  id: text("id").primaryKey().default("primary"),
  title: text("title").notNull().default("Power the next build."),
  description: text("description")
    .notNull()
    .default(
      "Help 210 Robotics fund competition travel, robot parts, tools, and student-led engineering.",
    ),
  goalCents: integer("goal_cents").notNull().default(1000000),
  suggestedAmountsCents: jsonb("suggested_amounts_cents")
    .$type<number[]>()
    .notNull()
    .default(sql`'[100, 500, 1000, 2500, 5000, 10000, 21000, 50000]'::jsonb`),
  isActive: boolean("is_active").notNull().default(true),
  updatedByMemberId: uuid("updated_by_member_id").references(
    () => members.id,
    { onDelete: "set null" },
  ),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const donations = pgTable(
  "donations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    campaignId: text("campaign_id")
      .notNull()
      .default("primary")
      .references(() => donationCampaignSettings.id, { onDelete: "restrict" }),
    stripeCheckoutSessionId: text("stripe_checkout_session_id").notNull(),
    stripePaymentIntentId: text("stripe_payment_intent_id"),
    amountCents: integer("amount_cents").notNull(),
    refundedCents: integer("refunded_cents").notNull().default(0),
    currency: text("currency").notNull().default("usd"),
    status: text("status").notNull().default("PENDING"),
    donorName: text("donor_name"),
    donorEmail: text("donor_email"),
    donorMessage: text("donor_message"),
    attributedMemberId: uuid("attributed_member_id").references(
      () => members.id,
      { onDelete: "set null" },
    ),
    club210ShirtSize: text("club_210_shirt_size"),
    paidAt: timestamp("paid_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("donation_checkout_session_idx").on(
      table.stripeCheckoutSessionId,
    ),
    uniqueIndex("donation_payment_intent_idx").on(
      table.stripePaymentIntentId,
    ),
    index("donation_campaign_status_paid_idx").on(
      table.campaignId,
      table.status,
      table.paidAt,
    ),
    index("donation_attributed_member_idx").on(
      table.attributedMemberId,
      table.paidAt,
    ),
  ],
);

export const meetingNotes = pgTable(
  "meeting_notes",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    activityId: uuid("activity_id").references(() => teamActivities.id, {
      onDelete: "set null",
    }),
    title: text("title").notNull(),
    heldAt: timestamp("held_at", { withTimezone: true }).notNull(),
    location: text("location").notNull().default(""),
    facilitator: text("facilitator").notNull().default(""),
    agenda: text("agenda").notNull().default(""),
    discussion: text("discussion").notNull().default(""),
    summary: text("summary").notNull().default(""),
    nextMeeting: text("next_meeting").notNull().default(""),
    status: text("status").notNull().default("DRAFT"),
    createdByMemberId: uuid("created_by_member_id").references(
      () => members.id,
      { onDelete: "set null" },
    ),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("meeting_notes_activity_idx").on(table.activityId),
    index("meeting_notes_date_status_idx").on(table.heldAt, table.status),
  ],
);

export const meetingDecisions = pgTable(
  "meeting_decisions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    meetingId: uuid("meeting_id")
      .notNull()
      .references(() => meetingNotes.id, { onDelete: "cascade" }),
    decision: text("decision").notNull(),
    rationale: text("rationale").notNull().default(""),
    impact: text("impact").notNull().default(""),
    createdByMemberId: uuid("created_by_member_id").references(
      () => members.id,
      { onDelete: "set null" },
    ),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [index("meeting_decision_meeting_idx").on(table.meetingId)],
);

export const memberTasks = pgTable(
  "member_tasks",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    meetingId: uuid("meeting_id").references(() => meetingNotes.id, {
      onDelete: "set null",
    }),
    engineeringProjectId: uuid("engineering_project_id").references(
      () => engineeringProjects.id,
      { onDelete: "set null" },
    ),
    subsystemId: uuid("subsystem_id").references(
      () => engineeringSubsystems.id,
      { onDelete: "set null" },
    ),
    assignedToMemberId: uuid("assigned_to_member_id")
      .notNull()
      .references(() => members.id, { onDelete: "cascade" }),
    createdByMemberId: uuid("created_by_member_id").references(
      () => members.id,
      { onDelete: "set null" },
    ),
    title: text("title").notNull(),
    description: text("description").notNull().default(""),
    project: text("project").notNull().default("Organization"),
    priority: text("priority").notNull().default("NORMAL"),
    status: text("status").notNull().default("TODO"),
    dueAt: timestamp("due_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    completionRequestedAt: timestamp("completion_requested_at", {
      withTimezone: true,
    }),
    completionRequestedByMemberId: uuid(
      "completion_requested_by_member_id",
    ).references(() => members.id, { onDelete: "set null" }),
    approvedAt: timestamp("approved_at", { withTimezone: true }),
    approvedByMemberId: uuid("approved_by_member_id").references(
      () => members.id,
      { onDelete: "set null" },
    ),
    approvalNote: text("approval_note").notNull().default(""),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("member_task_assignee_status_idx").on(
      table.assignedToMemberId,
      table.status,
    ),
    index("member_task_due_idx").on(table.dueAt),
    index("member_task_meeting_idx").on(table.meetingId),
  ],
);

export const taskComments = pgTable(
  "task_comments",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    taskId: uuid("task_id")
      .notNull()
      .references(() => memberTasks.id, { onDelete: "cascade" }),
    memberId: uuid("member_id")
      .notNull()
      .references(() => members.id, { onDelete: "cascade" }),
    body: text("body").notNull().default(""),
    isDeliverable: boolean("is_deliverable").notNull().default(false),
    attachmentUrl: text("attachment_url"),
    attachmentPathname: text("attachment_pathname"),
    attachmentName: text("attachment_name"),
    attachmentMimeType: text("attachment_mime_type"),
    attachmentBytes: integer("attachment_bytes"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("task_comment_task_date_idx").on(table.taskId, table.createdAt),
  ],
);

export const glossaryTerms = pgTable(
  "glossary_terms",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    term: text("term").notNull().unique(),
    acronym: text("acronym").notNull().default(""),
    category: text("category").notNull().default("General"),
    definition: text("definition").notNull(),
    usage: text("usage").notNull().default(""),
    ownerRole: text("owner_role").notNull().default(""),
    relatedTerms: jsonb("related_terms")
      .$type<string[]>()
      .notNull()
      .default([]),
    published: boolean("published").notNull().default(true),
    createdByMemberId: uuid("created_by_member_id").references(
      () => members.id,
      { onDelete: "set null" },
    ),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("glossary_category_term_idx").on(table.category, table.term),
  ],
);

export const engineeringParts = pgTable(
  "engineering_parts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    seasonId: uuid("season_id").references(() => engineeringSeasons.id, {
      onDelete: "set null",
    }),
    engineeringProjectId: uuid("engineering_project_id").references(
      () => engineeringProjects.id,
      { onDelete: "set null" },
    ),
    subsystemId: uuid("subsystem_id").references(
      () => engineeringSubsystems.id,
      { onDelete: "set null" },
    ),
    project: text("project").notNull(),
    partNumber: text("part_number").notNull(),
    name: text("name").notNull(),
    description: text("description").notNull().default(""),
    subsystem: text("subsystem").notNull().default("General"),
    revision: text("revision").notNull().default("A"),
    quantity: integer("quantity").notNull().default(1),
    makeBuy: text("make_buy").notNull().default("MAKE"),
    material: text("material").notNull().default(""),
    stockSize: text("stock_size").notNull().default(""),
    manufacturingMethod: text("manufacturing_method").notNull().default(""),
    supplier: text("supplier").notNull().default(""),
    unitCostCents: integer("unit_cost_cents").notNull().default(0),
    leadTimeDays: integer("lead_time_days").notNull().default(0),
    cadStatus: text("cad_status").notNull().default("NOT_STARTED"),
    camStatus: text("cam_status").notNull().default("NOT_STARTED"),
    caeStatus: text("cae_status").notNull().default("NOT_REQUIRED"),
    drawingStatus: text("drawing_status").notNull().default("NOT_STARTED"),
    verificationStatus: text("verification_status")
      .notNull()
      .default("PENDING"),
    lifecycleStatus: text("lifecycle_status").notNull().default("DESIGN"),
    cadUrl: text("cad_url"),
    drawingUrl: text("drawing_url"),
    sourceUrl: text("source_url"),
    assignedToMemberId: uuid("assigned_to_member_id").references(
      () => members.id,
      { onDelete: "set null" },
    ),
    dueAt: timestamp("due_at", { withTimezone: true }),
    notes: text("notes").notNull().default(""),
    createdByMemberId: uuid("created_by_member_id").references(
      () => members.id,
      { onDelete: "set null" },
    ),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("engineering_part_project_number_idx").on(
      table.project,
      table.partNumber,
    ),
    index("engineering_part_project_subsystem_idx").on(
      table.project,
      table.subsystem,
    ),
    index("engineering_part_verification_idx").on(
      table.verificationStatus,
      table.lifecycleStatus,
    ),
  ],
);

export const manufacturingSteps = pgTable(
  "manufacturing_steps",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    partId: uuid("part_id")
      .notNull()
      .references(() => engineeringParts.id, { onDelete: "cascade" }),
    sequence: integer("sequence").notNull().default(10),
    process: text("process").notNull(),
    machine: text("machine").notNull().default(""),
    setup: text("setup").notNull().default(""),
    instructions: text("instructions").notNull().default(""),
    inspectionCriteria: text("inspection_criteria").notNull().default(""),
    status: text("status").notNull().default("NOT_STARTED"),
    assignedToMemberId: uuid("assigned_to_member_id").references(
      () => members.id,
      { onDelete: "set null" },
    ),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("manufacturing_step_part_sequence_idx").on(
      table.partId,
      table.sequence,
    ),
    index("manufacturing_step_status_idx").on(table.status),
  ],
);

export const engineeringNotebookEntries = pgTable(
  "engineering_notebook_entries",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    seasonId: uuid("season_id")
      .notNull()
      .references(() => engineeringSeasons.id, { onDelete: "cascade" }),
    projectId: uuid("project_id").references(() => engineeringProjects.id, {
      onDelete: "set null",
    }),
    subsystemId: uuid("subsystem_id").references(
      () => engineeringSubsystems.id,
      { onDelete: "set null" },
    ),
    title: text("title").notNull(),
    entryType: text("entry_type").notNull().default("DESIGN"),
    status: text("status").notNull().default("DRAFT"),
    entryDate: timestamp("entry_date", { withTimezone: true }).notNull(),
    contentHtml: text("content_html").notNull().default("<p></p>"),
    objective: text("objective").notNull().default(""),
    decisions: text("decisions").notNull().default(""),
    results: text("results").notNull().default(""),
    nextSteps: text("next_steps").notNull().default(""),
    tags: jsonb("tags").$type<string[]>().notNull().default([]),
    sortOrder: integer("sort_order").notNull().default(0),
    currentVersion: integer("current_version").notNull().default(1),
    createdByMemberId: uuid("created_by_member_id").references(
      () => members.id,
      { onDelete: "set null" },
    ),
    updatedByMemberId: uuid("updated_by_member_id").references(
      () => members.id,
      { onDelete: "set null" },
    ),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("notebook_entry_scope_date_idx").on(
      table.seasonId,
      table.projectId,
      table.entryDate,
    ),
    index("notebook_entry_status_idx").on(table.status, table.updatedAt),
    index("notebook_entry_order_idx").on(table.seasonId, table.sortOrder),
  ],
);

export const engineeringNotebookVersions = pgTable(
  "engineering_notebook_versions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    entryId: uuid("entry_id")
      .notNull()
      .references(() => engineeringNotebookEntries.id, {
        onDelete: "cascade",
      }),
    versionNumber: integer("version_number").notNull(),
    snapshot: jsonb("snapshot")
      .$type<{
        title: string;
        entryType: string;
        status: string;
        entryDate: string;
        projectId: string | null;
        subsystemId: string | null;
        contentHtml: string;
        objective: string;
        decisions: string;
        results: string;
        nextSteps: string;
        tags: string[];
      }>()
      .notNull(),
    changeSummary: text("change_summary").notNull().default(""),
    createdByMemberId: uuid("created_by_member_id").references(
      () => members.id,
      { onDelete: "set null" },
    ),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("notebook_version_entry_number_idx").on(
      table.entryId,
      table.versionNumber,
    ),
  ],
);

export const engineeringNotebookComments = pgTable(
  "engineering_notebook_comments",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    entryId: uuid("entry_id")
      .notNull()
      .references(() => engineeringNotebookEntries.id, {
        onDelete: "cascade",
      }),
    memberId: uuid("member_id")
      .notNull()
      .references(() => members.id, { onDelete: "cascade" }),
    kind: text("kind").notNull().default("COMMENT"),
    body: text("body").notNull(),
    status: text("status").notNull().default("OPEN"),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
    resolvedByMemberId: uuid("resolved_by_member_id").references(
      () => members.id,
      { onDelete: "set null" },
    ),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [index("notebook_comment_entry_status_idx").on(table.entryId, table.status)],
);

export const engineeringNotebookCompilations = pgTable(
  "engineering_notebook_compilations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    seasonId: uuid("season_id").references(() => engineeringSeasons.id, {
      onDelete: "set null",
    }),
    projectId: uuid("project_id").references(() => engineeringProjects.id, {
      onDelete: "set null",
    }),
    filters: jsonb("filters")
      .$type<Record<string, boolean | string | null>>()
      .notNull()
      .default({}),
    entryCount: integer("entry_count").notNull().default(0),
    filename: text("filename").notNull(),
    compiledByMemberId: uuid("compiled_by_member_id").references(
      () => members.id,
      { onDelete: "set null" },
    ),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [index("notebook_compilation_date_idx").on(table.createdAt)],
);

export const scoutingMatches = pgTable(
  "scouting_matches",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    seasonId: uuid("season_id").references(() => engineeringSeasons.id, {
      onDelete: "set null",
    }),
    eventName: text("event_name").notNull(),
    matchType: text("match_type").notNull().default("QUALIFICATION"),
    matchNumber: text("match_number").notNull(),
    observedTeam: text("observed_team").notNull(),
    allianceColor: text("alliance_color").notNull().default("RED"),
    result: text("result").notNull().default("UNKNOWN"),
    score: integer("score").notNull().default(0),
    opponentScore: integer("opponent_score").notNull().default(0),
    autonomousScore: integer("autonomous_score").notNull().default(0),
    autonomousWon: boolean("autonomous_won").notNull().default(false),
    autonomousWinPoint: boolean("autonomous_win_point").notNull().default(false),
    autoPinsScored: integer("auto_pins_scored").notNull().default(0),
    autoGoalsWithTwoPins: integer("auto_goals_with_two_pins").notNull().default(0),
    autoRobotsMidfield: integer("auto_robots_midfield").notNull().default(0),
    autoContactedPerimeter: boolean("auto_contacted_perimeter").notNull().default(false),
    autoViolation: boolean("auto_violation").notNull().default(false),
    alliancePinsScored: integer("alliance_pins_scored").notNull().default(0),
    yellowPinsOwned: integer("yellow_pins_owned").notNull().default(0),
    goalsUsed: integer("goals_used").notNull().default(0),
    maxStackHeight: integer("max_stack_height").notNull().default(0),
    cupsUsed: integer("cups_used").notNull().default(0),
    togglesOwned: integer("toggles_owned").notNull().default(0),
    robotsMidfield: integer("robots_midfield").notNull().default(0),
    loaderPins: integer("loader_pins").notNull().default(0),
    loaderCups: integer("loader_cups").notNull().default(0),
    successfulCycles: integer("successful_cycles").notNull().default(0),
    failedCycles: integer("failed_cycles").notNull().default(0),
    averageCycleSeconds: integer("average_cycle_seconds").notNull().default(0),
    descores: integer("descores").notNull().default(0),
    penalties: integer("penalties").notNull().default(0),
    breakdowns: integer("breakdowns").notNull().default(0),
    offensiveRating: integer("offensive_rating").notNull().default(3),
    defensiveRating: integer("defensive_rating").notNull().default(3),
    coordinationRating: integer("coordination_rating").notNull().default(3),
    reliabilityRating: integer("reliability_rating").notNull().default(3),
    largeRobotRole: text("large_robot_role").notNull().default(""),
    smallRobotRole: text("small_robot_role").notNull().default(""),
    scoringPattern: text("scoring_pattern").notNull().default(""),
    strengths: text("strengths").notNull().default(""),
    weaknesses: text("weaknesses").notNull().default(""),
    notes: text("notes").notNull().default(""),
    submittedByMemberId: uuid("submitted_by_member_id")
      .notNull()
      .references(() => members.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("scouting_event_team_idx").on(table.eventName, table.observedTeam),
    index("scouting_season_match_idx").on(table.seasonId, table.matchNumber),
  ],
);

export const inventoryItems = pgTable(
  "inventory_items",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    seasonId: uuid("season_id").references(() => engineeringSeasons.id, {
      onDelete: "set null",
    }),
    projectId: uuid("project_id").references(() => engineeringProjects.id, {
      onDelete: "set null",
    }),
    subsystemId: uuid("subsystem_id").references(
      () => engineeringSubsystems.id,
      { onDelete: "set null" },
    ),
    partId: uuid("part_id").references(() => engineeringParts.id, {
      onDelete: "set null",
    }),
    sku: text("sku").notNull(),
    name: text("name").notNull(),
    category: text("category").notNull().default("Robot parts"),
    location: text("location").notNull().default("Shop"),
    quantityOnHand: integer("quantity_on_hand").notNull().default(0),
    quantityReserved: integer("quantity_reserved").notNull().default(0),
    reorderPoint: integer("reorder_point").notNull().default(0),
    unitCostCents: integer("unit_cost_cents").notNull().default(0),
    supplier: text("supplier").notNull().default(""),
    status: text("status").notNull().default("ACTIVE"),
    notes: text("notes").notNull().default(""),
    createdByMemberId: uuid("created_by_member_id").references(
      () => members.id,
      { onDelete: "set null" },
    ),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("inventory_sku_idx").on(table.sku),
    index("inventory_stock_status_idx").on(table.status, table.quantityOnHand),
  ],
);

export const purchaseRequests = pgTable(
  "purchase_requests",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    seasonId: uuid("season_id").references(() => engineeringSeasons.id, {
      onDelete: "set null",
    }),
    projectId: uuid("project_id").references(() => engineeringProjects.id, {
      onDelete: "set null",
    }),
    subsystemId: uuid("subsystem_id").references(
      () => engineeringSubsystems.id,
      { onDelete: "set null" },
    ),
    inventoryItemId: uuid("inventory_item_id").references(
      () => inventoryItems.id,
      { onDelete: "set null" },
    ),
    financePlanId: uuid("finance_plan_id").references(() => financePlans.id, {
      onDelete: "set null",
    }),
    financeEntryId: uuid("finance_entry_id").references(
      () => financeEntries.id,
      { onDelete: "set null" },
    ),
    item: text("item").notNull(),
    category: text("category").notNull().default("Robot parts"),
    vendor: text("vendor").notNull().default(""),
    quantity: integer("quantity").notNull().default(1),
    estimatedUnitCostCents: integer("estimated_unit_cost_cents")
      .notNull()
      .default(0),
    priority: text("priority").notNull().default("NORMAL"),
    status: text("status").notNull().default("DRAFT"),
    neededBy: timestamp("needed_by", { withTimezone: true }),
    requestedByMemberId: uuid("requested_by_member_id")
      .notNull()
      .references(() => members.id, { onDelete: "cascade" }),
    approvedByMemberId: uuid("approved_by_member_id").references(
      () => members.id,
      { onDelete: "set null" },
    ),
    approvedAt: timestamp("approved_at", { withTimezone: true }),
    orderedAt: timestamp("ordered_at", { withTimezone: true }),
    receivedAt: timestamp("received_at", { withTimezone: true }),
    notes: text("notes").notNull().default(""),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [index("purchase_status_needed_idx").on(table.status, table.neededBy)],
);

export const designChanges = pgTable(
  "design_changes",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    seasonId: uuid("season_id").references(() => engineeringSeasons.id, {
      onDelete: "set null",
    }),
    projectId: uuid("project_id").references(() => engineeringProjects.id, {
      onDelete: "set null",
    }),
    subsystemId: uuid("subsystem_id").references(
      () => engineeringSubsystems.id,
      { onDelete: "set null" },
    ),
    partId: uuid("part_id").references(() => engineeringParts.id, {
      onDelete: "set null",
    }),
    changeNumber: text("change_number").notNull(),
    title: text("title").notNull(),
    reason: text("reason").notNull(),
    description: text("description").notNull(),
    impact: text("impact").notNull().default(""),
    costImpactCents: integer("cost_impact_cents").notNull().default(0),
    scheduleImpactDays: integer("schedule_impact_days").notNull().default(0),
    risk: text("risk").notNull().default("MEDIUM"),
    status: text("status").notNull().default("DRAFT"),
    revisionFrom: text("revision_from").notNull().default(""),
    revisionTo: text("revision_to").notNull().default(""),
    verificationPlan: text("verification_plan").notNull().default(""),
    verificationResults: text("verification_results").notNull().default(""),
    requestedByMemberId: uuid("requested_by_member_id")
      .notNull()
      .references(() => members.id, { onDelete: "cascade" }),
    approvedByMemberId: uuid("approved_by_member_id").references(
      () => members.id,
      { onDelete: "set null" },
    ),
    approvedAt: timestamp("approved_at", { withTimezone: true }),
    implementedAt: timestamp("implemented_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("design_change_number_idx").on(table.changeNumber),
    index("design_change_status_idx").on(table.status, table.updatedAt),
  ],
);

/**
 * Flexible operational records shared by the control-center tools.  The
 * structured columns make records searchable/reportable while `data` holds
 * the fields specific to a matrix, recognition, RACI assignment, template,
 * automation, issue, notification, sponsor engagement, or notebook prompt.
 */
export const operationsHubRecords = pgTable(
  "operations_hub_records",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    kind: text("kind").notNull(),
    title: text("title").notNull(),
    description: text("description").notNull().default(""),
    status: text("status").notNull().default("ACTIVE"),
    priority: text("priority").notNull().default("NORMAL"),
    ownerMemberId: uuid("owner_member_id").references(() => members.id, {
      onDelete: "set null",
    }),
    subjectMemberId: uuid("subject_member_id").references(() => members.id, {
      onDelete: "set null",
    }),
    seasonId: uuid("season_id").references(() => engineeringSeasons.id, {
      onDelete: "set null",
    }),
    projectId: uuid("project_id").references(() => engineeringProjects.id, {
      onDelete: "set null",
    }),
    subsystemId: uuid("subsystem_id").references(
      () => engineeringSubsystems.id,
      { onDelete: "set null" },
    ),
    partId: uuid("part_id").references(() => engineeringParts.id, {
      onDelete: "set null",
    }),
    dueAt: timestamp("due_at", { withTimezone: true }),
    occurredAt: timestamp("occurred_at", { withTimezone: true }),
    sourceType: text("source_type"),
    sourceId: text("source_id"),
    sourceUrl: text("source_url"),
    fingerprint: text("fingerprint"),
    data: jsonb("data")
      .$type<Record<string, unknown>>()
      .notNull()
      .default({}),
    createdByMemberId: uuid("created_by_member_id").references(
      () => members.id,
      { onDelete: "set null" },
    ),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("operations_hub_kind_status_idx").on(table.kind, table.status),
    index("operations_hub_owner_due_idx").on(table.ownerMemberId, table.dueAt),
    index("operations_hub_subject_kind_idx").on(table.subjectMemberId, table.kind),
    uniqueIndex("operations_hub_fingerprint_idx")
      .on(table.kind, table.fingerprint)
      .where(sql`${table.fingerprint} is not null`),
  ],
);

export const discordGuilds = pgTable("discord_guilds", {
  id: text("id").primaryKey(),
  name: text("name").notNull().default("Discord server"),
  iconHash: text("icon_hash"),
  memberCount: integer("member_count").notNull().default(0),
  linkedMemberCount: integer("linked_member_count").notNull().default(0),
  generalChannelId: text("general_channel_id"),
  calendarAnnouncementsEnabled: boolean("calendar_announcements_enabled")
    .notNull()
    .default(true),
  calendarReminderHours: integer("calendar_reminder_hours")
    .notNull()
    .default(24),
  messageReactionEnabled: boolean("message_reaction_enabled")
    .notNull()
    .default(true),
  messageReactionEmoji: text("message_reaction_emoji")
    .notNull()
    .default("✅"),
  onboardingEnabled: boolean("onboarding_enabled").notNull().default(true),
  securityDelayMinutes: integer("security_delay_minutes")
    .notNull()
    .default(10),
  agreedRoleId: text("agreed_role_id"),
  vexUMemberRoleId: text("vex_u_member_role_id"),
  unverifiedRoleId: text("unverified_role_id"),
  utsaVerifiedRoleId: text("utsa_verified_role_id"),
  verifiedMemberRoleId: text("verified_member_role_id"),
  suspendedRoleId: text("suspended_role_id"),
  verificationEnforcementEnabled: boolean(
    "verification_enforcement_enabled",
  )
    .notNull()
    .default(false),
  verificationPublicChannelIds: jsonb("verification_public_channel_ids")
    .$type<string[]>()
    .notNull()
    .default([]),
  duesEnforcementEnabled: boolean("dues_enforcement_enabled")
    .notNull()
    .default(false),
  duesPaidRoleId: text("dues_paid_role_id"),
  duesUnpaidRoleId: text("dues_unpaid_role_id"),
  duesPublicChannelIds: jsonb("dues_public_channel_ids")
    .$type<string[]>()
    .notNull()
    .default([]),
  duesLastSyncedAt: timestamp("dues_last_synced_at", { withTimezone: true }),
  installedByDiscordUserId: text("installed_by_discord_user_id"),
  lastSyncedAt: timestamp("last_synced_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const discordChannels = pgTable(
  "discord_channels",
  {
    id: text("id").primaryKey(),
    guildId: text("guild_id")
      .notNull()
      .references(() => discordGuilds.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    type: integer("type").notNull(),
    parentId: text("parent_id"),
    position: integer("position").notNull().default(0),
    archived: boolean("archived").notNull().default(false),
    lastSyncedAt: timestamp("last_synced_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("discord_channel_guild_position_idx").on(
      table.guildId,
      table.position,
    ),
  ],
);

export const discordGuildMembers = pgTable(
  "discord_guild_members",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    guildId: text("guild_id")
      .notNull()
      .references(() => discordGuilds.id, { onDelete: "cascade" }),
    discordUserId: text("discord_user_id").notNull(),
    username: text("username").notNull(),
    displayName: text("display_name").notNull(),
    avatarHash: text("avatar_hash"),
    roles: jsonb("roles").$type<string[]>().notNull().default([]),
    isBot: boolean("is_bot").notNull().default(false),
    joinedAt: timestamp("joined_at", { withTimezone: true }),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    linkedMemberId: uuid("linked_member_id").references(() => members.id, {
      onDelete: "set null",
    }),
    linkedAt: timestamp("linked_at", { withTimezone: true }),
    lastSynchronizedAt: timestamp("last_synchronized_at", {
      withTimezone: true,
    }),
    guildMembershipStatus: text("guild_membership_status")
      .notNull()
      .default("ACTIVE"),
    nicknameSyncStatus: text("nickname_sync_status")
      .notNull()
      .default("PENDING"),
    roleSyncStatus: text("role_sync_status")
      .notNull()
      .default("PENDING"),
    lastSyncError: text("last_sync_error"),
    registrationReminderSentAt: timestamp("registration_reminder_sent_at", {
      withTimezone: true,
    }),
    registrationReminderCount: integer("registration_reminder_count")
      .notNull()
      .default(0),
    onboardingDmSentAt: timestamp("onboarding_dm_sent_at", {
      withTimezone: true,
    }),
    securityDelayEndsAt: timestamp("security_delay_ends_at", {
      withTimezone: true,
    }),
    securityDelayNotificationSentAt: timestamp(
      "security_delay_notification_sent_at",
      { withTimezone: true },
    ),
    onboardingRolesAssignedAt: timestamp("onboarding_roles_assigned_at", {
      withTimezone: true,
    }),
    onboardingRoleError: text("onboarding_role_error"),
    remindersOptedOut: boolean("reminders_opted_out")
      .notNull()
      .default(false),
    leftAt: timestamp("left_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("discord_guild_member_identity_idx").on(
      table.guildId,
      table.discordUserId,
    ),
    uniqueIndex("discord_guild_member_linked_identity_idx")
      .on(table.guildId, table.linkedMemberId)
      .where(sql`${table.linkedMemberId} is not null`),
    index("discord_guild_member_linked_idx").on(table.linkedMemberId),
    index("discord_guild_member_active_idx").on(table.guildId, table.leftAt),
  ],
);

export const discordLinkTokens = pgTable(
  "discord_link_tokens",
  {
    tokenHash: text("token_hash").primaryKey(),
    guildId: text("guild_id")
      .notNull()
      .references(() => discordGuilds.id, { onDelete: "cascade" }),
    discordUserId: text("discord_user_id").notNull(),
    username: text("username").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    usedAt: timestamp("used_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("discord_link_token_user_idx").on(
      table.guildId,
      table.discordUserId,
    ),
    index("discord_link_token_expiry_idx").on(table.expiresAt),
  ],
);

export const discordEvents = pgTable(
  "discord_events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    guildId: text("guild_id").references(() => discordGuilds.id, {
      onDelete: "set null",
    }),
    discordUserId: text("discord_user_id"),
    kind: text("kind").notNull(),
    commandName: text("command_name"),
    metadata: jsonb("metadata")
      .$type<Record<string, unknown>>()
      .notNull()
      .default({}),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("discord_event_kind_date_idx").on(table.kind, table.createdAt),
    index("discord_event_guild_date_idx").on(table.guildId, table.createdAt),
  ],
);

export type DiscordMessageAttachment = {
  id: string;
  filename: string;
  url: string;
  contentType?: string | null;
  size?: number;
};

export const discordMessages = pgTable(
  "discord_messages",
  {
    id: text("id").primaryKey(),
    guildId: text("guild_id")
      .notNull()
      .references(() => discordGuilds.id, { onDelete: "cascade" }),
    channelId: text("channel_id").notNull(),
    channelName: text("channel_name").notNull().default("unknown-channel"),
    authorDiscordUserId: text("author_discord_user_id").notNull(),
    authorUsername: text("author_username").notNull(),
    authorDisplayName: text("author_display_name").notNull(),
    authorIsBot: boolean("author_is_bot").notNull().default(false),
    linkedMemberId: uuid("linked_member_id").references(() => members.id, {
      onDelete: "set null",
    }),
    content: text("content").notNull().default(""),
    attachments: jsonb("attachments")
      .$type<DiscordMessageAttachment[]>()
      .notNull()
      .default([]),
    discordCreatedAt: timestamp("discord_created_at", {
      withTimezone: true,
    }).notNull(),
    discordEditedAt: timestamp("discord_edited_at", { withTimezone: true }),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    firstSyncedAt: timestamp("first_synced_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("discord_message_guild_date_idx").on(
      table.guildId,
      table.discordCreatedAt,
    ),
    index("discord_message_channel_date_idx").on(
      table.channelId,
      table.discordCreatedAt,
    ),
    index("discord_message_author_date_idx").on(
      table.authorDiscordUserId,
      table.discordCreatedAt,
    ),
    index("discord_message_member_date_idx").on(
      table.linkedMemberId,
      table.discordCreatedAt,
    ),
  ],
);

export const discordDirectMessages = pgTable(
  "discord_direct_messages",
  {
    id: text("id").primaryKey(),
    channelId: text("channel_id").notNull(),
    discordUserId: text("discord_user_id").notNull(),
    username: text("username").notNull(),
    displayName: text("display_name").notNull(),
    direction: text("direction").notNull().default("INBOUND"),
    content: text("content").notNull().default(""),
    attachments: jsonb("attachments")
      .$type<DiscordMessageAttachment[]>()
      .notNull()
      .default([]),
    aiGenerated: boolean("ai_generated").notNull().default(false),
    replyToMessageId: text("reply_to_message_id"),
    metadata: jsonb("metadata")
      .$type<Record<string, unknown>>()
      .notNull()
      .default({}),
    discordCreatedAt: timestamp("discord_created_at", {
      withTimezone: true,
    }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("discord_dm_user_date_idx").on(
      table.discordUserId,
      table.discordCreatedAt,
    ),
    index("discord_dm_direction_date_idx").on(
      table.direction,
      table.discordCreatedAt,
    ),
  ],
);

export const discordCalendarReminders = pgTable(
  "discord_calendar_reminders",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    guildId: text("guild_id")
      .notNull()
      .references(() => discordGuilds.id, { onDelete: "cascade" }),
    calendarEventId: text("calendar_event_id").notNull(),
    eventTitle: text("event_title").notNull(),
    startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
    reminderWindowHours: integer("reminder_window_hours").notNull(),
    channelId: text("channel_id").notNull(),
    discordMessageId: text("discord_message_id"),
    sentAt: timestamp("sent_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("discord_calendar_reminder_once_idx").on(
      table.guildId,
      table.calendarEventId,
      table.reminderWindowHours,
    ),
    index("discord_calendar_reminder_date_idx").on(table.guildId, table.sentAt),
  ],
);

export const membershipSettings = pgTable("membership_settings", {
  id: text("id").primaryKey().default("membership"),
  membershipYear: text("membership_year").notNull().default("2026-2027"),
  semesterDuesCents: integer("semester_dues_cents").notNull().default(3000),
  annualDuesCents: integer("annual_dues_cents").notNull().default(5000),
  fundraisingWaiverThresholdCents: integer(
    "fundraising_waiver_threshold_cents",
  )
    .notNull()
    .default(10000),
  gracePeriodDays: integer("grace_period_days").notNull().default(30),
  accessEnforcementEnabled: boolean("access_enforcement_enabled")
    .notNull()
    .default(false),
  updatedByMemberId: uuid("updated_by_member_id").references(
    () => members.id,
    { onDelete: "set null" },
  ),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const membershipPeriods = pgTable(
  "membership_periods",
  {
    id: text("id").primaryKey(),
    label: text("label").notNull(),
    academicYear: text("academic_year").notNull(),
    coverageType: text("coverage_type").notNull(),
    amountCents: integer("amount_cents").notNull(),
    startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
    endsAt: timestamp("ends_at", { withTimezone: true }).notNull(),
    graceEndsAt: timestamp("grace_ends_at", { withTimezone: true }),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("membership_period_year_active_idx").on(
      table.academicYear,
      table.isActive,
    ),
  ],
);

export const membershipDues = pgTable(
  "membership_dues",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    memberId: uuid("member_id")
      .notNull()
      .references(() => members.id, { onDelete: "cascade" }),
    period: text("period").notNull(),
    membershipPeriodId: text("membership_period_id").references(
      () => membershipPeriods.id,
      { onDelete: "set null" },
    ),
    coverageType: text("coverage_type").notNull().default("ANNUAL_DUES"),
    amountDueCents: integer("amount_due_cents").notNull().default(0),
    manualAmountPaidCents: integer("manual_amount_paid_cents")
      .notNull()
      .default(0),
    amountPaidCents: integer("amount_paid_cents").notNull().default(0),
    status: text("status").notNull().default("DUE"),
    fundraisingRaisedCents: integer("fundraising_raised_cents")
      .notNull()
      .default(0),
    fundraisingThresholdCents: integer("fundraising_threshold_cents")
      .notNull()
      .default(10000),
    waiverType: text("waiver_type"),
    waiverReason: text("waiver_reason"),
    waivedAt: timestamp("waived_at", { withTimezone: true }),
    waiverGrantedByMemberId: uuid("waiver_granted_by_member_id").references(
      () => members.id,
      { onDelete: "set null" },
    ),
    paidBeforeWaiverReview: boolean("paid_before_waiver_review")
      .notNull()
      .default(false),
    dueAt: timestamp("due_at", { withTimezone: true }),
    paidAt: timestamp("paid_at", { withTimezone: true }),
    paymentMethod: text("payment_method").notNull().default(""),
    notes: text("notes").notNull().default(""),
    updatedByMemberId: uuid("updated_by_member_id").references(
      () => members.id,
      { onDelete: "set null" },
    ),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("membership_dues_member_period_idx").on(
      table.memberId,
      table.period,
    ),
    index("membership_dues_period_status_idx").on(table.period, table.status),
    index("membership_dues_member_idx").on(table.memberId),
  ],
);

export const membershipDuesPayments = pgTable(
  "membership_dues_payments",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    membershipDuesId: uuid("membership_dues_id")
      .notNull()
      .references(() => membershipDues.id, { onDelete: "cascade" }),
    memberId: uuid("member_id")
      .notNull()
      .references(() => members.id, { onDelete: "cascade" }),
    stripeCheckoutSessionId: text("stripe_checkout_session_id").unique(),
    stripePaymentIntentId: text("stripe_payment_intent_id"),
    paymentType: text("payment_type")
      .notNull()
      .default("SEMESTER_DUES"),
    coverageType: text("coverage_type")
      .notNull()
      .default("SEMESTER"),
    coveragePeriod: text("coverage_period").notNull().default(""),
    paymentMethod: text("payment_method").notNull().default("STRIPE"),
    paymentDate: timestamp("payment_date", { withTimezone: true }),
    transactionReference: text("transaction_reference"),
    receiptNumber: text("receipt_number"),
    providerReceiptUrl: text("provider_receipt_url"),
    proofPathname: text("proof_pathname"),
    proofFilename: text("proof_filename"),
    proofMimeType: text("proof_mime_type"),
    proofBytes: integer("proof_bytes"),
    enteredByMemberId: uuid("entered_by_member_id").references(
      () => members.id,
      { onDelete: "set null" },
    ),
    notes: text("notes").notNull().default(""),
    amountCents: integer("amount_cents").notNull(),
    refundedCents: integer("refunded_cents").notNull().default(0),
    currency: text("currency").notNull().default("usd"),
    status: text("status").notNull().default("PENDING"),
    paidAt: timestamp("paid_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("membership_dues_payment_dues_idx").on(table.membershipDuesId),
    index("membership_dues_payment_member_idx").on(table.memberId),
    index("membership_dues_payment_intent_idx").on(
      table.stripePaymentIntentId,
    ),
    uniqueIndex("membership_dues_receipt_number_idx")
      .on(table.receiptNumber)
      .where(sql`${table.receiptNumber} is not null`),
    index("membership_dues_payment_date_idx").on(
      table.memberId,
      table.paymentDate,
    ),
  ],
);
