"use server";

import { createHmac, randomInt, timingSafeEqual } from "node:crypto";
import { clerkClient } from "@clerk/nextjs/server";
import { and, eq, ne } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getDb } from "@/db";
import {
  auditEvents,
  members,
  universityEmailVerificationChallenges,
} from "@/db/schema";
import { getCurrentMember, synchronizeCurrentMemberIdentity } from "@/lib/auth";
import { reconcileMemberMembership } from "@/lib/membership-access-server";
import { academicLevels } from "@/lib/membership-policy";
import { syncDiscordDuesAccessForMember } from "@/lib/discord";
import {
  canonicalMemberName,
  normalizedMemberNameParts,
} from "@/lib/member-name";
import { getResend, universityVerificationEmail } from "@/lib/email";
import { isUtsaStudentEmail, normalizeEmail } from "@/lib/membership-policy";

export type UniversityVerificationResult = {
  status: "success" | "error";
  message: string;
  verified?: boolean;
};

const CODE_LIFETIME_MS = 10 * 60 * 1000;
const RESEND_COOLDOWN_MS = 60 * 1000;
const SEND_WINDOW_MS = 60 * 60 * 1000;
const MAX_SENDS_PER_WINDOW = 5;
const MAX_ATTEMPTS = 5;

function hashVerificationCode(memberId: string, email: string, code: string) {
  const secret = process.env.CLERK_SECRET_KEY;
  if (!secret) throw new Error("Verification service is not configured.");
  return createHmac("sha256", secret)
    .update(`${memberId}:${email}:${code}`)
    .digest("hex");
}

function safeHashEqual(expected: string, actual: string) {
  const expectedBuffer = Buffer.from(expected, "hex");
  const actualBuffer = Buffer.from(actual, "hex");
  return (
    expectedBuffer.length === actualBuffer.length &&
    timingSafeEqual(expectedBuffer, actualBuffer)
  );
}

export type VerificationProfileState = {
  status: "idle" | "success" | "error";
  message: string;
  errors?: Record<string, string[]>;
};

const profileSchema = z.object({
  firstName: z.string().trim().min(1, "Enter your first name.").max(60),
  lastName: z.string().trim().min(1, "Enter your last name.").max(60),
  academicLevel: z.enum(academicLevels),
  major: z.string().trim().max(120),
  expectedGraduationYear: z
    .union([z.coerce.number().int().min(2026).max(2045), z.literal("")])
    .optional(),
  teamInterests: z.array(z.string().trim().min(1).max(60)).max(12),
  profileVisibility: z.enum(["private", "public"]),
});

export async function saveVerificationProfile(
  _previous: VerificationProfileState,
  formData: FormData,
): Promise<VerificationProfileState> {
  const member = await getCurrentMember();
  if (!member) {
    return { status: "error", message: "Sign in before completing verification." };
  }
  const parsed = profileSchema.safeParse({
    firstName: formData.get("firstName"),
    lastName: formData.get("lastName"),
    academicLevel: formData.get("academicLevel"),
    major: formData.get("major"),
    expectedGraduationYear: formData.get("expectedGraduationYear") || "",
    teamInterests: formData
      .getAll("teamInterests")
      .map(String)
      .filter(Boolean),
    profileVisibility: formData.get("profileVisibility"),
  });
  if (!parsed.success) {
    return {
      status: "error",
      message: "Please correct the highlighted profile fields.",
      errors: parsed.error.flatten().fieldErrors,
    };
  }
  const now = new Date();
  const name = normalizedMemberNameParts(
    parsed.data.firstName,
    parsed.data.lastName,
  );
  const canonicalName = canonicalMemberName(name);
  await getDb()
    .update(members)
    .set({
      firstName: name.firstName,
      lastName: name.lastName,
      displayName: canonicalName,
      academicLevel: parsed.data.academicLevel,
      major: parsed.data.major,
      expectedGraduationYear:
        parsed.data.expectedGraduationYear === ""
          ? null
          : parsed.data.expectedGraduationYear,
      teamInterests: parsed.data.teamInterests,
      profileCompletedAt: now,
      isPublic: parsed.data.profileVisibility === "public",
      updatedAt: now,
    })
    .where(eq(members.id, member.id));
  await getDb().insert(auditEvents).values({
    actorMemberId: member.id,
    action: "verification.profile_completed",
    entityType: "member",
    entityId: member.id,
    details: { academicLevel: parsed.data.academicLevel },
  });
  await reconcileMemberMembership(member.id);
  await syncDiscordDuesAccessForMember(member.id).catch((error) => {
    console.error("Discord profile synchronization failed", error);
  });
  revalidatePath("/verify");
  revalidatePath("/portal");
  return { status: "success", message: "Profile saved. Your checklist is updated." };
}

export async function refreshUniversityVerification() {
  const member = await synchronizeCurrentMemberIdentity();
  if (member) {
    await reconcileMemberMembership(member.id);
    await syncDiscordDuesAccessForMember(member.id).catch((error) => {
      console.error("Discord verification synchronization failed", error);
    });
  }
  revalidatePath("/verify");
}

export async function sendUniversityVerificationCode(
  emailInput: string,
): Promise<UniversityVerificationResult> {
  const member = await getCurrentMember();
  if (!member) return { status: "error", message: "Sign in before verifying your email." };

  const email = normalizeEmail(emailInput);
  if (!isUtsaStudentEmail(email)) {
    return { status: "error", message: "Enter your official @my.utsa.edu email address." };
  }
  const resend = getResend();
  const domain = process.env.RESEND_EMAIL_DOMAIN;
  if (!resend || !domain) {
    return { status: "error", message: "Email verification is temporarily unavailable. Please contact an officer." };
  }

  const db = getDb();
  const duplicate = await db.query.members.findFirst({
    where: and(eq(members.normalizedUniversityEmail, email), ne(members.id, member.id)),
    columns: { id: true },
  });
  if (duplicate) {
    return { status: "error", message: "That UTSA email is already connected to another portal account." };
  }

  const now = new Date();
  const existing = await db.query.universityEmailVerificationChallenges.findFirst({
    where: eq(universityEmailVerificationChallenges.memberId, member.id),
  });
  if (existing && now.getTime() - existing.lastSentAt.getTime() < RESEND_COOLDOWN_MS) {
    const seconds = Math.ceil((RESEND_COOLDOWN_MS - (now.getTime() - existing.lastSentAt.getTime())) / 1000);
    return { status: "error", message: `Wait ${seconds} seconds before requesting another code.` };
  }
  const withinWindow = existing && now.getTime() - existing.sendWindowStartedAt.getTime() < SEND_WINDOW_MS;
  if (withinWindow && existing.sendCount >= MAX_SENDS_PER_WINDOW) {
    return { status: "error", message: "Too many verification emails were requested. Try again in about an hour." };
  }

  const client = await clerkClient();
  const user = await client.users.getUser(member.clerkUserId);
  let address = user.emailAddresses.find(
    (candidate) => normalizeEmail(candidate.emailAddress) === email,
  );
  if (!address) {
    address = await client.emailAddresses.createEmailAddress({
      userId: member.clerkUserId,
      emailAddress: email,
      verified: false,
    });
  }
  if (address.verification?.status === "verified") {
    await refreshUniversityVerification();
    return { status: "success", verified: true, message: "Your UTSA email is already verified." };
  }

  const code = randomInt(0, 1_000_000).toString().padStart(6, "0");
  const codeHash = hashVerificationCode(member.id, email, code);
  const expiresAt = new Date(now.getTime() + CODE_LIFETIME_MS);
  const sendWindowStartedAt = withinWindow ? existing.sendWindowStartedAt : now;
  const sendCount = withinWindow ? existing.sendCount + 1 : 1;

  const delivery = await resend.emails.send({
    from: `210 Robotics Verification <verification@${domain}>`,
    to: email,
    subject: "Your 210 Robotics verification code",
    html: universityVerificationEmail(code),
  });
  if (delivery.error) {
    console.error("UTSA verification email failed", delivery.error.name);
    return { status: "error", message: "The verification email could not be sent. Please try again shortly." };
  }

  await db
    .insert(universityEmailVerificationChallenges)
    .values({
      memberId: member.id,
      clerkEmailAddressId: address.id,
      email,
      codeHash,
      expiresAt,
      attempts: 0,
      sendCount,
      sendWindowStartedAt,
      lastSentAt: now,
      updatedAt: now,
      verifiedAt: null,
    })
    .onConflictDoUpdate({
      target: universityEmailVerificationChallenges.memberId,
      set: {
        clerkEmailAddressId: address.id,
        email,
        codeHash,
        expiresAt,
        attempts: 0,
        sendCount,
        sendWindowStartedAt,
        lastSentAt: now,
        updatedAt: now,
        verifiedAt: null,
      },
    });
  await db.insert(auditEvents).values({
    actorMemberId: member.id,
    action: "verification.university_email_code_sent",
    entityType: "member",
    entityId: member.id,
    details: { emailDomain: "my.utsa.edu" },
  });
  return { status: "success", message: `A six-digit code was sent to ${email}.` };
}

export async function verifyUniversityEmailCode(
  codeInput: string,
): Promise<UniversityVerificationResult> {
  const member = await getCurrentMember();
  if (!member) return { status: "error", message: "Sign in before verifying your email." };
  const code = codeInput.trim();
  if (!/^\d{6}$/.test(code)) {
    return { status: "error", message: "Enter the six-digit code from your UTSA inbox." };
  }

  const db = getDb();
  const challenge = await db.query.universityEmailVerificationChallenges.findFirst({
    where: eq(universityEmailVerificationChallenges.memberId, member.id),
  });
  if (!challenge || challenge.verifiedAt) {
    return { status: "error", message: "Request a new verification code first." };
  }
  if (challenge.expiresAt.getTime() <= Date.now()) {
    return { status: "error", message: "That code expired. Request a new one." };
  }
  if (challenge.attempts >= MAX_ATTEMPTS) {
    return { status: "error", message: "Too many incorrect attempts. Request a new code." };
  }

  const matches = safeHashEqual(
    challenge.codeHash,
    hashVerificationCode(member.id, challenge.email, code),
  );
  if (!matches) {
    await db
      .update(universityEmailVerificationChallenges)
      .set({ attempts: challenge.attempts + 1, updatedAt: new Date() })
      .where(eq(universityEmailVerificationChallenges.id, challenge.id));
    return { status: "error", message: "That code is incorrect. Check the email and try again." };
  }

  const client = await clerkClient();
  const user = await client.users.getUser(member.clerkUserId);
  const address = user.emailAddresses.find(
    (candidate) => candidate.id === challenge.clerkEmailAddressId,
  );
  if (!address || normalizeEmail(address.emailAddress) !== challenge.email) {
    return { status: "error", message: "The email address changed. Request a new verification code." };
  }
  await client.emailAddresses.updateEmailAddress(address.id, { verified: true });

  const now = new Date();
  await db
    .update(universityEmailVerificationChallenges)
    .set({ verifiedAt: now, updatedAt: now })
    .where(eq(universityEmailVerificationChallenges.id, challenge.id));
  await db
    .update(members)
    .set({
      normalizedUniversityEmail: challenge.email,
      universityEmailVerifiedAt: now,
      updatedAt: now,
    })
    .where(eq(members.id, member.id));
  await db.insert(auditEvents).values({
    actorMemberId: member.id,
    action: "verification.university_email_verified",
    entityType: "member",
    entityId: member.id,
    details: { emailDomain: "my.utsa.edu" },
  });
  await reconcileMemberMembership(member.id);
  await syncDiscordDuesAccessForMember(member.id).catch((error) => {
    console.error("Discord verification synchronization failed", error);
  });
  revalidatePath("/verify");
  revalidatePath("/portal");
  return { status: "success", verified: true, message: "UTSA email verified. Your member access is being synchronized." };
}
