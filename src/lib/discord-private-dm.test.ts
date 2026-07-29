import { describe, expect, it } from "vitest";
import {
  extractDiscordDmModalReply,
  parseDiscordDmActionId,
  parseDiscordDmModalId,
} from "@/lib/discord-dm-interactions";

describe("Discord private-DM decisions", () => {
  it("parses supported manual and Gemini button actions", () => {
    expect(
      parseDiscordDmActionId("dm:manual:1531024729480101888"),
    ).toEqual({
      kind: "manual",
      inboundMessageId: "1531024729480101888",
    });
    expect(
      parseDiscordDmActionId("dm:gemini:1531024729480101888"),
    ).toEqual({
      kind: "gemini",
      inboundMessageId: "1531024729480101888",
    });
  });

  it("rejects malformed or unrelated component actions", () => {
    expect(parseDiscordDmActionId("dm:delete:1531024729480101888")).toBeNull();
    expect(parseDiscordDmActionId("dm:manual:not-a-discord-id")).toBeNull();
    expect(parseDiscordDmActionId("calendar:send")).toBeNull();
  });

  it("parses manual-reply modal IDs and extracts trimmed replies", () => {
    expect(
      parseDiscordDmModalId("dm:manual-submit:1531024729480101888"),
    ).toEqual({
      inboundMessageId: "1531024729480101888",
    });
    expect(
      extractDiscordDmModalReply([
        {
          components: [
            { custom_id: "ignored", value: "ignore me" },
            { custom_id: "reply", value: "  I can help with that.  " },
          ],
        },
      ]),
    ).toBe("I can help with that.");
  });
});
