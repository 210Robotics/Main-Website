import Link from "next/link";
import { FilePlus2, Globe2, LayoutTemplate } from "lucide-react";
import {
  createCustomWebsitePage,
  resetWebsitePageContent,
} from "@/app/admin/actions";
import { ActionForm } from "@/components/action-form";
import { CustomWebsitePageEditor } from "@/components/custom-website-page-editor";
import { WebsitePageEditorForm } from "@/components/website-page-editor-form";
import type { CustomPage } from "@/lib/custom-pages";
import {
  getWebsitePageDefinition,
  resolveWebsitePageContent,
  websiteContentKey,
  websitePages,
  type WebsiteContentMap,
} from "@/lib/site-content-schema";

export function WebsiteContentEditor({
  pageId,
  overrides,
  customPages,
  uploaderId,
}: {
  pageId: string;
  overrides: WebsiteContentMap;
  customPages: CustomPage[];
  uploaderId: string;
}) {
  const customId = pageId.startsWith("custom-")
    ? pageId.slice("custom-".length)
    : "";
  const selectedCustom = customPages.find((page) => page.id === customId);
  const page = getWebsitePageDefinition(pageId);
  const values = resolveWebsitePageContent(page.id, overrides);

  return (
    <div className="grid gap-10 xl:grid-cols-[300px_minmax(0,1fr)]">
      <aside className="self-start border border-[#333] bg-[#0b0b0b] p-5 xl:sticky xl:top-[92px]">
        <div className="flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center border border-[#3a3028] bg-[#17110c] text-[#fd7803]">
            <LayoutTemplate size={18} />
          </span>
          <div>
            <p className="eyebrow">Website studio</p>
            <p className="mt-1 text-xs text-[#777]">Built-in and custom pages</p>
          </div>
        </div>

        <p className="mt-6 font-mono text-[.62rem] font-bold uppercase tracking-[.13em] text-[#777]">
          Main pages
        </p>
        <nav className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-1" aria-label="Built-in website pages">
          {websitePages.map((item) => {
            const modified = item.fields.filter(
              (field) => overrides[websiteContentKey(item.id, field.key)] !== undefined,
            ).length;
            return (
              <Link
                className={`border px-3 py-3 text-sm font-semibold transition ${!selectedCustom && item.id === page.id ? "border-[#fd7803] bg-[#17120d] text-white" : "border-[#2e2e2e] bg-[#0e0e0e] text-[#aaa] hover:border-[#666]"}`}
                href={`/admin?tab=website&page=${item.id}`}
                key={item.id}
              >
                <span className="flex items-center justify-between gap-3">
                  {item.label}
                  {modified > 0 && <span className="font-mono text-[.58rem] text-[#fd7803]">{modified} edited</span>}
                </span>
              </Link>
            );
          })}
        </nav>

        <div className="mt-7 border-t border-[#2d2d2d] pt-5">
          <div className="flex items-center justify-between gap-3">
            <p className="font-mono text-[.62rem] font-bold uppercase tracking-[.13em] text-[#777]">
              Custom pages
            </p>
            <span className="tag">{customPages.length}</span>
          </div>
          <nav className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-1" aria-label="Custom website pages">
            {customPages.map((item) => (
              <Link
                className={`border px-3 py-3 text-sm font-semibold transition ${selectedCustom?.id === item.id ? "border-[#fd7803] bg-[#17120d] text-white" : "border-[#2e2e2e] bg-[#0e0e0e] text-[#aaa] hover:border-[#666]"}`}
                href={`/admin?tab=website&page=custom-${item.id}`}
                key={item.id}
              >
                <span className="flex items-center justify-between gap-3">
                  <span className="truncate">{item.navLabel}</span>
                  <span className={`font-mono text-[.55rem] uppercase ${item.status === "PUBLISHED" ? "text-emerald-400" : "text-[#777]"}`}>
                    {item.status === "PUBLISHED" ? "Live" : "Draft"}
                  </span>
                </span>
              </Link>
            ))}
            {!customPages.length && (
              <p className="border border-dashed border-[#333] p-4 text-xs leading-5 text-[#666]">
                Create a page below to add a new public route and navigation tab.
              </p>
            )}
          </nav>
        </div>

        <ActionForm
          action={createCustomWebsitePage}
          successMessage="Draft page created. Select it above to start building."
          className="mt-6 grid gap-4 border border-[#3a3028] bg-[#12100e] p-5 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_auto] xl:grid-cols-1"
        >
          <div className="flex items-center gap-2 text-[#fd7803] sm:col-span-2 lg:col-span-3 xl:col-span-1">
            <FilePlus2 size={16} />
            <strong className="text-sm">New page</strong>
          </div>
          <label className="field">
            <span>Page name</span>
            <input className="input" name="pageLabel" maxLength={50} placeholder="Alumni" required />
          </label>
          <label className="field">
            <span>Address (optional)</span>
            <input className="input" name="pageSlug" maxLength={80} placeholder="alumni" />
          </label>
          <button className="button secondary !min-h-10 lg:self-end xl:self-auto" type="submit">
            Create draft
          </button>
        </ActionForm>
      </aside>

      <div className="min-w-0">
        {selectedCustom ? (
          <CustomWebsitePageEditor
            key={selectedCustom.id}
            page={selectedCustom}
            uploaderId={uploaderId}
          />
        ) : (
          <>
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-3 text-[#fd7803]">
                  <Globe2 size={18} />
                  <p className="eyebrow">{page.route}</p>
                </div>
                <h3 className="mt-3 text-3xl font-bold">Edit {page.label}</h3>
                <p className="mt-3 max-w-3xl text-sm leading-7 text-[#999]">
                  {page.description} Fields are grouped by the visible section they control, with a responsive published preview alongside them.
                </p>
              </div>
            </div>
            <WebsitePageEditorForm
              key={page.id}
              page={page}
              values={values}
              uploaderId={uploaderId}
            />
            <ActionForm
              action={resetWebsitePageContent.bind(null, page.id)}
              successMessage={`${page.label} page restored to its original content.`}
              className="mt-7 border-t border-[#333] pt-5"
            >
              <p className="mb-4 text-sm text-[#888]">
                Restore every field on this page to the version included with the site.
              </p>
              <button className="button secondary" type="submit">
                Restore page defaults
              </button>
            </ActionForm>
          </>
        )}
      </div>
    </div>
  );
}
