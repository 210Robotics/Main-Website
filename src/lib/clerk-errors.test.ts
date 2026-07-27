import { ClerkAPIResponseError } from "@clerk/nextjs/errors";
import { describe, expect, it } from "vitest";
import { isMissingClerkUserError } from "@/lib/clerk-errors";

describe("isMissingClerkUserError", () => {
  it("accepts a Clerk user-not-found response as already deleted", () => {
    const error = new ClerkAPIResponseError("Not found", {
      status: 404,
      data: [],
    });
    expect(isMissingClerkUserError(error)).toBe(true);
  });

  it("does not hide real Clerk or network failures", () => {
    const serverError = new ClerkAPIResponseError("Server error", {
      status: 500,
      data: [],
    });
    expect(isMissingClerkUserError(serverError)).toBe(false);
    expect(isMissingClerkUserError(new Error("Network unavailable"))).toBe(false);
  });
});
