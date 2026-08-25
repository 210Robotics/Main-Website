import { describe, expect, it } from "vitest";
import { parseDiscordVerificationApplication } from "@/lib/discord-verification";

describe("parseDiscordVerificationApplication", () => {
  it("normalizes a Cash App student application", () => {
    const result = parseDiscordVerificationApplication({
      firstName: "  Jacob ",
      lastName: " White  ",
      universityEmail: "JACOB@MY.UTSA.EDU",
      academicLevel: "Senior",
      duesMethod: "paid with CashApp",
    });
    expect(result).toEqual({
      success: true,
      data: {
        firstName: "Jacob",
        lastName: "White",
        universityEmail: "jacob@my.utsa.edu",
        academicLevel: "SENIOR",
        duesMethod: "CASH_APP",
      },
    });
  });

  it("recognizes a fundraising waiver request without approving it", () => {
    const result = parseDiscordVerificationApplication({
      firstName: "Alex",
      lastName: "Rivera",
      universityEmail: "alex@my.utsa.edu",
      academicLevel: "Masters",
      duesMethod: "$100+ donations attributed to me",
    });
    expect(result.success && result.data.duesMethod).toBe("FUNDRAISING");
  });

  it("rejects an address outside the verified student domain", () => {
    const result = parseDiscordVerificationApplication({
      firstName: "Alex",
      lastName: "Rivera",
      universityEmail: "alex@gmail.com",
      academicLevel: "Junior",
      duesMethod: "Zelle",
    });
    expect(result.success).toBe(false);
  });
});
