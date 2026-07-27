export const seasonStatuses = ["PLANNING", "ACTIVE", "COMPLETE", "ARCHIVED"] as const;
export const projectStatuses = ["PLANNING", "ACTIVE", "ON_HOLD", "COMPLETE"] as const;
export const notebookEntryTypes = [
  "PLANNING",
  "RESEARCH",
  "DESIGN",
  "PROTOTYPE",
  "BUILD",
  "TEST",
  "PROGRAMMING",
  "COMPETITION",
  "DECISION",
  "RETROSPECTIVE",
] as const;
export const notebookStatuses = ["DRAFT", "IN_REVIEW", "APPROVED", "PUBLISHED"] as const;
export const notebookCommentKinds = ["COMMENT", "PLAN", "CHANGE_REQUEST"] as const;

export const scoutingMatchTypes = [
  "PRACTICE",
  "QUALIFICATION",
  "ELIMINATION",
  "DRIVER_SKILLS",
  "AUTONOMOUS_SKILLS",
] as const;
export const scoutingResults = ["UNKNOWN", "WIN", "LOSS", "TIE"] as const;

export const inventoryCategories = [
  "VEX components",
  "Robot parts",
  "Raw material",
  "Fasteners",
  "Electronics",
  "Pneumatics",
  "Tools and consumables",
  "Event materials",
  "Marketing materials",
  "Safety equipment",
] as const;

export const purchaseStatuses = [
  "DRAFT",
  "SUBMITTED",
  "APPROVED",
  "ORDERED",
  "RECEIVED",
  "REJECTED",
  "CANCELED",
] as const;
export const designChangeStatuses = [
  "DRAFT",
  "IN_REVIEW",
  "APPROVED",
  "IMPLEMENTED",
  "REJECTED",
] as const;

export const financeCategories = [
  "Robot parts",
  "Raw material",
  "Manufacturing",
  "Recurring software subscription",
  "Recurring service subscription",
  "Event registration",
  "Event travel",
  "Event lodging",
  "Event materials",
  "Marketing materials",
  "Outreach materials",
  "Tools and equipment",
  "Safety equipment",
  "Shipping and freight",
  "Sponsor contribution",
  "University funding",
  "Grant",
  "Fundraising",
  "Membership dues",
  "Reimbursement",
  "Other income",
  "Other expense",
] as const;

export function parseTags(value: string) {
  return [...new Set(value.split(",").map((tag) => tag.trim()).filter(Boolean))].slice(0, 20);
}

export function clampWholeNumber(value: unknown, minimum = 0, maximum = 100000) {
  const parsed = Number(value ?? 0);
  if (!Number.isFinite(parsed)) return minimum;
  return Math.min(maximum, Math.max(minimum, Math.round(parsed)));
}

export function scoutingAwpEligible(record: {
  autoPinsScored: number;
  autoGoalsWithTwoPins: number;
  autoRobotsMidfield: number;
  autoContactedPerimeter: boolean;
  autoViolation: boolean;
}) {
  return (
    record.autoPinsScored >= 12 &&
    record.autoGoalsWithTwoPins >= 4 &&
    record.autoRobotsMidfield >= 1 &&
    !record.autoContactedPerimeter &&
    !record.autoViolation
  );
}

export function estimatedOverrideScore(record: {
  alliancePinsScored: number;
  yellowPinsOwned: number;
  robotsMidfield: number;
  autonomousWon: boolean;
}) {
  return (
    record.alliancePinsScored * 5 +
    record.yellowPinsOwned * 10 +
    record.robotsMidfield * 8 +
    (record.autonomousWon ? 12 : 0)
  );
}

export function inventoryAvailable(record: {
  quantityOnHand: number;
  quantityReserved: number;
}) {
  return Math.max(0, record.quantityOnHand - record.quantityReserved);
}
