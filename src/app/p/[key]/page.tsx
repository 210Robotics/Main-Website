import type { Metadata } from "next";
import { and, desc, eq, isNull, or, sql } from "drizzle-orm";
import { notFound } from "next/navigation";
import { getDb, hasDatabase } from "@/db";
import { availabilityPollResponses, availabilityPolls } from "@/db/schema";
import { PublicAvailabilityPoll } from "@/components/public-availability-poll";
import { getCurrentMember } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "210 Robotics Availability Poll",
  robots: { index: false, follow: false, nocache: true },
};

export default async function AvailabilityPollPage({
  params,
}: {
  params: Promise<{ key: string }>;
}) {
  if (!hasDatabase()) notFound();
  const { key } = await params;
  if (!/^[A-Za-z0-9_-]{24,80}$/.test(key)) notFound();
  const [poll] = await getDb()
    .select()
    .from(availabilityPolls)
    .where(eq(availabilityPolls.accessKey, key))
    .limit(1);
  if (!poll || poll.status === "DRAFT") notFound();
  const member = await getCurrentMember();
  const activeMember = member?.status === "ACTIVE" ? member : null;
  const [ownResponse] = activeMember
    ? await getDb()
        .select()
        .from(availabilityPollResponses)
        .where(
          and(
            eq(availabilityPollResponses.pollId, poll.id),
            or(
              eq(
                availabilityPollResponses.submittedByMemberId,
                activeMember.id,
              ),
              and(
                isNull(availabilityPollResponses.submittedByMemberId),
                sql`lower(${availabilityPollResponses.email}) = ${activeMember.email.toLowerCase()}`,
              ),
            ),
          ),
        )
        .orderBy(desc(availabilityPollResponses.updatedAt))
        .limit(1)
    : [];
  const responses = await getDb()
    .select({ availableSlots: availabilityPollResponses.availableSlots })
    .from(availabilityPollResponses)
    .where(eq(availabilityPollResponses.pollId, poll.id));
  return (
    <PublicAvailabilityPoll
      poll={{
        id: poll.id,
        accessKey: poll.accessKey,
        title: poll.title,
        description: poll.description,
        timezone: poll.timezone,
        dates: poll.dates,
        startTime: poll.startTime,
        endTime: poll.endTime,
        slotMinutes: poll.slotMinutes,
        status: poll.status,
        responseCount: poll.responseCount,
      }}
      responses={responses}
      identity={
        activeMember
          ? { name: activeMember.displayName, email: activeMember.email }
          : null
      }
      initialResponse={
        ownResponse
          ? {
              participantKey: ownResponse.participantKey,
              name: ownResponse.name,
              email: ownResponse.email,
              availableSlots: ownResponse.availableSlots,
            }
          : null
      }
    />
  );
}
