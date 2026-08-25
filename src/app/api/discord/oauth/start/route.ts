import { createHmac, randomBytes } from "node:crypto";
import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { getCurrentMember } from "@/lib/auth";

export const runtime = "nodejs";

function stateSecret() {
  return (
    process.env.DISCORD_OAUTH_STATE_SECRET ||
    process.env.DISCORD_VOICE_WORKER_SECRET ||
    ""
  );
}

export function signDiscordOAuthState(payload: string, secret: string) {
  const encoded = Buffer.from(payload).toString("base64url");
  const signature = createHmac("sha256", secret)
    .update(encoded)
    .digest("base64url");
  return `${encoded}.${signature}`;
}

export async function GET() {
  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || "https://210robotics.com").replace(/\/$/, "");
  const { userId } = await auth();
  const member = await getCurrentMember();
  if (!userId || !member) {
    return NextResponse.redirect(
      new URL("/sign-in?redirect_url=/verify", siteUrl),
    );
  }
  const clientId = process.env.DISCORD_APPLICATION_ID;
  const secret = stateSecret();
  if (!clientId || !secret) {
    return NextResponse.redirect(new URL("/verify?discord=unavailable", siteUrl));
  }
  const state = signDiscordOAuthState(
    JSON.stringify({
      memberId: member.id,
      clerkUserId: userId,
      nonce: randomBytes(18).toString("base64url"),
      issuedAt: Date.now(),
    }),
    secret,
  );
  const redirectUri = `${siteUrl}/api/discord/oauth/callback`;
  const authorize = new URL("https://discord.com/oauth2/authorize");
  authorize.searchParams.set("client_id", clientId);
  authorize.searchParams.set("response_type", "code");
  authorize.searchParams.set("redirect_uri", redirectUri);
  authorize.searchParams.set("scope", "identify");
  authorize.searchParams.set("state", state);
  authorize.searchParams.set("prompt", "consent");
  const response = NextResponse.redirect(authorize);
  response.cookies.set("discord_oauth_state", state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/api/discord/oauth/callback",
    maxAge: 10 * 60,
  });
  return response;
}
