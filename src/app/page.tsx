import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  ArrowUpRight,
  Bot,
  CircuitBoard,
  Factory,
  GraduationCap,
  Trophy,
} from "lucide-react";
import { CTA, MemberCard, SectionHeading } from "@/components/ui";
import { InquiryModal } from "@/components/inquiry-form";
import { CalendarPreview } from "@/components/interactive-calendar";
import { MediaGallery } from "@/components/media-gallery";
import { getCalendarEvents } from "@/lib/calendar";
import {
  getPublicMedia,
  getPublicMemberCount,
  getPublicPosts,
} from "@/lib/content";
import { members, programs, sponsors } from "@/lib/site-data";

export default async function Home() {
  const [events, posts, media, memberCount] = await Promise.all([
    getCalendarEvents(),
    getPublicPosts(),
    getPublicMedia(),
    getPublicMemberCount(),
  ]);
  return (
    <>
      <section className="home-hero grid-bg">
        <Image
          src="/media/brand/makerspace.png"
          alt="210 Robotics students working in the makerspace"
          fill
          sizes="100vw"
          className="scale-[1.14] object-cover opacity-35"
          priority
        />
        <div className="absolute inset-0 bg-[linear-gradient(90deg,#080808_2%,rgba(8,8,8,.92)_48%,rgba(8,8,8,.42)_100%)]" />
        <div className="shell relative z-10 grid min-h-[calc(100vh-74px)] items-center gap-12 py-20 lg:grid-cols-[1.05fr_.95fr]">
          <div className="reveal">
            <p className="eyebrow">UT San Antonio · Student Engineering</p>
            <h1 className="display max-w-[880px]">
              Build what <span className="accent">comes next.</span>
            </h1>
            <p className="lede mt-7 max-w-2xl">
              We are 210 Robotics—a student-led team designing competition
              robots, autonomous systems, and a place for ambitious builders to
              grow.
            </p>
            <div className="mt-9 flex flex-wrap gap-3">
              <InquiryModal kind="join" label="Join the team" />
              <Link className="button secondary" href="/about">
                Discover 210
                <ArrowRight size={16} />
              </Link>
            </div>
          </div>
          <div className="hero-logo-stage" aria-label="210 Robotics program system">
            <div className="hero-logo-glow" />
            <div className="hero-logo-orbit" />
            <div className="hero-logo-scan" />
            <Image
              src="/media/brand/210-banner.png"
              alt="210 Robotics logo"
              fill
              sizes="(max-width:1024px) 80vw, 42vw"
              className="hero-logo-mark object-contain"
              priority
            />
            <Link href="/programs/vex-u" className="hero-legend hero-legend-vex">
              <span>01</span><strong>VEX U</strong><small>COMPETE</small>
            </Link>
            <Link href="/programs/sidc" className="hero-legend hero-legend-sidc">
              <span>02</span><strong>SIDC</strong><small>INNOVATE</small>
            </Link>
            <Link href="/projects/roborowdy" className="hero-legend hero-legend-rowdy">
              <span>03</span><strong>ROBOROWDY</strong><small>AUTOMATE</small>
            </Link>
            <p className="hero-logo-label">THREE PROGRAMS // ONE MISSION</p>
          </div>
        </div>
        <div className="absolute bottom-0 right-0 hidden border-l border-t border-[#333] bg-black/70 backdrop-blur md:grid md:grid-cols-3">
          <Stat n="03" t="Major programs" />
          <Stat n={String(memberCount).padStart(2, "0")} t="Current members" />
          <Stat n="01" t="Shared mission" />
        </div>
      </section>
      <section className="section">
        <div className="shell">
          <SectionHeading
            eyebrow="Where you can build"
            title="3 major programs. 1 mission."
            body="VEX U, SIDC, and RoboRowdy give members different ways to build—connected by one organization and one shared standard of engineering excellence."
          />
          <div className="grid gap-5 lg:grid-cols-3">
            {programs.map((program, index) => (
              <Link
                href={program.href}
                key={program.title}
                className="group card block overflow-hidden transition hover:-translate-y-1 hover:border-[#fd7803]/60"
              >
                <div className="relative h-64 overflow-hidden">
                  <Image
                    src={program.image}
                    alt=""
                    fill
                    sizes="(max-width:1024px) 100vw, 33vw"
                    className="object-cover transition duration-500 group-hover:scale-105"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-transparent" />
                  <span className="absolute left-5 top-5 tag bg-black/70">
                    0{index + 1}
                  </span>
                </div>
                <div className="p-7">
                  <p className="eyebrow">{program.eyebrow}</p>
                  <div className="mt-5 flex items-start justify-between gap-3">
                    <h3 className="text-3xl font-bold tracking-[-.04em]">
                      {program.title}
                    </h3>
                    <ArrowUpRight className="text-[#fd7803] transition group-hover:-translate-y-1 group-hover:translate-x-1" />
                  </div>
                  <p className="mt-4 text-sm leading-7 text-[#aaa]">
                    {program.description}
                  </p>
                  <div className="mt-7 border-t border-[#333] pt-5">
                    <strong className="text-2xl text-[#fd7803]">
                      {program.metric}
                    </strong>
                    <span className="ml-3 font-mono text-[.64rem] uppercase tracking-wider text-[#777]">
                      {program.metricLabel}
                    </span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>
      <section className="section border-y border-[#332516] bg-[#0d0d0d]">
        <div className="shell grid gap-12 lg:grid-cols-[.8fr_1.2fr] lg:items-center">
          <div>
            <Trophy className="text-[#fd7803]" size={42} />
            <p className="eyebrow mt-7">Global winner</p>
            <h2 className="headline">RoboRowdy won SIDC.</h2>
            <p className="lede mt-6">
              The Siemens Immersive Design Challenge win recognized a complete
              autonomous workflow for more productive, sustainable industrial
              3D-print farms.
            </p>
            <Link className="button mt-8" href="/programs/sidc">
              Explore the winning project
              <ArrowRight size={16} />
            </Link>
          </div>
          <div className="relative min-h-[500px] overflow-hidden border border-[#fd7803]/40">
            <Image
              src="https://news.utsa.edu/wp-content/uploads/2026/07/robo-rowdy-detroit.jpg"
              alt="The RoboRowdy team at Siemens Realize LIVE in Detroit"
              fill
              sizes="(max-width:1024px) 100vw, 60vw"
              className="object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-transparent to-transparent" />
            <span className="absolute bottom-6 left-6 tag border-[#fd7803] bg-black/70 text-[#fd7803]">
              Siemens Immersive Design Challenge winner
            </span>
          </div>
        </div>
      </section>
      <section className="section">
        <div className="shell">
          <SectionHeading
            eyebrow="Shared team calendar"
            title="Build days, reviews, and workshops."
            body="The public calendar is synchronized directly from Google Calendar in Central Time."
            action={{ label: "Full calendar", href: "/events" }}
          />
          <CalendarPreview events={events} />
        </div>
      </section>
      <section className="section border-y border-[#282828] bg-[#0d0d0d] grid-bg">
        <div className="shell grid gap-14 lg:grid-cols-[.8fr_1.2fr]">
          <div>
            <p className="eyebrow">Engineers are made</p>
            <h2 className="headline">Your major is only the beginning.</h2>
            <p className="lede mt-6">
              The team is a working laboratory: design reviews, failure
              analysis, fabrication, software releases, sponsor conversations,
              and competition pressure.
            </p>
            <div className="mt-9 grid grid-cols-2 gap-px bg-[#333]">
              <Mini icon={<CircuitBoard />} title="Design" />
              <Mini icon={<Bot />} title="Build" />
              <Mini icon={<Factory />} title="Deploy" />
              <Mini icon={<GraduationCap />} title="Lead" />
            </div>
          </div>
          <div className="relative min-h-[520px] overflow-hidden border border-[#fd7803]/40">
            <Image
              src="/media/gallery/vexu/vexu-4.jpg"
              alt="Students collaborating on a robotics project"
              fill
              sizes="(max-width:1024px) 100vw, 60vw"
              className="object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-transparent to-transparent" />
            <div className="absolute bottom-0 p-7">
              <span className="tag">Hands-on from day one</span>
              <p className="mt-4 max-w-lg text-xl font-semibold leading-8">
                No experience requirement. We teach the tools, pair new members
                with project leads, and put ideas into motion.
              </p>
            </div>
          </div>
        </div>
      </section>
      <section className="section">
        <div className="shell">
          <SectionHeading
            eyebrow="Media library"
            title="The work is better up close."
            body="Photos from the shared team Drive show the process—not just the finished result."
            action={{ label: "Open gallery", href: "/media" }}
          />
          <MediaGallery items={media} limit={6} />
        </div>
      </section>
      <section className="section border-y border-[#282828] bg-[#0d0d0d]">
        <div className="shell">
          <SectionHeading
            eyebrow="Meet the team"
            title="Student-led means student-built."
            body="Organization officers create the systems, culture, and momentum that let every member do their best work."
            action={{ label: "Full team", href: "/members" }}
          />
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {members
              .filter((member) => member.featured)
              .slice(0, 4)
              .map((member) => (
                <MemberCard key={member.id} member={member} />
              ))}
          </div>
        </div>
      </section>
      <section className="section">
        <div className="shell">
          <SectionHeading
            eyebrow="Field notes"
            title="From the shop floor."
            action={{ label: "All stories", href: "/news" }}
          />
          <div className="grid gap-5 md:grid-cols-3">
            {posts.slice(0, 3).map((post) => (
              <Link
                href={`/news/${post.slug}`}
                className="group card overflow-hidden"
                key={post.slug}
              >
                <div className="relative h-52">
                  <Image
                    src={post.image}
                    alt=""
                    fill
                    sizes="33vw"
                    className="object-cover transition duration-500 group-hover:scale-105"
                  />
                </div>
                <div className="p-6">
                  <p className="font-mono text-[.65rem] uppercase tracking-wider text-[#fd7803]">
                    {post.publishedAt.toLocaleDateString("en-US", {
                      month: "long",
                      year: "numeric",
                    })}
                  </p>
                  <h3 className="mt-3 text-xl font-bold leading-7">
                    {post.title}
                  </h3>
                  <p className="mt-3 text-sm leading-6 text-[#888]">
                    {post.excerpt}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>
      <section className="section border-y border-[#282828] bg-[#0d0d0d]">
        <div className="shell">
          <SectionHeading
            eyebrow="Partners"
            title="Progress is a team sport."
            action={{ label: "Become a sponsor", href: "/sponsors" }}
          />
          <div className="grid gap-px bg-[#2b2b2b] sm:grid-cols-3">
            {sponsors.map((sponsor) => (
              <div className="bg-[#0d0d0d] p-8" key={sponsor.name}>
                <div className="relative h-24">
                  <Image
                    src={sponsor.image}
                    alt={sponsor.name}
                    fill
                    sizes="250px"
                    className="object-contain"
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
      <CTA />
    </>
  );
}

function Stat({ n, t }: { n: string; t: string }) {
  return (
    <div className="min-w-36 border-r border-[#333] px-6 py-5 last:border-0">
      <strong className="block text-2xl text-[#fd7803]">{n}</strong>
      <span className="mt-1 block font-mono text-[.6rem] uppercase tracking-wider text-[#888]">
        {t}
      </span>
    </div>
  );
}
function Mini({ icon, title }: { icon: React.ReactNode; title: string }) {
  return (
    <div className="flex items-center gap-3 bg-[#0d0d0d] p-5 text-sm font-bold text-[#ccc]">
      <span className="text-[#fd7803]">{icon}</span>
      {title}
    </div>
  );
}
