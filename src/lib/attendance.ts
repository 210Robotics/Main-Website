import "server-only";

import { createHash, createHmac, randomUUID, timingSafeEqual } from "node:crypto";
export { activityTypeLabels, trainingTopics } from "@/lib/activity-options";

function attendanceSecret() {
  const secret = process.env.ATTENDANCE_TOKEN_SECRET || process.env.CLERK_SECRET_KEY;
  if (!secret) throw new Error("ATTENDANCE_TOKEN_SECRET is not configured.");
  return secret;
}

export function hashAttendanceToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function buildAttendanceToken(id: string = randomUUID()) {
  const signature = createHmac("sha256", attendanceSecret()).update(id).digest("base64url");
  return { id, token: `${id}.${signature}` };
}

export function verifyAttendanceToken(token: string) {
  const [id, suppliedSignature, ...rest] = token.split(".");
  if (rest.length || !id || !suppliedSignature || !/^[0-9a-f-]{36}$/i.test(id)) return null;
  const expected = createHmac("sha256", attendanceSecret()).update(id).digest("base64url");
  const suppliedBuffer = Buffer.from(suppliedSignature);
  const expectedBuffer = Buffer.from(expected);
  if (suppliedBuffer.length !== expectedBuffer.length || !timingSafeEqual(suppliedBuffer, expectedBuffer)) return null;
  return { id, tokenHash: hashAttendanceToken(token) };
}

export function attendanceIsOpen(input: {
  openedAt: Date | null;
  closesAt: Date | null;
  tokenExpiresAt: Date;
  tokenRevokedAt: Date | null;
  now?: Date;
}) {
  const now = input.now ?? new Date();
  return Boolean(
    input.openedAt &&
      !input.tokenRevokedAt &&
      now >= input.openedAt &&
      now <= input.tokenExpiresAt &&
      (!input.closesAt || now <= input.closesAt),
  );
}

export function attendanceUrl(token: string) {
  const base = (process.env.NEXT_PUBLIC_SITE_URL || "https://210robotics.com").replace(/\/$/, "");
  return `${base}/attendance/check-in/${encodeURIComponent(token)}`;
}
