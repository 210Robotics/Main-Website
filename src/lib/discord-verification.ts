import {
  isUtsaStudentEmail,
  normalizeEmail,
  type AcademicLevel,
} from "@/lib/membership-policy";
import { normalizedMemberNameParts } from "@/lib/member-name";

export const discordVerificationDuesMethods = [
  "CASH_APP",
  "ZELLE",
  "STRIPE",
  "FUNDRAISING",
  "NOT_YET_PAID",
] as const;

export type DiscordVerificationDuesMethod =
  (typeof discordVerificationDuesMethods)[number];

export type DiscordVerificationApplicationInput = {
  firstName: string;
  lastName: string;
  universityEmail: string;
  academicLevel: AcademicLevel;
  duesMethod: DiscordVerificationDuesMethod;
};

function cleanName(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

function parseAcademicLevel(value: string): AcademicLevel | null {
  const normalized = value.trim().toLowerCase().replace(/[^a-z0-9]+/g, " ");
  const aliases: Record<string, AcademicLevel> = {
    freshman: "FRESHMAN",
    "first year": "FRESHMAN",
    sophomore: "SOPHOMORE",
    "second year": "SOPHOMORE",
    junior: "JUNIOR",
    "third year": "JUNIOR",
    senior: "SENIOR",
    "fourth year": "SENIOR",
    graduate: "GRADUATE",
    "graduate student": "GRADUATE",
    masters: "MASTERS",
    "master s": "MASTERS",
    "master student": "MASTERS",
    phd: "PHD",
    doctoral: "PHD",
    doctorate: "PHD",
    mentor: "MENTOR",
  };
  return aliases[normalized] ?? null;
}

function parseDuesMethod(
  value: string,
): DiscordVerificationDuesMethod | null {
  const normalized = value.trim().toLowerCase();
  if (/cash\s*app/.test(normalized)) return "CASH_APP";
  if (/zelle/.test(normalized)) return "ZELLE";
  if (/stripe|card|online/.test(normalized)) return "STRIPE";
  if (/donat|fundrais|waiv/.test(normalized)) return "FUNDRAISING";
  if (/not|unpaid|haven.?t|none|pending/.test(normalized)) {
    return "NOT_YET_PAID";
  }
  return null;
}

export function parseDiscordVerificationApplication(input: {
  firstName: string;
  lastName: string;
  universityEmail: string;
  academicLevel: string;
  duesMethod: string;
}):
  | { success: true; data: DiscordVerificationApplicationInput }
  | { success: false; message: string } {
  const cleanedName = normalizedMemberNameParts(
    cleanName(input.firstName),
    cleanName(input.lastName),
  );
  const firstName = cleanedName.firstName;
  const lastName = cleanedName.lastName;
  const universityEmail = normalizeEmail(input.universityEmail);
  const academicLevel = parseAcademicLevel(input.academicLevel);
  const duesMethod = parseDuesMethod(input.duesMethod);
  if (!firstName || firstName.length > 60 || !lastName || lastName.length > 60) {
    return {
      success: false,
      message: "Enter a first and last name, each under 60 characters.",
    };
  }
  if (!isUtsaStudentEmail(universityEmail)) {
    return {
      success: false,
      message:
        "Use your @my.utsa.edu address. You will still verify ownership securely through the portal.",
    };
  }
  if (!academicLevel) {
    return {
      success: false,
      message:
        "Academic level must be Freshman, Sophomore, Junior, Senior, Graduate, Masters, PhD, or Mentor.",
    };
  }
  if (!duesMethod) {
    return {
      success: false,
      message:
        "Dues method must be Cash App, Zelle, Stripe, $100+ fundraising, or Not paid yet.",
    };
  }
  return {
    success: true,
    data: { firstName, lastName, universityEmail, academicLevel, duesMethod },
  };
}
