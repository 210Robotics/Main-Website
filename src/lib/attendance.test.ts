import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

describe("attendance tokens", () => {
  it("signs, verifies, and rejects altered tokens", async () => {
    process.env.ATTENDANCE_TOKEN_SECRET = "test-secret-with-enough-entropy";
    const { buildAttendanceToken, verifyAttendanceToken } = await import("@/lib/attendance");
    const created = buildAttendanceToken("00000000-0000-4000-8000-000000000000");
    expect(verifyAttendanceToken(created.token)?.id).toBe(created.id);
    expect(verifyAttendanceToken(`${created.token}x`)).toBeNull();
  });

  it("enforces opened, expiry, and revocation state", async () => {
    const { attendanceIsOpen } = await import("@/lib/attendance");
    const now = new Date("2026-07-14T18:00:00Z");
    expect(attendanceIsOpen({ openedAt: new Date("2026-07-14T17:00:00Z"), closesAt: null, tokenExpiresAt: new Date("2026-07-14T19:00:00Z"), tokenRevokedAt: null, now })).toBe(true);
    expect(attendanceIsOpen({ openedAt: now, closesAt: null, tokenExpiresAt: new Date("2026-07-14T19:00:00Z"), tokenRevokedAt: now, now })).toBe(false);
  });
});

