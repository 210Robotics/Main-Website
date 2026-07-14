import type { Metadata } from "next";
import { InquiryForm } from "@/components/inquiry-form";
import { PageHero } from "@/components/ui";
export const metadata:Metadata={title:"Contact"};
export default function Contact(){return <><PageHero eyebrow="Contact" title="Start a conversation." body="Questions about joining, collaboration, sponsorship, media, or an upcoming event? Send the team a note."/><section className="section"><div className="shell grid gap-12 lg:grid-cols-[.7fr_1.3fr]"><div><p className="eyebrow">210 Robotics</p><h2 className="headline">We’re listening.</h2><p className="lede mt-6">Based at UT San Antonio in San Antonio, Texas.</p><a className="mt-8 inline-block text-[#fd7803]" href="mailto:admin@210robotics.com">admin@210robotics.com</a></div><InquiryForm/></div></section></>}
