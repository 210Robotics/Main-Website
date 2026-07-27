"use client";

import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, Code2, Menu, Search, X } from "lucide-react";
import { useMemo, useState } from "react";

type Category = { id: string; title: string; parentId: string | null };
type Page = {
  path: string;
  title: string;
  categoryId: string;
  summary: string;
  visibility: "PUBLIC" | "MEMBERS_ONLY";
};

export function DocsReader({
  categories,
  pages,
  currentPath,
  headings,
  children,
}: {
  categories: Category[];
  pages: Page[];
  currentPath: string;
  headings: { id: string; title: string; level: number }[];
  children: React.ReactNode;
}) {
  const [query, setQuery] = useState("");
  const [menu, setMenu] = useState(false);
  const filtered = useMemo(
    () =>
      query.trim()
        ? pages.filter((page) =>
            `${page.title} ${page.summary}`
              .toLowerCase()
              .includes(query.toLowerCase()),
          )
        : pages,
    [pages, query],
  );
  return (
    <div className="docs-reader min-h-screen bg-[#101010] text-[#f4f1ea]">
      <header className="sticky top-0 z-40 border-b border-[#302b27] bg-[#120f0d]/95 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-[1600px] items-center gap-3 px-4 md:gap-4 md:px-7">
          <Link href="/docs" className="flex shrink-0 items-center gap-3">
            <span className="relative h-9 w-9 overflow-hidden">
              <Image
                src="/icon.png"
                alt=""
                fill
                sizes="36px"
                className="object-cover"
              />
            </span>
            <strong className="hidden tracking-tight sm:block">210 DOCS</strong>
          </Link>
          <a
            href="https://210robotics.com"
            className="inline-flex shrink-0 items-center gap-2 border-l border-[#3a332e] pl-3 text-xs font-semibold text-[#aaa] transition hover:text-[#fd7803] md:pl-4"
            aria-label="Return to the 210 Robotics main website"
          >
            <ArrowLeft size={15} />
            <span className="hidden md:inline">Main site</span>
          </a>
          <Link
            href="/doxygen/index.html"
            className="inline-flex min-h-9 shrink-0 items-center gap-2 border border-[#4a3627] bg-[#1b1511] px-3 text-xs font-bold text-[#fd7803] transition hover:border-[#fd7803] hover:bg-[#28190f]"
            aria-label="Open the VEX U code reference"
          >
            <Code2 size={15} />
            <span className="hidden xl:inline">Code reference</span>
          </Link>
          <div className="relative ml-auto min-w-0 flex-1 md:max-w-md">
            <Search
              className="absolute left-3 top-1/2 -translate-y-1/2 text-[#777]"
              size={16}
            />
            <input
              className="w-full border border-[#3a332e] bg-[#1b1714] py-2 pl-10 pr-3 text-sm outline-none transition focus:border-[#fd7803]"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Ask or search documentation…"
              aria-label="Search documentation"
            />
          </div>
          <button
            className="calendar-control lg:hidden"
            onClick={() => setMenu((value) => !value)}
            aria-label="Toggle documentation menu"
          >
            {menu ? <X /> : <Menu />}
          </button>
        </div>
      </header>
      <div className="mx-auto grid max-w-[1600px] lg:grid-cols-[260px_minmax(0,1fr)] xl:grid-cols-[280px_minmax(0,1fr)_230px]">
        <aside
          className={`${menu ? "block" : "hidden"} min-w-0 border-r border-[#2c2926] bg-[#121212] p-6 lg:block lg:min-h-[calc(100vh-4rem)]`}
        >
          <Link
            href="/docs"
            className={`mb-5 block text-sm font-bold ${currentPath === "" ? "text-[#fd7803]" : "text-[#bbb]"}`}
          >
            Welcome
          </Link>
          <Link
            href="/doxygen/index.html"
            className="mb-7 flex items-center gap-2 border border-[#4a3627] bg-[#1b1511] px-3 py-3 text-sm font-bold text-[#fd7803] transition hover:border-[#fd7803] hover:bg-[#28190f]"
          >
            <Code2 size={16} />
            VEX U code reference
          </Link>
          {categories.map((category) => (
            <section className="mb-7" key={category.id}>
              <h2 className="mb-2 text-[.68rem] font-bold uppercase tracking-[.14em] text-[#fd7803]">
                {category.title}
              </h2>
              <nav className="grid">
                {filtered
                  .filter((page) => page.categoryId === category.id)
                  .map((page) => (
                    <Link
                      className={`border-l px-3 py-2 text-sm leading-5 transition hover:border-[#fd7803] hover:text-white ${page.path === currentPath ? "border-[#fd7803] bg-[#1a1511] text-white" : "border-[#34302d] text-[#9c9c9c]"}`}
                      href={`/docs/${page.path}`}
                      key={page.path}
                    >
                      {page.title}
                      {page.visibility === "MEMBERS_ONLY" && (
                        <span className="ml-2 text-[9px] uppercase tracking-wider text-[#766]">
                          Member
                        </span>
                      )}
                    </Link>
                  ))}
              </nav>
            </section>
          ))}
        </aside>
        <article className="min-w-0 overflow-hidden px-5 py-10 md:px-10 lg:px-12 lg:py-14 xl:px-14">
          {children}
        </article>
        <aside className="hidden min-w-0 border-l border-[#2c2926] px-6 py-12 xl:block">
          <p className="mb-4 text-[.68rem] font-bold uppercase tracking-[.14em] text-[#fd7803]">
            On this page
          </p>
          <nav className="grid gap-3">
            {headings.map((heading) => (
              <a
                key={heading.id}
                href={`#${heading.id}`}
                className={`text-sm leading-5 text-[#aaa] transition hover:text-white ${heading.level === 3 ? "pl-3" : "font-semibold"}`}
              >
                {heading.title}
              </a>
            ))}
            {!headings.length && (
              <span className="text-xs text-[#666]">No sections yet</span>
            )}
          </nav>
          <div className="mt-8 border-t border-[#333] pt-5">
            <a
              href="https://210robotics.com"
              className="text-xs text-[#888] hover:text-[#fd7803]"
            >
              Return to 210 Robotics
            </a>
          </div>
        </aside>
      </div>
    </div>
  );
}
