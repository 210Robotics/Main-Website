import { createHash } from "node:crypto";
import nacl from "tweetnacl";

export function discordTokenHash(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function verifyDiscordSignature({
  body,
  timestamp,
  signature,
  publicKey = process.env.DISCORD_PUBLIC_KEY ?? "",
}: {
  body: string;
  timestamp: string;
  signature: string;
  publicKey?: string;
}) {
  try {
    if (!timestamp || signature.length !== 128 || publicKey.length !== 64) {
      return false;
    }
    return nacl.sign.detached.verify(
      Buffer.from(timestamp + body),
      Buffer.from(signature, "hex"),
      Buffer.from(publicKey, "hex"),
    );
  } catch {
    return false;
  }
}

