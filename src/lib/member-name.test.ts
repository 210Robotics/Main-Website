import { describe, expect, it } from "vitest";
import {
  canonicalMemberName,
  normalizedMemberNameParts,
} from "@/lib/member-name";

describe("member names", () => {
  it("builds a normal First Last name", () => {
    expect(
      canonicalMemberName({ firstName: "  Jacob ", lastName: " White " }),
    ).toBe("Jacob White");
  });

  it("does not duplicate a last name entered in the first-name field", () => {
    expect(
      normalizedMemberNameParts("Jacob White", "White"),
    ).toEqual({ firstName: "Jacob", lastName: "White" });
  });

  it("repairs a full name entered into both fields", () => {
    expect(
      normalizedMemberNameParts("Jacob White", "Jacob White"),
    ).toEqual({ firstName: "Jacob", lastName: "White" });
  });

  it("preserves compound names that are not duplicated", () => {
    expect(
      canonicalMemberName({ firstName: "Mary Ann", lastName: "De La Cruz" }),
    ).toBe("Mary Ann De La Cruz");
  });
});
