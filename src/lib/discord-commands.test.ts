import { describe, expect, it } from "vitest";
import { discordApplicationCommands } from "@/lib/discord-commands";

describe("Discord guild commands", () => {
  it("registers the member and administrator command set exactly once", () => {
    const names = discordApplicationCommands.map((command) => command.name);
    expect(new Set(names).size).toBe(names.length);
    expect(names).toEqual(
      expect.arrayContaining([
        "ask",
        "record",
        "sync",
        "timeout",
      ]),
    );
    expect(names).not.toEqual(
      expect.arrayContaining(["logs", "calendar", "digest"]),
    );
  });

  it("keeps recording permission-protected and collects a title", () => {
    const record = discordApplicationCommands.find(
      (command) => command.name === "record",
    );
    expect(record).toMatchObject({
      default_member_permissions: "8",
      options: expect.arrayContaining([
        expect.objectContaining({
          name: "title",
          required: true,
        }),
        expect.objectContaining({
          name: "voice_channel",
          required: true,
        }),
      ]),
    });
  });
});
