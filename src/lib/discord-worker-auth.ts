import "server-only";

import { timingSafeEqual } from "node:crypto";

export function discordWorkerRequestIsAuthorized(request: Request) {
  const expected = process.env.DISCORD_VOICE_WORKER_SECRET;
  const received = request.headers
    .get("authorization")
    ?.replace(/^Bearer\s+/i, "");
  if (!expected || !received) return false;
  const expectedBytes = Buffer.from(expected);
  const receivedBytes = Buffer.from(received);
  return (
    expectedBytes.length === receivedBytes.length &&
    timingSafeEqual(expectedBytes, receivedBytes)
  );
}
