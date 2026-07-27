import type { Metadata } from "next";
import { InteractiveCalendar } from "@/components/interactive-calendar";
import { PageHero } from "@/components/ui";
import { getCalendarEvents } from "@/lib/calendar";
import { getWebsitePageContent } from "@/lib/site-content";

export const metadata: Metadata = { title: "Events" };

export default async function EventsPage() {
  const [events, content] = await Promise.all([
    getCalendarEvents(),
    getWebsitePageContent("events"),
  ]);
  return (
    <>
      <PageHero
        eyebrow={content.heroEyebrow}
        title={content.heroTitle}
        body={content.heroBody}
        image={content.heroImage}
      />
      <section className="section">
        <div className="shell">
          <InteractiveCalendar events={events} />
        </div>
      </section>
    </>
  );
}
