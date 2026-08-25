import { describe, expect, it } from "vitest";
import { hasSensitiveEngineeringAttachment, redactLikelySecrets } from "./discord-content-protection";

describe("Discord content protection", () => {
  it("redacts likely secrets without retaining their value", () => {
    const source = `token ${["sk", "live"].join("_")}_abcdefghijklmnopqrstuvwxyz123456`;
    const result = redactLikelySecrets(source);
    expect(result.matches).toBe(1);
    expect(result.redacted).toBe("token [REDACTED SECRET]");
    expect(result.redacted).not.toContain("abcdefghijklmnopqrstuvwxyz");
  });

  it("detects engineering files but not ordinary media", () => {
    expect(hasSensitiveEngineeringAttachment(["drivetrain.STEP"])).toBe(true);
    expect(hasSensitiveEngineeringAttachment(["team-photo.jpg"])).toBe(false);
  });
});
