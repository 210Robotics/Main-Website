"use client";

import { useMemo, useState } from "react";
import { ExternalLink, Monitor, RotateCcw, Search, Smartphone, Tablet } from "lucide-react";
import { saveWebsitePageContent } from "@/app/admin/actions";
import { ActionForm } from "@/components/action-form";
import { ImageUpload } from "@/components/image-upload";
import type { WebsitePageDefinition } from "@/lib/site-content-schema";

const groupNames: Record<string, string> = {
  hero: "Hero",
  programs: "Programs overview",
  program1: "Program card 1",
  program2: "Program card 2",
  program3: "Program card 3",
  winner: "Winner feature",
  calendar: "Calendar",
  learning: "Learning feature",
  media: "Media feature",
  team: "Team feature",
  news: "News feature",
  mission: "Mission",
  value1: "Value 1",
  value2: "Value 2",
  value3: "Value 3",
  work: "Engineering lifecycle",
  build: "Build plan",
  members: "Members",
  leadership: "Leadership",
  contributors: "Contributors",
  advisors: "Advisors",
  mentors: "Mentors",
  directory: "Directory",
  stories: "Stories",
  gallery: "Gallery",
  partners: "Partners",
  levels: "Partnership levels",
  contact: "Contact",
  library: "Library",
  private: "Private resources",
  form: "Interest form",
  who: "FAQ: who can join",
  cost: "FAQ: cost",
  bring: "FAQ: what to bring",
  challenge: "Challenge",
  why: "Workflow",
  story: "Development story",
  step1: "Item 1",
  step2: "Item 2",
  step3: "Item 3",
};

function fieldGroup(key: string) {
  return key.match(/^[a-z]+?\d*(?=[A-Z]|$)/)?.[0] ?? "content";
}

type Viewport = "desktop" | "tablet" | "mobile";
const viewportWidths: Record<Viewport, string> = {
  desktop: "100%",
  tablet: "768px",
  mobile: "390px",
};

export function WebsitePageEditorForm({
  page,
  values: initialValues,
  uploaderId,
}: {
  page: WebsitePageDefinition;
  values: Record<string, string>;
  uploaderId: string;
}) {
  const [values, setValues] = useState(initialValues);
  const [query, setQuery] = useState("");
  const [viewport, setViewport] = useState<Viewport>("desktop");
  const [previewKey, setPreviewKey] = useState(0);
  const groups = useMemo(() => {
    const visible = page.fields.filter((field) =>
      `${field.label} ${field.key}`.toLowerCase().includes(query.toLowerCase()),
    );
    return Object.entries(
      visible.reduce<Record<string, typeof page.fields[number][]>>((result, field) => {
        const key = fieldGroup(field.key);
        (result[key] ??= []).push(field);
        return result;
      }, {}),
    );
  }, [page, query]);
  const changedCount = page.fields.filter(
    (field) => (values[field.key] ?? field.defaultValue) !== field.defaultValue,
  ).length;

  return (
    <div className="mt-8 grid gap-12 [@media(min-width:1800px)]:grid-cols-[minmax(0,1fr)_520px]">
      <div className="min-w-0">
        <div className="sticky top-[74px] z-20 border border-[#39322b] bg-[#11100f]/95 p-5 backdrop-blur-xl">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="font-mono text-[.65rem] uppercase tracking-wider text-[#fd7803]">
                Editing {page.route}
              </p>
              <p className="mt-1 text-sm text-[#aaa]">
                {changedCount} field{changedCount === 1 ? "" : "s"} differ from the included design.
              </p>
            </div>
            <a className="button secondary !min-h-10" href={page.route} target="_blank" rel="noreferrer">
              Open live page <ExternalLink size={14} />
            </a>
          </div>
          <label className="relative mt-4 block">
            <span className="sr-only">Search fields</span>
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[#777]" size={16} />
            <input
              className="input pl-10"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Find a heading, paragraph, or photo…"
            />
          </label>
        </div>

        <ActionForm
          action={saveWebsitePageContent.bind(null, page.id)}
          successMessage={`${page.label} page published.`}
          className="mt-8 grid gap-8"
        >
          {groups.map(([group, fields], groupIndex) => (
            <details
              className="border border-[#333] bg-[#0c0c0c]"
              key={group}
              open={groupIndex === 0 || Boolean(query)}
            >
              <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-4 px-6 py-5 font-bold">
                <span>{groupNames[group] ?? group.replace(/\b\w/g, (letter) => letter.toUpperCase())}</span>
                <span className="tag">{fields.length} fields</span>
              </summary>
              <div className="grid gap-8 border-t border-[#292929] p-6 md:p-8">
                {fields.map((field) => {
                  const limit = field.type === "textarea" ? 5000 : field.type === "image" ? 1000 : 300;
                  const id = `site-${page.id}-${field.key}`;
                  const fieldValue = values[field.key] ?? field.defaultValue;
                  return field.type === "image" ? (
                    <div className="grid gap-4" key={field.key}>
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <label className="font-mono text-[.68rem] font-bold uppercase tracking-wider text-[#c5c1ba]" htmlFor={id}>
                          {field.label}
                        </label>
                        <button
                          className="inline-flex items-center gap-2 text-xs text-[#999] transition hover:text-white"
                          type="button"
                          onClick={() => setValues((current) => ({ ...current, [field.key]: field.defaultValue }))}
                        >
                          <RotateCcw size={13} /> Use included photo
                        </button>
                      </div>
                      <div className="grid gap-7 border border-[#292929] bg-black/35 p-5 lg:grid-cols-[minmax(220px,320px)_1fr] lg:p-6">
                        <ImageUpload
                          name={`upload_${field.key}`}
                          removeName={`remove_${field.key}`}
                          purpose="site-content"
                          uploaderId={uploaderId}
                          currentUrl={initialValues[field.key]}
                          label="Upload replacement"
                          presentation="logo"
                        />
                        <div>
                          <label className="field" htmlFor={id}>
                            <span>Image path or approved URL</span>
                          </label>
                          <input
                            id={id}
                            className="input"
                            value={fieldValue}
                            maxLength={limit}
                            name={field.key}
                            onChange={(event) => setValues((current) => ({ ...current, [field.key]: event.target.value }))}
                            placeholder="/media/example.jpg or https://…"
                          />
                          <p className="mt-2 text-xs leading-5 text-[#777]">{field.help}</p>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="grid gap-2" key={field.key}>
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <label className="font-mono text-[.68rem] font-bold uppercase tracking-wider text-[#c5c1ba]" htmlFor={id}>
                          {field.label}
                        </label>
                        <div className="flex items-center gap-4">
                          <span className="font-mono text-[.62rem] text-[#666]">
                            {fieldValue.length}/{limit}
                          </span>
                          <button
                            className="inline-flex items-center gap-2 text-xs text-[#999] transition hover:text-white"
                            type="button"
                            onClick={() => setValues((current) => ({ ...current, [field.key]: field.defaultValue }))}
                          >
                            <RotateCcw size={13} /> Default
                          </button>
                        </div>
                      </div>
                      {field.type === "textarea" ? (
                        <textarea
                          id={id}
                          className="input min-h-32 resize-y leading-7"
                          value={fieldValue}
                          maxLength={limit}
                          name={field.key}
                          onChange={(event) => setValues((current) => ({ ...current, [field.key]: event.target.value }))}
                        />
                      ) : (
                        <input
                          id={id}
                          className="input"
                          value={fieldValue}
                          maxLength={limit}
                          name={field.key}
                          onChange={(event) => setValues((current) => ({ ...current, [field.key]: event.target.value }))}
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            </details>
          ))}
          {!groups.length && (
            <p className="border border-[#333] p-6 text-sm text-[#888]">No fields match that search.</p>
          )}
          <div className="flex flex-wrap items-center justify-between gap-5 border border-[#4b3420] bg-[#17110c] p-5 shadow-xl">
            <p className="text-sm text-[#aaa]">Saving publishes every field on this page immediately.</p>
            <button className="button">Publish {page.label}</button>
          </div>
        </ActionForm>
      </div>

      <aside className="min-w-0 [@media(min-width:1800px)]:sticky [@media(min-width:1800px)]:top-[92px] [@media(min-width:1800px)]:self-start">
        <div className="border border-[#333] bg-[#0b0b0b] p-5 md:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="eyebrow">Published preview</p>
              <p className="mt-2 text-xs text-[#777]">Save, then refresh to see the latest version.</p>
            </div>
            <button className="button secondary !min-h-9 !px-3" type="button" onClick={() => setPreviewKey((key) => key + 1)}>
              Refresh
            </button>
          </div>
          <div className="mt-4 flex gap-2" aria-label="Preview width">
            {([
              ["desktop", Monitor],
              ["tablet", Tablet],
              ["mobile", Smartphone],
            ] as const).map(([value, Icon]) => (
              <button
                aria-label={`${value} preview`}
                className={`grid h-10 w-10 place-items-center border ${viewport === value ? "border-[#fd7803] bg-[#26170c] text-white" : "border-[#333] text-[#888]"}`}
                key={value}
                onClick={() => setViewport(value)}
                type="button"
              >
                <Icon size={16} />
              </button>
            ))}
          </div>
          <div className="mt-4 overflow-auto border border-[#292929] bg-black p-2">
            <iframe
              key={previewKey}
              title={`${page.label} published preview`}
              src={page.route}
              className="mx-auto block h-[680px] border-0 bg-black transition-[width]"
              style={{ width: viewportWidths[viewport], maxWidth: "100%" }}
            />
          </div>
        </div>
      </aside>
    </div>
  );
}
