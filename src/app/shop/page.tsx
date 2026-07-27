import type { Metadata } from "next";
import Link from "next/link";
import { asc, eq, ne } from "drizzle-orm";
import { getDb } from "@/db";
import { engineeringParts, manufacturingSteps, members } from "@/db/schema";
import { requireActiveMember } from "@/lib/auth";
import { AutoRefresh } from "@/components/auto-refresh";

export const metadata: Metadata = {
  title: "Manufacturing queue",
  robots: { index: false, follow: false },
};

export default async function ShopMonitorPage() {
  await requireActiveMember();
  const [parts, steps, people] = await Promise.all([
    getDb()
      .select()
      .from(engineeringParts)
      .where(ne(engineeringParts.lifecycleStatus, "COMPLETE"))
      .orderBy(engineeringParts.dueAt, asc(engineeringParts.partNumber)),
    getDb()
      .select()
      .from(manufacturingSteps)
      .orderBy(asc(manufacturingSteps.sequence)),
    getDb()
      .select({ id: members.id, name: members.displayName })
      .from(members)
      .where(eq(members.status, "ACTIVE")),
  ]);
  const names = new Map(people.map((person) => [person.id, person.name]));
  return (
    <main className="min-h-screen bg-[#050505] p-5 md:p-8">
      <AutoRefresh seconds={30} />
      <header className="flex flex-wrap items-end justify-between gap-5 border-b border-[#333] pb-6">
        <div>
          <p className="eyebrow">210 Robotics shop monitor</p>
          <h1 className="mt-2 text-4xl font-black tracking-[-.04em] md:text-6xl">
            Manufacturing queue
          </h1>
          <p className="mt-3 text-sm text-[#888]">
            Live queue · refreshes every 30 seconds
          </p>
        </div>
        <Link
          className="button secondary"
          href="/admin/control-center?tab=shop"
        >
          Manage queue and print labels
        </Link>
      </header>
      <div className="mt-6 grid gap-5 md:grid-cols-2 2xl:grid-cols-3">
        {parts.map((part, index) => {
          const operations = steps.filter((step) => step.partId === part.id);
          const complete = operations.filter(
            (step) => step.status === "COMPLETE",
          ).length;
          const percent = operations.length
            ? Math.round((complete / operations.length) * 100)
            : 0;
          return (
            <article
              className="border border-[#3a3a3a] bg-[#111] p-5"
              key={part.id}
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <span className="font-mono text-sm font-bold text-[#fd7803]">
                    {String(index + 1).padStart(2, "0")} · {part.partNumber}
                  </span>
                  <h2 className="mt-2 text-2xl font-bold">
                    {part.name} × {part.quantity}
                  </h2>
                  <p className="mt-2 text-xs text-[#777]">
                    {part.subsystem} ·{" "}
                    {part.manufacturingMethod || part.makeBuy}
                  </p>
                </div>
                <span className="tag">{part.lifecycleStatus}</span>
              </div>
              <div className="mt-5 h-3 bg-[#2a2a2a]">
                <div
                  className="h-full bg-[#fd7803]"
                  style={{ width: `${percent}%` }}
                />
              </div>
              <div className="mt-4 grid gap-2">
                {operations.map((step) => (
                  <div
                    className="grid grid-cols-[34px_1fr_auto] items-center gap-3 border border-[#2d2d2d] p-3"
                    key={step.id}
                  >
                    <span className="font-mono text-xs text-[#777]">
                      {step.sequence}
                    </span>
                    <div>
                      <strong className="text-sm">{step.process}</strong>
                      <p className="mt-1 text-xs text-[#666]">
                        {step.machine || "General shop"}
                        {step.assignedToMemberId
                          ? ` · ${names.get(step.assignedToMemberId) ?? "Assigned"}`
                          : ""}
                      </p>
                    </div>
                    <span
                      className={
                        step.status === "COMPLETE"
                          ? "text-xs font-bold text-emerald-400"
                          : step.status === "BLOCKED"
                            ? "text-xs font-bold text-red-400"
                            : "text-xs font-bold text-[#fd7803]"
                      }
                    >
                      {step.status}
                    </span>
                  </div>
                ))}
                {!operations.length && (
                  <p className="border border-dashed border-[#333] p-4 text-sm text-[#777]">
                    Waiting for manufacturing instructions.
                  </p>
                )}
              </div>
            </article>
          );
        })}
        {!parts.length && (
          <div className="col-span-full grid min-h-80 place-items-center border border-[#333] bg-[#111]">
            <p className="text-2xl font-bold text-emerald-400">Queue clear</p>
          </div>
        )}
      </div>
    </main>
  );
}
