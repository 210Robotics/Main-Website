import { getDonationSummary } from "@/lib/donations";

export const dynamic = "force-dynamic";

export async function GET() {
  const summary = await getDonationSummary();
  return Response.json(
    {
      netRaisedCents: summary.netRaisedCents,
      confirmedCount: summary.confirmedCount,
      last30DaysCents: summary.last30DaysCents,
    },
    { headers: { "cache-control": "no-store" } },
  );
}
