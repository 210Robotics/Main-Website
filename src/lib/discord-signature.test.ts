import { describe, expect, it } from "vitest";
import nacl from "tweetnacl";
import {
  discordTokenHash,
  verifyDiscordSignature,
} from "@/lib/discord-signature";

describe("Discord request verification", () => {
  it("accepts a correctly signed interaction and rejects tampering", () => {
    const keyPair = nacl.sign.keyPair();
    const body = JSON.stringify({ type: 1 });
    const timestamp = "1720000000";
    const signature = Buffer.from(
      nacl.sign.detached(
        Buffer.from(timestamp + body),
        keyPair.secretKey,
      ),
    ).toString("hex");
    const publicKey = Buffer.from(keyPair.publicKey).toString("hex");

    expect(
      verifyDiscordSignature({ body, timestamp, signature, publicKey }),
    ).toBe(true);
    expect(
      verifyDiscordSignature({
        body: `${body} `,
        timestamp,
        signature,
        publicKey,
      }),
    ).toBe(false);
  });

  it("hashes account-link tokens without storing their raw value", () => {
    expect(discordTokenHash("private-link")).toHaveLength(64);
    expect(discordTokenHash("private-link")).not.toBe("private-link");
  });
});

