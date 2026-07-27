import type { Metadata } from "next";
import Link from "next/link";
import { and, asc, eq, isNull } from "drizzle-orm";
import { notFound, redirect } from "next/navigation";
import { getDb, hasDatabase } from "@/db";
import { docCategories, docPages } from "@/db/schema";
import { DocsReader } from "@/components/docs-reader";
import { getCurrentMember, hasClerk } from "@/lib/auth";
import { docHeadings } from "@/lib/docs";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Documentation", description: "210 Robotics engineering notebook, code documentation, and team knowledge base." };

export default async function DocumentationPage({ params }: { params: Promise<{ path?: string[] }> }) {
  const path = (await params).path?.join("/") ?? "";
  if (!hasDatabase()) return <DocsReader categories={[]} pages={[]} currentPath="" headings={[]}><Welcome categories={[]} pages={[]} /></DocsReader>;
  const [categories, pages] = await Promise.all([
    getDb().select().from(docCategories).where(isNull(docCategories.archivedAt)).orderBy(asc(docCategories.sortOrder), asc(docCategories.title)),
    getDb().select().from(docPages).where(and(eq(docPages.status, "PUBLISHED"), isNull(docPages.archivedAt))).orderBy(asc(docPages.sortOrder), asc(docPages.title)),
  ]);
  const member = hasClerk() ? await getCurrentMember() : null;
  const visiblePages = pages.filter((page) => page.visibility === "PUBLIC" || member?.status === "ACTIVE");
  if (!path) return <DocsReader categories={categories} pages={visiblePages} currentPath="" headings={[{ id: "programs", title: "Documentation areas", level: 2 }]}><Welcome categories={categories} pages={visiblePages} /></DocsReader>;
  const page = pages.find((candidate) => candidate.path === path);
  if (!page) notFound();
  if (page.visibility === "MEMBERS_ONLY" && member?.status !== "ACTIVE") redirect(`/sign-in?redirect_url=${encodeURIComponent(`/docs/${page.path}`)}`);
  const headings = docHeadings(page.bodyHtml);
  let index = 0;
  const bodyHtml = page.bodyHtml.replace(/<h([2-3])([^>]*)>/gi, (_match, level, attrs) => `<h${level}${attrs} id="section-${++index}">`);
  return <DocsReader categories={categories} pages={visiblePages} currentPath={path} headings={headings}><p className="eyebrow">210 Robotics knowledge base</p><h1 className="mt-4 text-4xl font-bold tracking-[-.04em] md:text-5xl">{page.title}</h1>{page.summary && <p className="mt-5 max-w-3xl text-lg leading-8 text-[#aaa]">{page.summary}</p>}<div className="docs-article mt-10" dangerouslySetInnerHTML={{ __html: bodyHtml }} /></DocsReader>;
}

function Welcome({ categories, pages }: { categories: Array<{ id: string; slug: string }>; pages: Array<{ categoryId: string; path: string }> }) {
  const categoryPage = (slug: string, fallback: string) => {
    const category = categories.find((candidate) => candidate.slug === slug);
    const page = category && pages.find((candidate) => candidate.categoryId === category.id);
    return page ? `/docs/${page.path}` : fallback;
  };
  return <><p className="eyebrow">210 Robotics knowledge base</p><h1 className="mt-4 text-5xl font-bold tracking-[-.05em] md:text-6xl">Build knowledge that lasts.</h1><p className="mt-6 max-w-3xl text-lg leading-8 text-[#aaa]">Explore our public engineering notebook, VEX U technical guides, code documentation, training resources, and team processes. Members can sign in to access internal pages.</p><section id="programs" className="mt-12 grid gap-4 md:grid-cols-2 xl:grid-cols-3"><WelcomeCard number="01" title="Engineering notebook" text="Design decisions, test results, iterations, and competition learning." links={[{ href: categoryPage("engineering-notebook", "/docs/engineering-notebook/design-cycle"), label: "Open notebook" }]} /><WelcomeCard number="02" title="Code documentation" text="Architecture, controls, autonomous systems, programming standards, and generated API reference." links={[{ href: categoryPage("code-documentation", "/docs/code-documentation/codebase-standards"), label: "Browse code guides" }, { href: "/doxygen/index.html", label: "Open Doxygen", staticDocument: true }]} /><WelcomeCard number="03" title="Team documentation" text="Training, onboarding, safety, and the systems that keep 210 moving." links={[{ href: categoryPage("team-operations", "/docs/team-operations/new-member-start-here"), label: "Open team docs" }]} /></section></>;
}
function WelcomeCard({ number, title, text, links }: { number: string; title: string; text: string; links: Array<{ href: string; label: string; staticDocument?: boolean }> }) {
  return <article className="flex min-h-72 flex-col border border-[#34302d] bg-[#151515] p-6 transition hover:-translate-y-1 hover:border-[#fd7803]"><span className="font-mono text-xs text-[#fd7803]">{number}</span><h2 className="mt-8 text-xl font-bold">{title}</h2><p className="mt-3 text-sm leading-6 text-[#999]">{text}</p><div className="mt-auto flex flex-wrap gap-x-5 gap-y-3 pt-6">{links.map((link) => link.staticDocument ? <a key={link.href} href={link.href} className="text-xs font-bold uppercase tracking-[.1em] text-[#fd7803] hover:text-white">{link.label} &rarr;</a> : <Link key={link.href} href={link.href} className="text-xs font-bold uppercase tracking-[.1em] text-[#fd7803] hover:text-white">{link.label} &rarr;</Link>)}</div></article>;
}
