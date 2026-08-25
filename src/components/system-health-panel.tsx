import { desc, eq, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { calendarSnapshots, discordGuilds, donations, syncJobRuns } from "@/db/schema";
import { discordVoiceWorkerConfiguration } from "@/lib/discord-voice-worker";

type Health = "Healthy" | "Warning" | "Error" | "Unknown";

function tone(status: Health) {
  if (status === "Healthy") return "border-emerald-800 text-emerald-300";
  if (status === "Warning") return "border-amber-800 text-amber-300";
  if (status === "Error") return "border-red-800 text-red-300";
  return "border-[#555] text-[#aaa]";
}

export async function SystemHealthPanel() {
  const [calendar, guild, donation, jobs] = await Promise.all([
    getDb().select({
      syncedAt: calendarSnapshots.syncedAt,
      isFresh: sql<boolean>`${calendarSnapshots.syncedAt} >= now() - interval '36 hours'`,
    }).from(calendarSnapshots).where(eq(calendarSnapshots.id, "shared")).limit(1),
    getDb().select().from(discordGuilds).orderBy(desc(discordGuilds.updatedAt)).limit(1),
    getDb().select({ updatedAt: donations.updatedAt }).from(donations).orderBy(desc(donations.updatedAt)).limit(1),
    getDb().select().from(syncJobRuns).orderBy(desc(syncJobRuns.attemptedAt)).limit(12),
  ]);
  let voice: { status: Health; detail: string } = { status: "Unknown", detail: "Worker is not configured." };
  if (discordVoiceWorkerConfiguration().configured) {
    try {
      const baseUrl = process.env.DISCORD_VOICE_WORKER_URL?.replace(/\/$/, "");
      const response = await fetch(`${baseUrl}/health`, { cache: "no-store", signal: AbortSignal.timeout(8_000) });
      const payload = (await response.json()) as { ok?: boolean; activeRecordings?: number; uptimeSeconds?: number };
      voice = {
        status: response.ok && payload.ok ? "Healthy" : "Warning",
        detail: response.ok
          ? `${payload.activeRecordings || 0} active · process uptime ${payload.uptimeSeconds || 0}s`
          : `Worker returned ${response.status}.`,
      };
    } catch (error) {
      voice = { status: "Error", detail: error instanceof Error ? error.message : "Worker did not respond." };
    }
  }
  const lastJobError = jobs.find((job) => job.status === "ERROR");
  const items: Array<{ name: string; status: Health; detail: string }> = [
    { name: "Website & database", status: "Healthy", detail: "Admin request and database queries succeeded." },
    { name: "Clerk", status: process.env.CLERK_SECRET_KEY ? "Healthy" : "Error", detail: process.env.CLERK_SECRET_KEY ? "Server authentication configured." : "Secret key is missing." },
    { name: "Discord Gateway", status: guild[0]?.lastSyncedAt ? "Healthy" : "Warning", detail: guild[0]?.lastSyncedAt ? `Last sync ${guild[0].lastSyncedAt.toLocaleString()}` : "No successful guild sync recorded." },
    { name: "Discord Voice", ...voice },
    { name: "Stripe", status: process.env.STRIPE_WEBHOOK_SECRET ? "Healthy" : "Error", detail: donation[0] ? `Latest donation update ${donation[0].updatedAt.toLocaleString()}` : "Webhook configured; no donation activity recorded." },
    { name: "Google Calendar", status: calendar[0]?.isFresh ? "Healthy" : calendar[0] ? "Warning" : "Error", detail: calendar[0] ? `Last successful snapshot ${calendar[0].syncedAt.toLocaleString()}` : "No calendar snapshot is available." },
    { name: "Scheduled jobs", status: lastJobError ? "Warning" : jobs.length ? "Healthy" : "Unknown", detail: lastJobError ? `${lastJobError.job}: ${lastJobError.error || "failed"}` : jobs.length ? `${jobs.length} recent runs recorded.` : "Runs will appear after the production migration." },
    { name: "Private file storage", status: process.env.PRIVATE_DOCUMENTS_READ_WRITE_TOKEN ? "Healthy" : "Error", detail: process.env.PRIVATE_DOCUMENTS_READ_WRITE_TOKEN ? "Private storage token configured." : "Private storage token is missing." },
  ];
  return (
    <div className="mt-8 border-t border-[#333] pt-6">
      <div><h3 className="text-lg font-bold">System health</h3><p className="mt-2 text-xs leading-5 text-[#888]">Private integration diagnostics. No secret values are displayed.</p></div>
      <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {items.map((item) => <div className="border border-[#333] bg-[#0d0d0d] p-4" key={item.name}><div className="flex items-center justify-between gap-3"><strong className="text-sm">{item.name}</strong><span className={`tag ${tone(item.status)}`}>{item.status}</span></div><p className="mt-3 break-words text-xs leading-5 text-[#777]">{item.detail}</p></div>)}
      </div>
    </div>
  );
}
