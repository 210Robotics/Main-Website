import type { Metadata } from "next";
import Link from "next/link";
import { asc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import {
  engineeringParts,
  inventoryItems,
  manufacturingSteps,
} from "@/db/schema";
import { requireActiveMember } from "@/lib/auth";

export const metadata: Metadata = {
  title: "Part traveler",
  robots: { index: false, follow: false },
};

export default async function PartTravelerPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireActiveMember();
  const { id } = await params;
  const [part] = await getDb()
    .select()
    .from(engineeringParts)
    .where(eq(engineeringParts.id, id))
    .limit(1);
  if (!part)
    return (
      <main className="shell py-20">
        <div className="card p-10">
          <h1 className="text-3xl font-bold">Part not found</h1>
          <Link className="button mt-6" href="/shop">
            Return to queue
          </Link>
        </div>
      </main>
    );
  const [steps, stock] = await Promise.all([
    getDb()
      .select()
      .from(manufacturingSteps)
      .where(eq(manufacturingSteps.partId, id))
      .orderBy(asc(manufacturingSteps.sequence)),
    getDb().select().from(inventoryItems).where(eq(inventoryItems.partId, id)),
  ]);
  return (
    <main className="min-h-screen bg-[#090909] grid-bg">
      <div className="shell py-10">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="eyebrow">210 Robotics digital part traveler</p>
            <h1 className="mt-3 text-4xl font-black">
              {part.partNumber} · {part.name}
            </h1>
            <p className="mt-3 text-sm text-[#888]">
              Revision {part.revision} · Quantity {part.quantity} ·{" "}
              {part.project} / {part.subsystem}
            </p>
          </div>
          <Link className="button secondary" href="/shop">
            Shop queue
          </Link>
        </div>
        <div className="mt-8 grid gap-6 xl:grid-cols-[.8fr_1.2fr]">
          <section className="card p-6">
            <h2 className="text-xl font-bold">Current definition</h2>
            <dl className="mt-5 grid gap-4 text-sm">
              <Item label="Lifecycle" value={part.lifecycleStatus} />
              <Item label="Verification" value={part.verificationStatus} />
              <Item label="Material" value={part.material || "Not specified"} />
              <Item
                label="Stock size"
                value={part.stockSize || "Not specified"}
              />
              <Item
                label="Method"
                value={part.manufacturingMethod || part.makeBuy}
              />
              <Item
                label="CAD / CAM / CAE"
                value={`${part.cadStatus} / ${part.camStatus} / ${part.caeStatus}`}
              />
              <Item label="Drawing" value={part.drawingStatus} />
              <Item
                label="Inventory"
                value={
                  stock.length
                    ? stock
                        .map(
                          (item) =>
                            `${item.sku}: ${item.quantityOnHand} at ${item.location}`,
                        )
                        .join(" · ")
                    : "Not linked"
                }
              />
            </dl>
            <div className="mt-6 flex flex-wrap gap-3">
              {part.drawingUrl && (
                <a
                  className="button"
                  href={part.drawingUrl}
                  target="_blank"
                  rel="noreferrer"
                >
                  Open drawing
                </a>
              )}
              {part.cadUrl && (
                <a
                  className="button secondary"
                  href={part.cadUrl}
                  target="_blank"
                  rel="noreferrer"
                >
                  Open CAD
                </a>
              )}
              {part.sourceUrl && (
                <a
                  className="button secondary"
                  href={part.sourceUrl}
                  target="_blank"
                  rel="noreferrer"
                >
                  Source / supplier
                </a>
              )}
            </div>
          </section>
          <section className="card p-6">
            <h2 className="text-xl font-bold">Manufacturing instructions</h2>
            <div className="mt-5 divide-y divide-[#333]">
              {steps.map((step) => (
                <article className="py-5" key={step.id}>
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <span className="tag">Operation {step.sequence}</span>
                      <h3 className="mt-3 text-lg font-bold">{step.process}</h3>
                      <p className="mt-1 text-xs text-[#777]">
                        {step.machine || "General shop"} · {step.status}
                      </p>
                    </div>
                  </div>
                  {step.setup && (
                    <p className="mt-4 text-sm leading-7 text-[#bbb]">
                      <strong>Setup:</strong> {step.setup}
                    </p>
                  )}
                  {step.instructions && (
                    <p className="mt-2 whitespace-pre-wrap text-sm leading-7 text-[#bbb]">
                      <strong>Instructions:</strong> {step.instructions}
                    </p>
                  )}
                  {step.inspectionCriteria && (
                    <p className="mt-2 text-sm leading-7 text-[#bbb]">
                      <strong>Verify:</strong> {step.inspectionCriteria}
                    </p>
                  )}
                </article>
              ))}
              {!steps.length && (
                <p className="py-8 text-sm text-[#777]">
                  No manufacturing operations are attached yet.
                </p>
              )}
            </div>
          </section>
        </div>
        {part.notes && (
          <section className="card mt-6 p-6">
            <h2 className="text-xl font-bold">Notes</h2>
            <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-[#aaa]">
              {part.notes}
            </p>
          </section>
        )}
      </div>
    </main>
  );
}
function Item({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-[110px_1fr] gap-3 border-b border-[#2d2d2d] pb-3">
      <dt className="text-[#777]">{label}</dt>
      <dd className="font-semibold">{value}</dd>
    </div>
  );
}
