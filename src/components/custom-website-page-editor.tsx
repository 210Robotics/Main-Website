"use client";

import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, ExternalLink, Plus, Trash2 } from "lucide-react";
import {
  saveCustomWebsitePage,
  unpublishCustomWebsitePage,
} from "@/app/admin/actions";
import { ActionForm } from "@/components/action-form";
import { ImageUpload } from "@/components/image-upload";
import {
  customPageSectionLayouts,
  type CustomPage,
  type CustomPageSection,
} from "@/lib/custom-pages";

function newSection(): CustomPageSection {
  return {
    id: crypto.randomUUID(),
    eyebrow: "New section",
    title: "Add a section heading",
    body: "Add the supporting text for this section.",
    image: "",
    layout: "image-right",
    buttonLabel: "",
    buttonHref: "",
  };
}

export function CustomWebsitePageEditor({
  page: initialPage,
  uploaderId,
}: {
  page: CustomPage;
  uploaderId: string;
}) {
  const [page, setPage] = useState(initialPage);
  const [sections, setSections] = useState(initialPage.sections);
  const isDirty = useMemo(
    () =>
      JSON.stringify({ ...page, sections }) !== JSON.stringify(initialPage),
    [initialPage, page, sections],
  );
  function updateSection(id: string, changes: Partial<CustomPageSection>) {
    setSections((current) =>
      current.map((section) =>
        section.id === id ? { ...section, ...changes } : section,
      ),
    );
  }
  function moveSection(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= sections.length) return;
    setSections((current) => {
      const next = [...current];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  return (
    <div className="mt-7">
      <div className="flex flex-wrap items-start justify-between gap-6 border border-[#39322b] bg-[#11100f] p-6 md:p-8">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <span className={page.status === "PUBLISHED" ? "tag !border-emerald-700 !text-emerald-300" : "tag"}>
              {page.status === "PUBLISHED" ? "Published" : "Draft"}
            </span>
            {isDirty && <span className="text-xs font-semibold text-[#fd7803]">Unsaved changes</span>}
          </div>
          <h3 className="mt-3 text-2xl font-bold">Build {page.navLabel}</h3>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[#888]">
            Build a public page from reusable sections, then publish it and optionally add it to the main navigation.
          </p>
        </div>
        {initialPage.status === "PUBLISHED" && (
          <a className="button secondary" href={`/${initialPage.slug}`} target="_blank" rel="noreferrer">
            Open live page <ExternalLink size={14} />
          </a>
        )}
      </div>

      <ActionForm
        action={saveCustomWebsitePage.bind(null, page.id)}
        successMessage={`${page.navLabel} saved.`}
        className="mt-8 grid gap-9"
      >
        <input type="hidden" name="sectionsJson" value={JSON.stringify(sections)} />
        <details className="border border-[#333] bg-[#0c0c0c]" open>
          <summary className="cursor-pointer list-none px-6 py-5 font-bold">Page, navigation, and search settings</summary>
          <div className="grid gap-7 border-t border-[#292929] p-6 md:grid-cols-2 md:p-8">
            <label className="field">
              <span>Navigation label</span>
              <input className="input" name="navLabel" value={page.navLabel} maxLength={50} onChange={(event) => setPage((current) => ({ ...current, navLabel: event.target.value }))} required />
            </label>
            <label className="field">
              <span>Page address</span>
              <span className="flex items-center border border-[#393939] bg-[#101010] pl-3 focus-within:border-[#fd7803]">
                <span className="text-sm text-[#777]">/</span>
                <input className="w-full bg-transparent px-1 py-[.85rem] text-white outline-none" name="slug" value={page.slug} maxLength={80} onChange={(event) => setPage((current) => ({ ...current, slug: event.target.value }))} required />
              </span>
            </label>
            <label className="field">
              <span>Browser and search title</span>
              <input className="input" name="seoTitle" value={page.seoTitle} maxLength={100} onChange={(event) => setPage((current) => ({ ...current, seoTitle: event.target.value }))} required />
            </label>
            <label className="field">
              <span>Publication status</span>
              <select className="input" name="status" value={page.status} onChange={(event) => setPage((current) => ({ ...current, status: event.target.value as CustomPage["status"] }))}>
                <option value="DRAFT">Draft — hidden from the public</option>
                <option value="PUBLISHED">Published — public at its address</option>
              </select>
            </label>
            <label className="field md:col-span-2">
              <span>Search description</span>
              <textarea className="input min-h-24" name="seoDescription" value={page.seoDescription} maxLength={300} onChange={(event) => setPage((current) => ({ ...current, seoDescription: event.target.value }))} />
            </label>
            <label className="field">
              <span>Navigation order</span>
              <input className="input" type="number" min={0} max={999} name="navigationOrder" value={page.navigationOrder} onChange={(event) => setPage((current) => ({ ...current, navigationOrder: Number(event.target.value) }))} />
            </label>
            <div className="grid content-end gap-3 pb-2">
              <label className="flex items-center gap-3 text-sm text-[#bbb]">
                <input type="checkbox" name="showInNavigation" checked={page.showInNavigation} onChange={(event) => setPage((current) => ({ ...current, showInNavigation: event.target.checked }))} />
                Add this page as a main navigation tab
              </label>
              <label className="flex items-center gap-3 text-sm text-[#bbb]">
                <input type="checkbox" name="showJoinCta" checked={page.showJoinCta} onChange={(event) => setPage((current) => ({ ...current, showJoinCta: event.target.checked }))} />
                Add the “Join 210 Robotics” call-to-action at the bottom
              </label>
            </div>
          </div>
        </details>

        <details className="border border-[#333] bg-[#0c0c0c]" open>
          <summary className="cursor-pointer list-none px-6 py-5 font-bold">Hero</summary>
          <div className="grid gap-7 border-t border-[#292929] p-6 md:p-8">
            <div className="grid gap-5 md:grid-cols-2">
              <label className="field">
                <span>Eyebrow</span>
                <input className="input" name="heroEyebrow" value={page.heroEyebrow} maxLength={100} onChange={(event) => setPage((current) => ({ ...current, heroEyebrow: event.target.value }))} />
              </label>
              <label className="field">
                <span>Hero title</span>
                <input className="input" name="heroTitle" value={page.heroTitle} maxLength={200} onChange={(event) => setPage((current) => ({ ...current, heroTitle: event.target.value }))} required />
              </label>
            </div>
            <label className="field">
              <span>Hero introduction</span>
              <textarea className="input min-h-28" name="heroBody" value={page.heroBody} maxLength={2000} onChange={(event) => setPage((current) => ({ ...current, heroBody: event.target.value }))} />
            </label>
            <div className="grid gap-5 border border-[#292929] bg-black/35 p-4 lg:grid-cols-[minmax(220px,320px)_1fr]">
              <ImageUpload name="upload_heroImage" removeName="remove_heroImage" purpose="site-content" uploaderId={uploaderId} currentUrl={initialPage.heroImage} label="Upload hero photo" presentation="logo" />
              <label className="field">
                <span>Hero image path or approved URL</span>
                <input className="input" name="heroImage" value={page.heroImage} maxLength={1000} onChange={(event) => setPage((current) => ({ ...current, heroImage: event.target.value }))} placeholder="Optional" />
              </label>
            </div>
          </div>
        </details>

        <section className="grid gap-4">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="eyebrow">Page builder</p>
              <h3 className="mt-2 text-2xl font-bold">Content sections</h3>
              <p className="mt-2 text-sm text-[#888]">Add up to 12 sections and arrange them in any order.</p>
            </div>
            <button className="button secondary" type="button" onClick={() => setSections((current) => [...current, newSection()])} disabled={sections.length >= 12}>
              <Plus size={15} /> Add section
            </button>
          </div>
          {sections.map((section, index) => (
            <details className="border border-[#333] bg-[#0c0c0c]" key={section.id} open={index === 0}>
              <summary className="cursor-pointer list-none px-6 py-5">
                <span className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
                  <span className="font-bold">{index + 1}. {section.title || "Untitled section"}</span>
                  <span className="text-xs text-[#777]">{customPageSectionLayouts.find((layout) => layout.value === section.layout)?.label}</span>
                </span>
              </summary>
              <div className="grid gap-7 border-t border-[#292929] p-6 md:p-8">
                <div className="flex flex-wrap justify-end gap-2">
                  <button className="button secondary !min-h-9 !px-3" type="button" aria-label="Move section up" onClick={() => moveSection(index, -1)} disabled={index === 0}><ArrowUp size={14} /></button>
                  <button className="button secondary !min-h-9 !px-3" type="button" aria-label="Move section down" onClick={() => moveSection(index, 1)} disabled={index === sections.length - 1}><ArrowDown size={14} /></button>
                  <button className="button secondary !min-h-9 !border-red-900 !px-3 !text-red-300" type="button" onClick={() => setSections((current) => current.filter((item) => item.id !== section.id))}><Trash2 size={14} /> Remove</button>
                </div>
                <div className="grid gap-5 md:grid-cols-2">
                  <label className="field">
                    <span>Section eyebrow</span>
                    <input className="input" value={section.eyebrow} maxLength={100} onChange={(event) => updateSection(section.id, { eyebrow: event.target.value })} />
                  </label>
                  <label className="field">
                    <span>Layout</span>
                    <select className="input" value={section.layout} onChange={(event) => updateSection(section.id, { layout: event.target.value as CustomPageSection["layout"] })}>
                      {customPageSectionLayouts.map((layout) => <option value={layout.value} key={layout.value}>{layout.label}</option>)}
                    </select>
                  </label>
                </div>
                <label className="field">
                  <span>Section title</span>
                  <input className="input" value={section.title} maxLength={200} onChange={(event) => updateSection(section.id, { title: event.target.value })} required />
                </label>
                <label className="field">
                  <span>Section text</span>
                  <textarea className="input min-h-36 leading-7" value={section.body} maxLength={5000} onChange={(event) => updateSection(section.id, { body: event.target.value })} />
                </label>
                {section.layout !== "text-only" && (
                  <div className="grid gap-5 border border-[#292929] bg-black/35 p-4 lg:grid-cols-[minmax(220px,320px)_1fr]">
                    <ImageUpload name={`upload_section_${section.id}`} removeName={`remove_section_${section.id}`} purpose="site-content" uploaderId={uploaderId} currentUrl={section.image} label="Upload section photo" presentation="logo" />
                    <label className="field">
                      <span>Image path or approved URL</span>
                      <input className="input" value={section.image} maxLength={1000} onChange={(event) => updateSection(section.id, { image: event.target.value })} placeholder="Optional" />
                    </label>
                  </div>
                )}
                <div className="grid gap-5 md:grid-cols-2">
                  <label className="field">
                    <span>Optional button label</span>
                    <input className="input" value={section.buttonLabel} maxLength={80} onChange={(event) => updateSection(section.id, { buttonLabel: event.target.value })} />
                  </label>
                  <label className="field">
                    <span>Optional button link</span>
                    <input className="input" value={section.buttonHref} maxLength={1000} onChange={(event) => updateSection(section.id, { buttonHref: event.target.value })} placeholder="/join or https://…" />
                  </label>
                </div>
              </div>
            </details>
          ))}
          {!sections.length && <p className="border border-dashed border-[#444] p-8 text-center text-sm text-[#777]">This page currently has only a hero. Add the first content section when you are ready.</p>}
        </section>

        <div className="flex flex-wrap items-center justify-between gap-5 border border-[#4b3420] bg-[#17110c] p-5 shadow-xl">
          <p className="text-sm text-[#aaa]">{page.status === "PUBLISHED" ? "Saving updates the live page immediately." : "Save as a draft or switch the status to Published."}</p>
          <button className="button">Save page</button>
        </div>
      </ActionForm>

      {initialPage.status === "PUBLISHED" && (
        <ActionForm action={unpublishCustomWebsitePage.bind(null, initialPage.id)} successMessage={`${initialPage.navLabel} is now a private draft.`} className="mt-7 border-t border-[#333] pt-5">
          <p className="mb-4 text-sm text-[#888]">Unpublishing removes this page from the main navigation and makes its public address unavailable without deleting its content.</p>
          <button className="button secondary !border-red-900 !text-red-300" type="submit">Unpublish page</button>
        </ActionForm>
      )}
    </div>
  );
}
