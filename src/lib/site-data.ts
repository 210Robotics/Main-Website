import type { AccessRole } from "@/lib/permissions";

export type Member = {
  id: string;
  name: string;
  role: string;
  projects: Array<"VEX U" | "SIDC" | "Operations">;
  image: string;
  bio: string;
  accessRole: AccessRole;
  featured?: boolean;
};

export const members: Member[] = [
  { id: "jacob-white", name: "Jacob White", role: "President", projects: ["VEX U", "Operations"], image: "/media/team/jacob-white.jpg", bio: "Leads organization strategy, partnerships, and the season-wide mission for 210 Robotics.", accessRole: "SUPER_ADMIN", featured: true },
  { id: "josef-ybarra", name: "Josef Ybarra", role: "Vice President of Operations", projects: ["VEX U", "Operations"], image: "/media/team/josef-ybarra.jpg", bio: "Coordinates competition readiness, project execution, and organization-wide operations.", accessRole: "FULL_ADMIN", featured: true },
  { id: "dyshana-torres", name: "Dyshana Torres", role: "Vice President of Internal Affairs", projects: ["SIDC", "Operations"], image: "/media/team/dyshana-torres.jpg", bio: "Builds the member systems and collaborative culture that keep ambitious work moving.", accessRole: "RECORDS_ADMIN", featured: true },
  { id: "kristal-cayabyab", name: "Kristal Cayabyab", role: "Outreach and Communications Officer", projects: ["Operations"], image: "/media/team/kristal-cayabyab.jpg", bio: "Connects 210 Robotics with students, industry partners, and the San Antonio community.", accessRole: "CONTENT_ADMIN" },
  { id: "gray-samaniego", name: "Gray Samaniego", role: "Finance Officer", projects: ["SIDC", "Operations"], image: "/media/team/gray-samaniego.jpg", bio: "Guides financial planning, sponsor stewardship, and the business case behind team projects.", accessRole: "OFFICER", featured: true },
  { id: "israel-elizondo", name: "Israel Elizondo", role: "Build Officer", projects: ["SIDC", "VEX U"], image: "/media/team/israel-elizondo.jpg", bio: "Leads mechanical development and multidisciplinary engineering work across the organization.", accessRole: "OFFICER", featured: true },
  { id: "landon-smith", name: "Landon Smith", role: "Systems Officer", projects: ["VEX U"], image: "/media/team/landon-smith.jpg", bio: "Leads programming, electrical integration, controls, and system reliability.", accessRole: "OFFICER" },
  { id: "andrew-romo", name: "Andrew Romo", role: "Logistics Officer", projects: ["VEX U", "SIDC", "Operations"], image: "/media/team/andrew-romo.jpg", bio: "Coordinates team logistics while contributing to mechanical design and fabrication.", accessRole: "OFFICER" },
  { id: "vian-chen", name: "Vian Chen", role: "Member", projects: ["SIDC"], image: "/media/team/vian-chen.jpg", bio: "Develops software and automation systems for RoboRowdy.", accessRole: "MEMBER" },
  { id: "roman-benavides", name: "Roman Benavides", role: "Member", projects: ["SIDC"], image: "/media/team/roman-benavides.jpg", bio: "Turns concepts into reliable assemblies through design, prototyping, and integration.", accessRole: "MEMBER" },
  { id: "darik-pratt", name: "Darik Pratt", role: "Member", projects: ["SIDC"], image: "/media/team/darik-pratt.jpg", bio: "Supports simulation-led decisions and hands-on project assembly.", accessRole: "MEMBER" },
];

export const programs = [
  { eyebrow: "Competitive robotics", title: "VEX U", description: "Two robots. One alliance. A full season of CAD, fabrication, controls, autonomy, strategy, and iteration.", href: "/programs/vex-u", image: "/media/gallery/vexu/vexu-2.jpg", metric: "2026–27", metricLabel: "launch season" },
  { eyebrow: "Immersive engineering", title: "Siemens Design Challenge", description: "The global-winning team behind RoboRowdy used digital engineering, XR, simulation, and advanced manufacturing to solve a real industrial problem.", href: "/programs/sidc", image: "/media/gallery/siemens/siemens-1.jpg", metric: "Winner", metricLabel: "global challenge" },
  { eyebrow: "Autonomous systems", title: "RoboRowdy", description: "An autonomous print-farm assistant designed to remove finished parts, reset build plates, and reduce downtime.", href: "/projects/roborowdy", image: "/media/gallery/siemens/siemens-2.jpg", metric: "24/7", metricLabel: "production vision" },
];

export const timeline = [
  { month: "JUL", title: "Concept architecture", detail: "Compare complete robot concepts and lock the engineering stack." },
  { month: "SEP", title: "Mechanism prototypes", detail: "Test scoring, intake, sensing, and control systems independently." },
  { month: "OCT", title: "Alpha robot", detail: "Deliver the first integrated machine that drives, intakes, and scores." },
  { month: "JAN", title: "Competition robot", detail: "Complete a legal, reliable robot with autonomous routines and spares." },
  { month: "MAR", title: "Performance lock", detail: "Shift from redesign to consistency, skills, scouting, and practice." },
];

export const news = [
  { slug: "sidc-global-win", date: "June 2026", title: "210 Robotics wins the Siemens Immersive Design Challenge", summary: "RoboRowdy earned the global win by connecting autonomous hardware, immersive engineering, and a practical path to more productive 3D print farms.", image: "/media/gallery/siemens/siemens-3.jpg", body: "210 Robotics won the Siemens Immersive Design Challenge with RoboRowdy, an autonomous system designed to reduce the manual handoffs between industrial 3D-print jobs. The team combined mechanical design, automation, simulation, immersive review, and a clear business case into one connected workflow." },
  { slug: "vex-u-season-roadmap", date: "July 2026", title: "The 2026–27 VEX U roadmap is live", summary: "A focused engineering roadmap takes the team from concept selection to a reliable competition robot.", image: "/media/gallery/vexu/vexu-3.jpg", body: "The first 210 Robotics VEX U season is organized around evidence, iteration, and reliability. Mechanical, controls, strategy, logistics, and finance work together from the first concept review through competition readiness." },
  { slug: "build-the-team", date: "August 2026", title: "Build the team that builds the machine", summary: "Recruitment opens across mechanical, electrical, software, business, media, and operations roles.", image: "/media/gallery/vexu/vexu-1.jpg", body: "You do not need prior robotics experience to join 210 Robotics. New members learn through workshops, paired project work, and real responsibilities across technical and organizational teams." },
];

export const sponsors = [
  { name: "Siemens", image: "/media/sponsors/siemens.png", kind: "Technology and mentorship" },
  { name: "UT San Antonio", image: "/media/sponsors/utsa.png", kind: "University support" },
  { name: "Onshape", image: "/media/sponsors/onshape.svg", kind: "Cloud CAD" },
];

export const sponsorTiers = [
  { name: "Bronze", amount: "$250+", benefits: "Website recognition, social thank-you, showcase invitation" },
  { name: "Silver", amount: "$500+", benefits: "Banner placement, select presentations, progress update" },
  { name: "Gold", amount: "$1,000+", benefits: "Apparel and pit recognition, spotlight post, team access" },
  { name: "Platinum", amount: "$2,500+", benefits: "Priority visibility, technical workshop, dedicated feature" },
  { name: "Title", amount: "$5,000+", benefits: "Premium placement, reveal events, recruiting and impact report" },
];

export const galleryImages = [
  "/media/gallery/vexu/vexu-1.jpg",
  "/media/gallery/siemens/siemens-1.jpg",
  "/media/gallery/vexu/vexu-4.jpg",
  "/media/gallery/siemens/siemens-2.jpg",
  "/media/gallery/vexu/vexu-5.jpg",
  "/media/gallery/vexu/vexu-6.jpg",
];

export const resourceLinks = [
  { title: "Programming Workflow: Git, VS Code, GitHub, and Doxygen", description: "The shared programming team workflow and documentation foundations.", category: "Programming", public: true, url: "https://docs.google.com/presentation/d/1XwJsqS-UOcg8hP9CkkXHNBmPZkwKcHXKcdY3ll4C7rw/edit?usp=drivesdk" },
  { title: "Autonomous Overview and Training", description: "An introduction to autonomous planning, implementation, and testing.", category: "Controls", public: true, url: "https://docs.google.com/presentation/d/1JT7slPFntjuhYexKlYJzEvm0mTZHoDixtwu8rco5oQA/edit?usp=drivesdk" },
  { title: "Programming Team Overview", description: "Roles, expectations, tools, and onboarding for the programming team.", category: "Onboarding", public: true, url: "https://docs.google.com/presentation/d/1EJT8k4-lIGq1yCd6HJgeXtVG1zsHTa8RIbcPZ9ykybk/edit?usp=drivesdk" },
  { title: "VEX U Season Timeline", description: "The current season roadmap from analysis and recruitment through competition and transition.", category: "Season planning", public: true, url: "https://docs.google.com/document/d/1s5rmMczHfRVIUa9EClyEq1g-hYPPE_T2Vqx01PV3MBU/edit?usp=drivesdk" },
];
