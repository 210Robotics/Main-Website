import "server-only";

import { createHash } from "node:crypto";
import { headers } from "next/headers";

export async function publicRequestFingerprint(scope: string) {
  const requestHeaders = await headers();
  const address =
    requestHeaders.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    requestHeaders.get("x-real-ip") ||
    "unknown";
  const agent = requestHeaders.get("user-agent") || "unknown";
  const secret = process.env.FORM_FINGERPRINT_SECRET || process.env.CLERK_SECRET_KEY || scope;
  return createHash("sha256").update(`${secret}|${scope}|${address}|${agent}`).digest("hex");
}
