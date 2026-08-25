"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getDb } from "@/db";
import { auditEvents, members } from "@/db/schema";
import { getCurrentMember, synchronizeCurrentMemberIdentity } from "@/lib/auth";
import { reconcileMemberMembership } from "@/lib/membership-access-server";
import { academicLevels } from "@/lib/membership-policy";

export type VerificationProfileState = {
  status: "idle" | "success" | "error";
  message: string;
  errors?: Record<string, string[]>;
};

const profileSchema = z.object({
  firstName: z.string().trim().min(1, "Enter your first name.").max(60),
  lastName: z.string().trim().min(1, "Enter your last name.").max(60),
  displayName: z
    .string()
    .trim()
    .min(3, "Use a recognizable first and last name.")
    .max(100)
    .refine((value) => value.includes(" "), {
      message: "Use a recognizable first and last name.",
    }),
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
    displayName: formData.get("displayName"),
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
  await getDb()
    .update(members)
    .set({
      firstName: parsed.data.firstName,
      lastName: parsed.data.lastName,
      displayName: parsed.data.displayName,
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
  revalidatePath("/verify");
  revalidatePath("/portal");
  return { status: "success", message: "Profile saved. Your checklist is updated." };
}

export async function refreshUniversityVerification() {
  const member = await synchronizeCurrentMemberIdentity();
  if (member) await reconcileMemberMembership(member.id);
  revalidatePath("/verify");
}

