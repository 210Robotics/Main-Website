export type WebsiteContentField = {
  key: string;
  label: string;
  type: "text" | "textarea" | "image";
  defaultValue: string;
  help?: string;
};

export type WebsitePageDefinition = {
  id: string;
  label: string;
  route: string;
  description: string;
  fields: WebsiteContentField[];
};

const text = (key: string, label: string, defaultValue: string): WebsiteContentField => ({
  key,
  label,
  type: "text",
  defaultValue,
});
const area = (key: string, label: string, defaultValue: string): WebsiteContentField => ({
  key,
  label,
  type: "textarea",
  defaultValue,
});
const image = (key: string, label: string, defaultValue: string): WebsiteContentField => ({
  key,
  label,
  type: "image",
  defaultValue,
  help: "Upload a new image or paste a complete image URL.",
});

export const websitePages = [
  {
    id: "home",
    label: "Home",
    route: "/",
    description: "Homepage hero and the fixed copy and photography around live site data.",
    fields: [
      text("heroEyebrow", "Hero eyebrow", "UT San Antonio · Student Engineering"),
      text("heroTitle", "Hero title", "Build what"),
      text("heroAccent", "Hero accent", "comes next."),
      area("heroBody", "Hero introduction", "We are 210 Robotics—a student-led team designing competition robots, autonomous systems, and a place for ambitious builders to grow."),
      image("heroImage", "Hero background", "/media/brand/makerspace.png"),
      text("programsEyebrow", "Programs eyebrow", "Where you can build"),
      text("programsTitle", "Programs title", "3 major programs. 1 mission."),
      area("programsBody", "Programs introduction", "VEX U, SIDC, and RoboRowdy give members different ways to build—connected by one organization and one shared standard of engineering excellence."),
      text("program1Eyebrow", "VEX U card eyebrow", "Competitive robotics"),
      text("program1Title", "VEX U card title", "VEX U"),
      area("program1Body", "VEX U card description", "Two robots. One alliance. A full season of CAD, fabrication, controls, autonomy, strategy, and iteration."),
      image("program1Image", "VEX U card photo", "/media/gallery/vexu/vexu-2.jpg"),
      text("program2Eyebrow", "SIDC card eyebrow", "Immersive engineering"),
      text("program2Title", "SIDC card title", "Siemens Design Challenge"),
      area("program2Body", "SIDC card description", "The global-winning team behind RoboRowdy used digital engineering, XR, simulation, and advanced manufacturing to solve a real industrial problem."),
      image("program2Image", "SIDC card photo", "https://news.utsa.edu/wp-content/uploads/2026/07/robo-rowdy-detroit.jpg"),
      text("program3Eyebrow", "RoboRowdy card eyebrow", "Autonomous systems"),
      text("program3Title", "RoboRowdy card title", "RoboRowdy"),
      area("program3Body", "RoboRowdy card description", "An autonomous print-farm assistant designed to remove finished parts, reset build plates, and reduce downtime."),
      image("program3Image", "RoboRowdy card photo", "/media/gallery/siemens/siemens-2.jpg"),
      text("winnerEyebrow", "Winner eyebrow", "Global winner"),
      text("winnerTitle", "Winner title", "RoboRowdy won SIDC."),
      area("winnerBody", "Winner description", "The Siemens Immersive Design Challenge win recognized a complete autonomous workflow for more productive, sustainable industrial 3D-print farms."),
      text("winnerButton", "Winner button", "Explore the winning project"),
      image("winnerImage", "Winner photo", "https://news.utsa.edu/wp-content/uploads/2026/07/robo-rowdy-detroit.jpg"),
      text("calendarEyebrow", "Calendar eyebrow", "Shared team calendar"),
      text("calendarTitle", "Calendar title", "Build days, reviews, and workshops."),
      area("calendarBody", "Calendar description", "The public calendar is synchronized directly from Google Calendar in Central Time."),
      text("learningEyebrow", "Learning eyebrow", "Engineers are made"),
      text("learningTitle", "Learning title", "Your major is only the beginning."),
      area("learningBody", "Learning description", "The team is a working laboratory: design reviews, failure analysis, fabrication, software releases, sponsor conversations, and competition pressure."),
      image("learningImage", "Learning photo", "/media/gallery/vexu/vexu-4.jpg"),
      area("learningCaption", "Learning photo caption", "No experience requirement. We teach the tools, pair new members with project leads, and put ideas into motion."),
      text("mediaEyebrow", "Media eyebrow", "Media library"),
      text("mediaTitle", "Media title", "The work is better up close."),
      area("mediaBody", "Media description", "Photos from the shared team Drive show the process—not just the finished result."),
      text("teamEyebrow", "Team eyebrow", "Meet the team"),
      text("teamTitle", "Team title", "Student-led means student-built."),
      area("teamBody", "Team description", "Organization officers create the systems, culture, and momentum that let every member do their best work."),
      text("newsEyebrow", "News eyebrow", "Field notes"),
      text("newsTitle", "News title", "From the shop floor."),
    ],
  },
  {
    id: "about",
    label: "About",
    route: "/about",
    description: "About-page hero, mission, program overview, and fixed photography.",
    fields: [
      text("heroEyebrow", "Hero eyebrow", "About 210"),
      text("heroTitle", "Hero title", "Built to build people."),
      area("heroBody", "Hero introduction", "Founded for the 2026–27 season at UT San Antonio, 210 Robotics gives students a place to turn classroom knowledge into real machines, shared responsibility, and visible impact."),
      image("heroImage", "Hero photo", "/media/gallery/vexu/vexu-1.jpg"),
      text("missionEyebrow", "Mission eyebrow", "Our mission"),
      text("missionTitle", "Mission title", "Make engineering tangible."),
      area("missionBody", "Mission description", "We bring together students from every discipline to design, build, test, communicate, and lead. Competition creates urgency; ambitious projects create room to experiment; community keeps us moving forward with guidance from faculty advisor Don Petersen, Ph.D."),
      image("missionImage", "Mission photo", "/media/brand/makerspace.png"),
      text("value1Title", "Value 1 title", "Learn by doing"),
      area("value1Body", "Value 1 description", "Tools and theory stick when they are used to solve a real constraint."),
      text("value2Title", "Value 2 title", "Build across disciplines"),
      area("value2Body", "Value 2 description", "Mechanical, electrical, software, business, and media work as one system."),
      text("value3Title", "Value 3 title", "Leave the team stronger"),
      area("value3Body", "Value 3 description", "Every member documents, teaches, and creates an easier path for the next builder."),
      text("programsEyebrow", "Programs eyebrow", "How we build"),
      text("programsTitle", "Programs title", "One organization, three connected programs."),
      text("program1Title", "Program 1 title", "VEX U"),
      area("program1Body", "Program 1 description", "Competition engineering under hard constraints and a full-season development cycle."),
      text("program2Title", "Program 2 title", "SIDC"),
      area("program2Body", "Program 2 description", "Immersive design, digital engineering, advanced manufacturing, and industry collaboration."),
      text("program3Title", "Program 3 title", "RoboRowdy"),
      area("program3Body", "Program 3 description", "The global-winning autonomous system connecting physical robotics, software, and sustainable manufacturing."),
    ],
  },
  {
    id: "vex-u",
    label: "VEX U",
    route: "/programs/vex-u",
    description: "VEX U hero, overview, engineering lifecycle, plan, and roster headings.",
    fields: [
      text("heroEyebrow", "Hero eyebrow", "Competition engineering"),
      text("heroTitle", "Hero title", "VEX U, at full speed."),
      area("heroBody", "Hero introduction", "A student-run engineering program where strategy becomes CAD, CAD becomes hardware, and hardware has to perform under pressure."),
      image("heroImage", "Hero photo", "/media/gallery/vexu/vexu-2.jpg"),
      text("aboutEyebrow", "Overview eyebrow", "About VEX U"),
      text("aboutTitle", "Overview title", "College robotics, engineered under pressure."),
      area("aboutBody", "Overview description", "VEX U is the university division of the VEX Robotics Competition. Student teams design, build, program, and drive advanced V5 robots through a new game every season, balancing autonomous performance, match strategy, reliability, and rapid iteration."),
      area("aboutDetail", "Game description", "For 2026–27, that game is Override. Alliances score by stacking Pins and Cups on Goals, controlling field Toggles, and finishing in the contested Midfield. Each match opens with a 15-second autonomous period before 1:45 of driver-controlled play."),
      text("workEyebrow", "Lifecycle eyebrow", "The work"),
      text("workTitle", "Lifecycle title", "A full engineering lifecycle."),
      area("workBody", "Lifecycle description", "Members learn to navigate requirements, concept selection, prototype evidence, integration, controls, autonomous behavior, reliability, and driver practice."),
      image("workImage", "Lifecycle photo", "/media/gallery/vexu/vexu-5.jpg"),
      text("work1Title", "Lifecycle item 1 title", "Mechanical systems"),
      area("work1Body", "Lifecycle item 1 description", "CAD, fabrication, assembly, testing, serviceability, and spares."),
      text("work2Title", "Lifecycle item 2 title", "Controls and autonomy"),
      area("work2Body", "Lifecycle item 2 description", "Sensors, electrical architecture, motion control, software, and autonomous routines."),
      text("work3Title", "Lifecycle item 3 title", "Strategy and competition"),
      area("work3Body", "Lifecycle item 3 description", "Game analysis, scouting, logistics, documentation, and competition execution."),
      text("planEyebrow", "Plan eyebrow", "2026–27 build plan"),
      text("planTitle", "Plan title", "A focused path to competition readiness."),
      text("teamEyebrow", "Roster eyebrow", "Organization team"),
      text("teamTitle", "Roster title", "Every officer. Every builder."),
      area("teamBody", "Roster description", "Officers lead the whole organization, so all organization officers appear here with only their officer title. Other VEX U participants appear as members."),
    ],
  },
  {
    id: "sidc",
    label: "SIDC",
    route: "/programs/sidc",
    description: "SIDC winner page hero, project story, and team copy.",
    fields: [
      text("heroEyebrow", "Hero eyebrow", "Siemens Immersive Design Challenge · Global Winner"),
      text("heroTitle", "Hero title", "Design beyond the screen."),
      area("heroBody", "Hero introduction", "210 Robotics won the Siemens Immersive Design Challenge by combining immersive design, digital twins, simulation, automation, and advanced manufacturing into a practical industrial solution."),
      image("heroImage", "Hero photo", "https://news.utsa.edu/wp-content/uploads/2026/07/robo-rowdy-detroit.jpg"),
      text("challengeEyebrow", "Challenge eyebrow", "The winning challenge"),
      text("challengeTitle", "Challenge title", "From bottleneck to autonomous flow."),
      area("challengeBody", "Challenge description", "The team studied how additive-manufacturing farms lose valuable production time between prints. The answer became RoboRowdy: an autonomous assistant designed around the full operating workflow."),
      image("challengeImage", "Challenge photo", "/media/gallery/siemens/siemens-2.jpg"),
      text("step1Title", "Challenge item 1 title", "Discover"),
      area("step1Body", "Challenge item 1 description", "Map operators, failure points, constraints, and the real production environment."),
      text("step2Title", "Challenge item 2 title", "Design"),
      area("step2Body", "Challenge item 2 description", "Use collaborative CAD, simulation, and immersive review to evaluate concepts sooner."),
      text("step3Title", "Challenge item 3 title", "Demonstrate"),
      area("step3Body", "Challenge item 3 description", "Communicate the technical system, business impact, sustainability value, and path to deployment."),
      text("teamEyebrow", "Roster eyebrow", "Winning SIDC team"),
      text("teamTitle", "Roster title", "One system needed many disciplines."),
      area("teamBody", "Roster description", "The official eight-student project roster is shown with each person’s RoboRowdy responsibility—not their organization officer title."),
    ],
  },
  {
    id: "roborowdy",
    label: "RoboRowdy",
    route: "/projects/roborowdy",
    description: "RoboRowdy hero, workflow, development story, and team copy.",
    fields: [
      text("heroEyebrow", "Hero eyebrow", "Autonomous production"),
      text("heroTitle", "Hero title", "Meet RoboRowdy."),
      area("heroBody", "Hero introduction", "The global-winning autonomous print-farm assistant designed to remove finished parts, clean and reset build plates, and start the next job with less human intervention."),
      image("heroImage", "Hero photo", "/media/gallery/siemens/siemens-2.jpg"),
      text("whyEyebrow", "Workflow eyebrow", "Why it matters"),
      text("whyTitle", "Workflow title", "The printer is fast. The handoff is not."),
      area("whyBody", "Workflow description", "In a print farm, every completed part can wait for an operator to unload it, prepare the surface, and begin again. RoboRowdy explores how autonomy can make the gaps between jobs shorter, safer, and more consistent."),
      image("whyImage", "Workflow photo", "/media/gallery/siemens/siemens-3.jpg"),
      text("step1Title", "Workflow item 1 title", "Remove"),
      area("step1Body", "Workflow item 1 description", "Identify a completed job and safely separate the part from the build surface."),
      text("step2Title", "Workflow item 2 title", "Reset"),
      area("step2Body", "Workflow item 2 description", "Clear debris and prepare the plate for consistent first-layer performance."),
      text("step3Title", "Workflow item 3 title", "Restart"),
      area("step3Body", "Workflow item 3 description", "Coordinate with the production queue so the next approved job can begin."),
      text("storyEyebrow", "Story eyebrow", "Development story"),
      text("storyTitle", "Story title", "A workflow, not just a robot."),
      area("storyBody", "Story description", "The strongest concept connects physical automation to human supervision, software orchestration, safety, maintenance, and measurable production value."),
      text("story1Title", "Story card 1 title", "Human-centered"),
      area("story1Body", "Story card 1 description", "Operators stay in control of exceptions, scheduling, maintenance, and quality decisions."),
      text("story2Title", "Story card 2 title", "Sustainable"),
      area("story2Body", "Story card 2 description", "Better utilization reduces idle energy, failed restarts, and wasted production capacity."),
      text("story3Title", "Story card 3 title", "Scalable"),
      area("story3Body", "Story card 3 description", "A modular workflow can grow from one printer cell to a connected fleet."),
      text("teamEyebrow", "Roster eyebrow", "RoboRowdy team"),
      text("teamTitle", "Roster title", "The people behind the system."),
      area("teamBody", "Roster description", "Project responsibilities are shown here instead of organization-wide officer titles."),
    ],
  },
  {
    id: "team",
    label: "Team",
    route: "/team",
    description: "Team-page hero and every roster section heading.",
    fields: [
      text("heroEyebrow", "Hero eyebrow", "The people of 210"),
      text("heroTitle", "Hero title", "Every machine is a team effort."),
      area("heroBody", "Hero introduction", "Officers set organization-wide direction. Members bring the curiosity and craft that make every system work."),
      image("heroImage", "Hero team photo", "/media/gallery/siemens/siemens-1.jpg"),
      text("leadershipEyebrow", "Leadership eyebrow", "Organization leadership"),
      text("leadershipTitle", "Leadership title", "Built and led by students."),
      area("leadershipBody", "Leadership description", "These titles apply across all of 210 Robotics—not to a separate branch."),
      text("contributorsEyebrow", "Contributors eyebrow", "Winning project"),
      text("contributorsTitle", "Contributors title", "RoboRowdy contributors."),
      area("contributorsBody", "Contributors description", "People who also serve as organization officers appear again here with their SIDC project responsibility."),
      text("advisorsEyebrow", "Advisors eyebrow", "Faculty support"),
      text("advisorsTitle", "Advisors title", "Guidance that helps the team grow."),
      text("membersEyebrow", "Members eyebrow", "Portal members"),
      text("membersTitle", "Members title", "The active 210 Robotics roster."),
      area("membersBody", "Members description", "This section updates automatically from approved portal accounts whose public profile is enabled."),
      text("mentorsEyebrow", "Mentors eyebrow", "Team mentors"),
      text("mentorsTitle", "Mentors title", "Experience behind the build."),
      area("mentorsBody", "Mentors description", "Approved mentors support technical reviews, project decisions, and the growth of student engineers. This list updates automatically from active public Mentor accounts."),
    ],
  },
  {
    id: "members",
    label: "Members",
    route: "/members",
    description: "Active public member-directory page copy.",
    fields: [
      text("heroEyebrow", "Hero eyebrow", "Public member directory"),
      text("heroTitle", "Hero title", "The builders behind 210."),
      area("heroBody", "Hero introduction", "This directory updates automatically from approved, active portal accounts and shows only public organization information."),
      image("heroImage", "Hero member photo", "/media/gallery/vexu/vexu-5.jpg"),
      text("directoryEyebrow", "Directory eyebrow", "Approved profiles"),
      area("directoryBody", "Directory description", "Names, organization titles, program groups, biographies, and approved photos are public. Emails, permissions, hours, and contribution records remain private."),
    ],
  },
  {
    id: "news",
    label: "News",
    route: "/news",
    description: "News index hero and section heading. Individual stories use the News editor.",
    fields: [
      text("heroEyebrow", "Hero eyebrow", "News and field notes"),
      text("heroTitle", "Hero title", "What we learn, we share."),
      area("heroBody", "Hero introduction", "Build updates, competition milestones, workshops, project stories, and the people behind the work."),
      image("heroImage", "Hero photo", "/media/gallery/siemens/siemens-3.jpg"),
      text("storiesEyebrow", "Stories eyebrow", "Latest stories"),
      text("storiesTitle", "Stories title", "From the shop floor."),
    ],
  },
  {
    id: "events",
    label: "Events",
    route: "/events",
    description: "Calendar page hero. Event records remain synchronized through the Events editor.",
    fields: [
      text("heroEyebrow", "Hero eyebrow", "Events"),
      text("heroTitle", "Hero title", "Meetings, workshops, and build days."),
      area("heroBody", "Hero introduction", "Explore the shared 210 Robotics calendar. Public updates appear here automatically in Central Time."),
      image("heroImage", "Hero photo", "/media/gallery/vexu/vexu-4.jpg"),
    ],
  },
  {
    id: "media",
    label: "Media",
    route: "/media",
    description: "Media-library page copy. Gallery records remain in the Media Gallery editor.",
    fields: [
      text("heroEyebrow", "Hero eyebrow", "Media library"),
      text("heroTitle", "Hero title", "Inside the build."),
      area("heroBody", "Hero introduction", "Meetings, design reviews, prototypes, competition preparation, and the people who make it all happen."),
      image("heroImage", "Hero photo", "/media/brand/makerspace.png"),
      text("galleryEyebrow", "Gallery eyebrow", "Shared Drive gallery"),
      text("galleryTitle", "Gallery title", "Work worth seeing."),
      area("galleryBody", "Gallery description", "New approved photos and MP4 videos synchronize from the 210 Robotics shared Drive and publish here automatically. Supported photos are converted for reliable browser viewing."),
    ],
  },
  {
    id: "donate",
    label: "Donate",
    route: "/donate",
    description: "Fundraiser photography and supporting public donation-page content. Campaign totals and payment settings remain in Finance.",
    fields: [
      image("teamImage", "Fundraiser team photo", "/media/gallery/siemens/siemens-1.jpg"),
      text("teamImageAlt", "Fundraiser photo description", "210 Robotics students standing together with their competition robot"),
      area("impactMessage", "Impact statement", "A gift to 210 Robotics becomes a part, a tool, a trip, a lesson, or the moment a student realizes they can build something real."),
    ],
  },
  {
    id: "sponsors",
    label: "Sponsors",
    route: "/sponsors",
    description: "Sponsor-page copy and hero photo. Sponsor logos and records use the Sponsors editor.",
    fields: [
      text("heroEyebrow", "Hero eyebrow", "Partnerships"),
      text("heroTitle", "Hero title", "Invest in the next build."),
      area("heroBody", "Hero introduction", "Sponsorship puts tools, parts, travel, software, and mentorship in the hands of student engineers—and connects partners with a deeply motivated technical community."),
      image("heroImage", "Hero photo", "/media/gallery/vexu/vexu-6.jpg"),
      text("partnersEyebrow", "Partners eyebrow", "Our partners"),
      text("partnersTitle", "Partners title", "Progress is a team sport."),
      text("levelsEyebrow", "Levels eyebrow", "Partnership levels"),
      text("levelsTitle", "Levels title", "A place for every kind of support."),
      area("levelsBody", "Levels description", "Tiers are a starting point. We also welcome in-kind materials, software, fabrication, technical workshops, and mentorship."),
      text("contactEyebrow", "Contact eyebrow", "Start a conversation"),
      text("contactTitle", "Contact title", "Let's build together."),
      area("contactBody", "Contact description", "Tell us what your organization cares about and we'll design a partnership around meaningful student impact."),
    ],
  },
  {
    id: "resources",
    label: "Resources",
    route: "/resources",
    description: "Public resources page copy. Resource links remain in the maintained resource list.",
    fields: [
      text("heroEyebrow", "Hero eyebrow", "Open knowledge"),
      text("heroTitle", "Hero title", "Tools for better builders."),
      area("heroBody", "Hero introduction", "A curated library for new members, experienced leads, mentors, and anyone following the team's engineering work."),
      text("libraryEyebrow", "Library eyebrow", "Google Drive library"),
      text("libraryTitle", "Library title", "Start where you are."),
      area("libraryBody", "Library description", "Only approved learning resources are linked publicly. Internal operations and financial files remain private."),
      area("privateNote", "Private-resource note", "Approved members can open internal resources from the portal after sign-in."),
    ],
  },
  {
    id: "join",
    label: "Join",
    route: "/join",
    description: "Recruitment page copy and hero photo. Form behavior stays unchanged.",
    fields: [
      text("heroEyebrow", "Hero eyebrow", "Join 210 Robotics"),
      text("heroTitle", "Hero title", "You don't need experience. You need curiosity."),
      area("heroBody", "Hero introduction", "Whether you want to design mechanisms, write autonomous code, run outreach, create media, or learn where you fit—we have a place to start."),
      image("heroImage", "Hero photo", "/media/gallery/vexu/vexu-3.jpg"),
      text("formEyebrow", "Form eyebrow", "Interest form"),
      text("formTitle", "Form title", "Build your first step."),
      area("formBody", "Form introduction", "Tell us what you want to explore. A team officer will follow up with the next meeting, onboarding details, and a path into active work."),
      area("whoAnswer", "Who can join answer", "Currently enrolled UT San Antonio students across all majors."),
      area("costAnswer", "Cost answer", "There are no member dues."),
      area("bringAnswer", "What to bring answer", "Curiosity, reliability, and a willingness to learn."),
    ],
  },
  {
    id: "contact",
    label: "Contact",
    route: "/contact",
    description: "Contact-page copy and public email. Form behavior stays unchanged.",
    fields: [
      text("heroEyebrow", "Hero eyebrow", "Contact"),
      text("heroTitle", "Hero title", "Start a conversation."),
      area("heroBody", "Hero introduction", "Questions about joining, collaboration, sponsorship, media, or an upcoming event? Send the team a note."),
      text("contactEyebrow", "Contact eyebrow", "210 Robotics"),
      text("contactTitle", "Contact title", "We're listening."),
      area("contactBody", "Contact description", "Based at UT San Antonio in San Antonio, Texas."),
      text("contactEmail", "Public contact email", "admin@210robotics.com"),
    ],
  },
] as const satisfies readonly WebsitePageDefinition[];

export type WebsitePageId = (typeof websitePages)[number]["id"];
export type WebsiteContentMap = Record<string, string>;

export function getWebsitePageDefinition(id: string) {
  return websitePages.find((page) => page.id === id) ?? websitePages[0];
}

export function websiteContentKey(pageId: string, fieldKey: string) {
  return `${pageId}.${fieldKey}`;
}

export function resolveWebsitePageContent(
  pageId: string,
  overrides: WebsiteContentMap | null | undefined,
) {
  const page = getWebsitePageDefinition(pageId);
  return Object.fromEntries(
    page.fields.map((field) => [
      field.key,
      overrides?.[websiteContentKey(page.id, field.key)] ?? field.defaultValue,
    ]),
  ) as Record<string, string>;
}

export function websiteContentDefaults() {
  return Object.fromEntries(
    websitePages.flatMap((page) =>
      page.fields.map((field) => [
        websiteContentKey(page.id, field.key),
        field.defaultValue,
      ]),
    ),
  );
}
