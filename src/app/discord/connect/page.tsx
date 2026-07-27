import type { Metadata } from "next";
import Link from "next/link";
import { and, eq, gt, isNull } from "drizzle-orm";
import { getDb, hasDatabase } from "@/db";
import { discordGuildMembers, discordLinkTokens } from "@/db/schema";
import { connectDiscordAccount } from "@/app/discord/connect/actions";
import { getCurrentMember } from "@/lib/auth";
import { discordTokenHash } from "@/lib/discord";

export const metadata: Metadata = {
  title: "Connect Discord",
  robots: { index: false, follow: false },
};

const errorMessages: Record<string, string> = {
  invalid: "That account-link is not valid.",
  expired: "That account-link expired or has already been used.",
  missing: "The Discord member could not be found. Ask an officer to synchronize the server.",
  "already-linked": "That Discord identity is already connected to another member account.",
  "member-already-linked": "Your member account is already connected to another Discord identity in this server.",
};

export default async function DiscordConnectPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string; error?: string }>;
}) {
  const { token = "", error } = await searchParams;
  const member = await getCurrentMember();
  let link:
    | {
        username: string;
        displayName: string | null;
        expiresAt: Date;
      }
    | undefined;
  if (hasDatabase() && token.length >= 20) {
    [link] = await getDb()
      .select({
        username: discordLinkTokens.username,
        displayName: discordGuildMembers.displayName,
        expiresAt: discordLinkTokens.expiresAt,
      })
      .from(discordLinkTokens)
      .leftJoin(
        discordGuildMembers,
        and(
          eq(discordGuildMembers.guildId, discordLinkTokens.guildId),
          eq(
            discordGuildMembers.discordUserId,
            discordLinkTokens.discordUserId,
          ),
        ),
      )
      .where(
        and(
          eq(discordLinkTokens.tokenHash, discordTokenHash(token)),
          isNull(discordLinkTokens.usedAt),
          gt(discordLinkTokens.expiresAt, new Date()),
        ),
      )
      .limit(1);
  }
  const errorMessage = error ? errorMessages[error] : undefined;
  const redirectPath = `/discord/connect?token=${encodeURIComponent(token)}`;

  return (
    <section className="grid-bg min-h-[calc(100dvh-74px)] py-12 sm:py-20">
      <div className="shell">
        <div className="card mx-auto max-w-2xl overflow-hidden">
          <div className="border-b border-[#333] bg-[#15100c] p-6 sm:p-9">
            <p className="eyebrow">210 Robotics member connection</p>
            <h1 className="mt-4 text-3xl font-bold tracking-[-.04em] sm:text-4xl">
              Connect Discord to your account.
            </h1>
            <p className="mt-4 max-w-xl text-sm leading-7 text-[#aaa]">
              This lets the team recognize your Discord identity, show your own
              dues status privately, and combine server and member analytics.
            </p>
          </div>
          <div className="p-6 sm:p-9">
            {errorMessage || !link ? (
              <>
                <p className="text-lg font-semibold text-white">
                  {errorMessage || "This account-link is invalid or expired."}
                </p>
                <p className="mt-3 text-sm leading-7 text-[#999]">
                  Run <strong className="text-white">/register</strong> in the
                  team Discord to generate a fresh private link.
                </p>
                <Link className="button secondary mt-7" href="/">
                  Return to 210 Robotics
                </Link>
              </>
            ) : (
              <>
                <div className="grid gap-4 rounded-sm border border-[#383838] bg-[#0d0d0d] p-5 sm:grid-cols-2">
                  <div>
                    <p className="text-xs uppercase tracking-[.12em] text-[#777]">
                      Discord identity
                    </p>
                    <strong className="mt-2 block text-lg">
                      {link.displayName || link.username}
                    </strong>
                    <span className="text-sm text-[#888]">@{link.username}</span>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-[.12em] text-[#777]">
                      Website account
                    </p>
                    <strong className="mt-2 block text-lg">
                      {member?.displayName || "Sign in required"}
                    </strong>
                    <span className="text-sm text-[#888]">
                      {member?.email || "Use your team account"}
                    </span>
                  </div>
                </div>
                {member ? (
                  <form action={connectDiscordAccount} className="mt-7">
                    <input type="hidden" name="token" value={token} />
                    <button className="button w-full justify-center sm:w-auto">
                      Confirm secure connection
                    </button>
                    <p className="mt-4 text-xs leading-6 text-[#777]">
                      This private link expires{" "}
                      {link.expiresAt.toLocaleString()} and can be used once.
                    </p>
                  </form>
                ) : (
                  <div className="mt-7 flex flex-col gap-3 sm:flex-row">
                    <Link
                      className="button justify-center"
                      href={`/sign-in?redirect_url=${encodeURIComponent(redirectPath)}`}
                    >
                      Sign in and connect
                    </Link>
                    <Link
                      className="button secondary justify-center"
                      href={`/register?redirect_url=${encodeURIComponent(redirectPath)}`}
                    >
                      Create member account
                    </Link>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

