import type { Metadata } from "next";
import { InteractiveCalendar } from "@/components/interactive-calendar";
import { PageHero } from "@/components/ui";
import { getCalendarEvents } from "@/lib/calendar";

export const metadata:Metadata={title:"Events"};
export default async function EventsPage(){const events=await getCalendarEvents();return <><PageHero eyebrow="Events" title="Meetings, workshops, and build days." body="Explore the shared 210 Robotics calendar. Public updates appear here automatically in Central Time." image="/media/gallery/vexu/vexu-4.jpg"/><section className="section"><div className="shell"><InteractiveCalendar events={events}/></div></section></>}
