"use client";

import { upload } from "@vercel/blob/client";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import LinkExtension from "@tiptap/extension-link";
import ImageExtension from "@tiptap/extension-image";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import Placeholder from "@tiptap/extension-placeholder";
import {
  Table,
  TableCell,
  TableHeader,
  TableRow,
} from "@tiptap/extension-table";
import {
  Archive,
  Bold,
  ChevronDown,
  ChevronUp,
  Code2,
  Columns3,
  FileCode2,
  GripVertical,
  Heading2,
  ImagePlus,
  Italic,
  Link2,
  List,
  ListChecks,
  Quote,
  Redo2,
  Rows3,
  Save,
  Send,
  Table2,
  Trash2,
  Undo2,
} from "lucide-react";
import { useRouter } from "next/navigation";
import {
  useActionState,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";
import {
  acquireDocLock,
  archiveDocPage,
  createDocCategory,
  createDocPage,
  removeDocCategory,
  reorderDocumentationStructure,
  saveDocPage,
  type DocActionState,
} from "@/app/admin/doc-actions";
import { finalizeMediaUpload } from "@/app/upload-actions";
import {
  documentationHtmlToMarkdown,
  markdownToDocumentationHtml,
} from "@/lib/doc-format";

type Category = {
  id: string;
  parentId: string | null;
  slug: string;
  title: string;
  sortOrder: number;
};

type Page = {
  id: string;
  categoryId: string;
  title: string;
  path: string;
  summary: string;
  bodyHtml: string;
  bodyJson: Record<string, unknown>;
  visibility: "PUBLIC" | "MEMBERS_ONLY";
  status: "DRAFT" | "PUBLISHED" | "ARCHIVED";
  sortOrder: number;
  updatedAt: string;
};

type DragItem = { type: "category" | "page"; id: string };

type EditorMode = "rich" | "markdown" | "html";

const initial: DocActionState = { status: "idle", message: "" };

export function DocsManager({
  categories,
  pages,
  uploaderId,
}: {
  categories: Category[];
  pages: Page[];
  uploaderId: string;
}) {
  const router = useRouter();
  const [structureCategories, setStructureCategories] = useState(categories);
  const [structurePages, setStructurePages] = useState(pages);
  const [dragged, setDragged] = useState<DragItem | null>(null);
  const [structureMessage, setStructureMessage] = useState("");
  const [structurePending, startStructureTransition] = useTransition();
  const [selectedId, setSelectedId] = useState(
    pages.find((page) => page.status !== "ARCHIVED")?.id ?? pages[0]?.id ?? "",
  );
  const selected = useMemo(
    () => structurePages.find((page) => page.id === selectedId) ?? null,
    [structurePages, selectedId],
  );
  const [categoryState, categoryAction, categoryPending] = useActionState(
    createDocCategory,
    initial,
  );
  const [pageState, pageAction, pagePending] = useActionState(
    createDocPage,
    initial,
  );

  function persistStructure(nextCategories: Category[], nextPages: Page[]) {
    setStructureCategories(nextCategories);
    setStructurePages(nextPages);
    setStructureMessage("Saving order...");
    startStructureTransition(async () => {
      const result = await reorderDocumentationStructure({
        categories: nextCategories.map((category) => category.id),
        pages: nextCategories.flatMap((category) =>
          nextPages
            .filter((page) => page.categoryId === category.id)
            .map((page) => ({ id: page.id, categoryId: category.id })),
        ),
      });
      setStructureMessage(result.message);
      if (result.status === "success") router.refresh();
    });
  }

  function moveCategory(id: string, targetId: string) {
    if (id === targetId) return;
    const next = [...structureCategories];
    const from = next.findIndex((category) => category.id === id);
    const target = next.findIndex((category) => category.id === targetId);
    if (from < 0 || target < 0) return;
    const [moved] = next.splice(from, 1);
    next.splice(target, 0, moved);
    persistStructure(next, structurePages);
  }

  function nudgeCategory(id: string, direction: -1 | 1) {
    const index = structureCategories.findIndex((category) => category.id === id);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= structureCategories.length) return;
    const next = [...structureCategories];
    [next[index], next[target]] = [next[target], next[index]];
    persistStructure(next, structurePages);
  }

  function movePage(id: string, categoryId: string, targetPageId?: string) {
    const moved = structurePages.find((page) => page.id === id);
    if (!moved) return;
    const without = structurePages.filter((page) => page.id !== id);
    const updated = { ...moved, categoryId };
    if (!targetPageId) {
      const lastIndex = without.reduce(
        (found, page, index) => page.categoryId === categoryId ? index : found,
        -1,
      );
      without.splice(lastIndex + 1, 0, updated);
    } else {
      const targetIndex = without.findIndex((page) => page.id === targetPageId);
      without.splice(targetIndex < 0 ? without.length : targetIndex, 0, updated);
    }
    persistStructure(structureCategories, without);
  }

  function nudgePage(id: string, direction: -1 | 1) {
    const page = structurePages.find((candidate) => candidate.id === id);
    if (!page) return;
    const siblings = structurePages.filter((candidate) => candidate.categoryId === page.categoryId);
    const index = siblings.findIndex((candidate) => candidate.id === id);
    const target = siblings[index + direction];
    if (!target) return;
    const next = [...structurePages];
    const fromIndex = next.findIndex((candidate) => candidate.id === id);
    const targetIndex = next.findIndex((candidate) => candidate.id === target.id);
    [next[fromIndex], next[targetIndex]] = [next[targetIndex], next[fromIndex]];
    persistStructure(structureCategories, next);
  }

  function removeCategory(category: Category) {
    const pageCount = structurePages.filter((page) => page.categoryId === category.id).length;
    const detail = pageCount
      ? ` Its ${pageCount} page${pageCount === 1 ? "" : "s"} will move to the next category.`
      : "";
    if (!window.confirm(`Remove "${category.title}"?${detail}`)) return;
    startStructureTransition(async () => {
      const result = await removeDocCategory(category.id);
      setStructureMessage(result.message);
      if (result.status === "success") router.refresh();
    });
  }

  return (
    <div className="docs-manager grid min-w-0 gap-6 lg:grid-cols-[280px_minmax(0,1fr)] xl:grid-cols-[300px_minmax(0,1fr)] xl:gap-8 2xl:grid-cols-[320px_minmax(0,1fr)]">
      <aside className="docs-manager-sidebar contents min-w-0 lg:grid lg:content-start lg:gap-5">
        <div className="order-1 overflow-hidden border border-[#333] bg-[#0b0b0b] p-4 sm:p-5 lg:order-none">
          <p className="eyebrow">Wiki structure</p>
          <div className="mt-4 grid gap-1">
            {structureCategories.map((category, categoryIndex) => (
              <div
                className="min-w-0 overflow-hidden border border-[#252525] bg-[#0d0d0d] transition hover:border-[#3a3a3a]"
                data-doc-category-id={category.id}
                key={category.id}
                draggable
                onDragStart={() => setDragged({ type: "category", id: category.id })}
                onDragEnd={() => setDragged(null)}
                onDragOver={(event) => event.preventDefault()}
                onDrop={(event) => {
                  event.preventDefault();
                  if (dragged?.type === "category") moveCategory(dragged.id, category.id);
                  if (dragged?.type === "page") movePage(dragged.id, category.id);
                  setDragged(null);
                }}
              >
                <div className="flex min-w-0 items-center gap-1 border-b border-[#252525] px-2 py-1">
                  <GripVertical className="size-4 shrink-0 cursor-grab text-[#666]" aria-hidden="true" />
                  <p
                    className="min-w-0 flex-1 truncate px-1 py-2 text-xs font-bold uppercase tracking-wider text-[#fd7803]"
                    title={category.title}
                  >
                    {category.title}
                  </p>
                  <button className="grid size-7 shrink-0 place-items-center text-[#777] hover:text-white disabled:opacity-30" type="button" aria-label={`Move ${category.title} up`} disabled={categoryIndex === 0 || structurePending} onClick={() => nudgeCategory(category.id, -1)}><ChevronUp size={14} /></button>
                  <button className="grid size-7 shrink-0 place-items-center text-[#777] hover:text-white disabled:opacity-30" type="button" aria-label={`Move ${category.title} down`} disabled={categoryIndex === structureCategories.length - 1 || structurePending} onClick={() => nudgeCategory(category.id, 1)}><ChevronDown size={14} /></button>
                  <button className="p-1 text-[#777] hover:text-red-300" type="button" aria-label={`Remove ${category.title}`} disabled={structurePending} onClick={() => removeCategory(category)}><Trash2 className="size-3.5" /></button>
                </div>
                {structurePages
                  .filter((page) => page.categoryId === category.id)
                  .map((page, pageIndex, siblingPages) => (
                    <div
                      className={`group flex min-w-0 items-stretch border-l transition ${page.id === selectedId ? "border-[#fd7803] bg-[#17120d]" : "border-[#333] bg-[#090909] hover:border-[#777]"}`}
                      data-doc-page-id={page.id}
                      key={page.id}
                      draggable
                      onDragStart={(event) => {
                        event.stopPropagation();
                        setDragged({ type: "page", id: page.id });
                      }}
                      onDragEnd={() => setDragged(null)}
                      onDragOver={(event) => event.preventDefault()}
                      onDrop={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        if (dragged?.type === "page") movePage(dragged.id, category.id, page.id);
                        setDragged(null);
                      }}
                    >
                      <GripVertical className="ml-2 mt-3 size-3.5 shrink-0 cursor-grab text-[#555]" aria-hidden="true" />
                      <button
                        type="button"
                        title={page.title}
                        onClick={() => setSelectedId(page.id)}
                        className={`min-w-0 flex-1 px-2 py-2 text-left text-sm ${page.id === selectedId ? "text-white" : "text-[#999] hover:text-white"}`}
                      >
                        <span className="block truncate">{page.title}</span>
                        <span className="mt-1 block text-[10px] uppercase tracking-wider text-[#666]">{page.status.replace("_", " ")}</span>
                      </button>
                      <span className="grid shrink-0 content-center pr-1 opacity-100 transition lg:opacity-0 lg:group-hover:opacity-100 lg:group-focus-within:opacity-100">
                        <button className="grid size-6 place-items-center text-[#777] hover:text-white disabled:opacity-30" type="button" aria-label={`Move ${page.title} up`} disabled={pageIndex === 0 || structurePending} onClick={() => nudgePage(page.id, -1)}><ChevronUp size={13} /></button>
                        <button className="grid size-6 place-items-center text-[#777] hover:text-white disabled:opacity-30" type="button" aria-label={`Move ${page.title} down`} disabled={pageIndex === siblingPages.length - 1 || structurePending} onClick={() => nudgePage(page.id, 1)}><ChevronDown size={13} /></button>
                      </span>
                    </div>
                  ))}
              </div>
            ))}
            {!structureCategories.length && (
              <p className="text-sm text-[#777]">Create a category to begin.</p>
            )}
          </div>
          <p className={`mt-3 text-xs ${structureMessage.toLowerCase().includes("could not") ? "text-red-300" : "text-[#777]"}`} aria-live="polite">
            {structurePending ? "Saving documentation order..." : structureMessage || "Drag pages between categories. Drag category headers to reorder sections."}
          </p>
        </div>
        <form
          action={categoryAction}
          className="order-3 grid gap-3 border border-[#333] p-4 lg:order-none"
        >
          <strong className="text-sm">Add category</strong>
          <input
            className="input"
            name="title"
            placeholder="Engineering notebook"
            required
          />
          <select className="input" name="parentId" defaultValue="">
            <option value="">Top-level category</option>
            {structureCategories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.title}
              </option>
            ))}
          </select>
          <button className="button secondary" disabled={categoryPending}>
            {categoryPending ? "Adding…" : "Add category"}
          </button>
          <ActionNote state={categoryState} />
        </form>
        <form
          action={pageAction}
          className="order-4 grid gap-3 border border-[#333] p-4 lg:order-none"
        >
          <strong className="text-sm">Add page</strong>
          <input
            className="input"
            name="title"
            placeholder="Drivetrain design"
            required
          />
          <select className="input" name="categoryId" required defaultValue="">
            <option value="" disabled>
              Choose category
            </option>
            {structureCategories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.title}
              </option>
            ))}
          </select>
          <select className="input" name="visibility" defaultValue="PUBLIC">
            <option value="PUBLIC">Public</option>
            <option value="MEMBERS_ONLY">Members only</option>
          </select>
          <button
            className="button secondary"
            disabled={pagePending || !structureCategories.length}
          >
            {pagePending ? "Adding…" : "Add page"}
          </button>
          <ActionNote state={pageState} />
        </form>
      </aside>
      {selected ? (
        <DocumentationEditor
          key={selected.id}
          page={selected}
          uploaderId={uploaderId}
        />
      ) : (
        <div className="order-2 grid min-h-96 place-items-center border border-dashed border-[#3a3a3a] p-8 text-center text-[#777] lg:order-none">
          Choose or create a page to open the editor.
        </div>
      )}
    </div>
  );
}

function DocumentationEditor({
  page,
  uploaderId,
}: {
  page: Page;
  uploaderId: string;
}) {
  const [title, setTitle] = useState(page.title);
  const [summary, setSummary] = useState(page.summary);
  const [visibility, setVisibility] = useState(page.visibility);
  const [message, setMessage] = useState("Opening editor…");
  const [dirty, setDirty] = useState(false);
  const [imageBusy, setImageBusy] = useState(false);
  const [mode, setMode] = useState<EditorMode>("rich");
  const [markdown, setMarkdown] = useState(() =>
    documentationHtmlToMarkdown(page.bodyHtml),
  );
  const [htmlSource, setHtmlSource] = useState(page.bodyHtml);
  const imageInput = useRef<HTMLInputElement>(null);
  const [pending, startTransition] = useTransition();
  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({ link: false }),
      LinkExtension.configure({ openOnClick: false }),
      ImageExtension,
      TaskList,
      TaskItem.configure({ nested: true }),
      Table.configure({
        resizable: true,
        renderWrapper: true,
        cellMinWidth: 110,
      }),
      TableRow,
      TableHeader,
      TableCell,
      Placeholder.configure({
        placeholder:
          "Start documenting the build, decisions, tests, and lessons learned…",
      }),
    ],
    content:
      page.bodyJson &&
      Object.keys(page.bodyJson).length &&
      (!page.bodyHtml.includes("<table") ||
        JSON.stringify(page.bodyJson).includes('"type":"table"'))
        ? page.bodyJson
        : page.bodyHtml,
    editorProps: {
      attributes: {
        class:
          "docs-editor-content min-h-[540px] px-4 py-6 focus:outline-none sm:px-6 md:px-8 xl:px-10",
      },
    },
    onUpdate: () => setDirty(true),
  });

  useEffect(() => {
    void acquireDocLock(page.id).then((result) => setMessage(result.message));
  }, [page.id]);

  useEffect(() => {
    if (!dirty || !editor) return;
    const timer = window.setTimeout(
      () =>
        startTransition(async () => {
          const bodyHtml =
            mode === "rich"
              ? editor.getHTML()
              : mode === "markdown"
                ? markdownToDocumentationHtml(markdown)
                : htmlSource;
          const result = await saveDocPage({
            pageId: page.id,
            title,
            summary,
            visibility,
            bodyHtml,
            bodyJson:
              mode === "rich"
                ? (editor.getJSON() as Record<string, unknown>)
                : {},
            reason: "autosave",
          });
          setMessage(result.message);
          if (result.status === "success") setDirty(false);
        }),
      1800,
    );
    return () => window.clearTimeout(timer);
  }, [dirty, editor, htmlSource, markdown, mode, page.id, summary, title, visibility]);

  function changeMode(nextMode: EditorMode) {
    if (!editor || nextMode === mode) return;
    const currentHtml =
      mode === "rich"
        ? editor.getHTML()
        : mode === "markdown"
          ? markdownToDocumentationHtml(markdown)
          : htmlSource;
    editor.commands.setContent(currentHtml, { emitUpdate: false });
    setHtmlSource(currentHtml);
    setMarkdown(documentationHtmlToMarkdown(currentHtml));
    setMode(nextMode);
  }

  function save(publish = false) {
    if (!editor) return;
    const bodyHtml =
      mode === "rich"
        ? editor.getHTML()
        : mode === "markdown"
          ? markdownToDocumentationHtml(markdown)
          : htmlSource;
    startTransition(async () => {
      const result = await saveDocPage({
        pageId: page.id,
        title,
        summary,
        visibility,
        bodyHtml,
        bodyJson:
          mode === "rich"
            ? (editor.getJSON() as Record<string, unknown>)
            : {},
        publish,
        reason: publish ? "publish" : "manual save",
      });
      setMessage(result.message);
      if (result.status === "success") setDirty(false);
    });
  }

  function addLink() {
    if (!editor) return;
    const href = window.prompt("Link URL");
    if (href) {
      editor.chain().focus().extendMarkRange("link").setLink({ href }).run();
    }
  }

  async function addImage(file: File | undefined) {
    if (!file || !editor) return;
    if (file.size > 5 * 1024 * 1024) {
      setMessage("Choose an image smaller than 5 MB.");
      return;
    }
    setImageBusy(true);
    setMessage("Uploading documentation image…");
    try {
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "-");
      const pathname = `uploads/doc-image/${uploaderId}/${crypto.randomUUID()}-${safeName}`;
      const blob = await upload(pathname, file, {
        access: "public",
        handleUploadUrl: "/api/uploads",
        clientPayload: JSON.stringify({ purpose: "doc-image" }),
      });
      const finalized = await finalizeMediaUpload({
        purpose: "doc-image",
        url: blob.url,
        pathname: blob.pathname,
        filename: file.name,
        contentType: file.type || "image/jpeg",
        size: file.size,
      });
      editor
        .chain()
        .focus()
        .setImage({
          src: finalized.url,
          alt: file.name.replace(/\.[^.]+$/, ""),
        })
        .run();
      setDirty(true);
      setMessage(
        "Image added. Add a caption or explanation below it, then publish.",
      );
    } catch (error) {
      console.error("Documentation image upload failed", error);
      setMessage("Image upload failed. Check the file type and try again.");
    } finally {
      setImageBusy(false);
      if (imageInput.current) imageInput.current.value = "";
    }
  }

  return (
    <div className="docs-manager-editor order-2 min-w-0 overflow-hidden border border-[#363636] bg-[#111] lg:order-none">
      <div className="grid min-w-0 gap-4 border-b border-[#333] p-4 sm:p-5 md:grid-cols-[minmax(0,1fr)_minmax(180px,220px)]">
        <div className="grid min-w-0 gap-3">
          <input
            className="input text-xl font-bold"
            value={title}
            onChange={(event) => {
              setTitle(event.target.value);
              setDirty(true);
            }}
            aria-label="Page title"
          />
          <textarea
            className="input min-h-20"
            value={summary}
            onChange={(event) => {
              setSummary(event.target.value);
              setDirty(true);
            }}
            placeholder="Short page summary"
            aria-label="Page summary"
          />
        </div>
        <div className="grid content-start gap-3">
          <select
            className="input"
            value={visibility}
            onChange={(event) => {
              setVisibility(event.target.value as typeof visibility);
              setDirty(true);
            }}
          >
            <option value="PUBLIC">Public</option>
            <option value="MEMBERS_ONLY">Members only</option>
          </select>
          <a
            className="button secondary text-center"
            href={`https://docs.210robotics.com/docs/${page.path}`}
            target="_blank"
            rel="noreferrer"
          >
            Open reader
          </a>
        </div>
      </div>
      <div className="grid min-w-0 gap-3 border-b border-[#333] bg-[#0d0d0d] px-3 py-3 sm:flex sm:flex-wrap sm:items-center sm:justify-between">
        <div className="flex max-w-full flex-wrap gap-1" role="tablist" aria-label="Editor format">
          <ModeButton active={mode === "rich"} onClick={() => changeMode("rich")}>
            Rich text
          </ModeButton>
          <ModeButton active={mode === "markdown"} onClick={() => changeMode("markdown")}>
            Markdown
          </ModeButton>
          <ModeButton active={mode === "html"} onClick={() => changeMode("html")}>
            HTML
          </ModeButton>
        </div>
        <p className="text-xs text-[#777]">
          {mode === "rich"
            ? "Visual editing"
            : mode === "markdown"
              ? "GitHub-flavored Markdown"
              : "Sanitized HTML source"}
        </p>
      </div>
      {mode === "rich" && (
        <div
          className="docs-editor-toolbar flex min-w-0 flex-wrap gap-1 border-b border-[#333] bg-[#151515] p-2 sm:p-3"
          role="toolbar"
          aria-label="Documentation formatting"
        >
          <Tool label="Undo" onClick={() => editor?.chain().focus().undo().run()}>
            <Undo2 />
          </Tool>
          <Tool label="Redo" onClick={() => editor?.chain().focus().redo().run()}>
            <Redo2 />
          </Tool>
          <Tool
            label="Bold"
            active={editor?.isActive("bold")}
            onClick={() => editor?.chain().focus().toggleBold().run()}
          >
            <Bold />
          </Tool>
          <Tool
            label="Italic"
            active={editor?.isActive("italic")}
            onClick={() => editor?.chain().focus().toggleItalic().run()}
          >
            <Italic />
          </Tool>
          <Tool
            label="Heading"
            active={editor?.isActive("heading", { level: 2 })}
            onClick={() =>
              editor?.chain().focus().toggleHeading({ level: 2 }).run()
            }
          >
            <Heading2 />
          </Tool>
          <Tool
            label="Bulleted list"
            active={editor?.isActive("bulletList")}
            onClick={() => editor?.chain().focus().toggleBulletList().run()}
          >
            <List />
          </Tool>
          <Tool
            label="Task list"
            active={editor?.isActive("taskList")}
            onClick={() => editor?.chain().focus().toggleTaskList().run()}
          >
            <ListChecks />
          </Tool>
          <Tool
            label="Quote"
            active={editor?.isActive("blockquote")}
            onClick={() => editor?.chain().focus().toggleBlockquote().run()}
          >
            <Quote />
          </Tool>
          <Tool
            label="Code block"
            active={editor?.isActive("codeBlock")}
            onClick={() => editor?.chain().focus().toggleCodeBlock().run()}
          >
            <Code2 />
          </Tool>
          <Tool
            label="Link"
            active={editor?.isActive("link")}
            onClick={addLink}
          >
            <Link2 />
          </Tool>
          <Tool
            label={imageBusy ? "Uploading image" : "Add image"}
            onClick={() => imageInput.current?.click()}
          >
            <ImagePlus />
          </Tool>
          <span className="mx-1 hidden h-9 w-px bg-[#333] sm:block" aria-hidden="true" />
          <Tool
            label="Insert 3 by 3 table"
            onClick={() =>
              editor
                ?.chain()
                .focus()
                .insertTable({ rows: 3, cols: 3, withHeaderRow: true })
                .run()
            }
          >
            <Table2 />
          </Tool>
          <Tool
            label="Add table row"
            onClick={() => editor?.chain().focus().addRowAfter().run()}
          >
            <Rows3 />
          </Tool>
          <Tool
            label="Add table column"
            onClick={() => editor?.chain().focus().addColumnAfter().run()}
          >
            <Columns3 />
          </Tool>
          <Tool
            label="Delete table"
            onClick={() => editor?.chain().focus().deleteTable().run()}
          >
            <Trash2 />
          </Tool>
          <input
            ref={imageInput}
            className="sr-only"
            type="file"
            accept="image/jpeg,image/png,image/webp,image/avif,image/heic,image/heif,.heic,.heif"
            disabled={imageBusy}
            onChange={(event) => void addImage(event.target.files?.[0])}
          />
        </div>
      )}
      <div className={mode === "rich" ? "docs-editor-stage min-w-0 overflow-hidden" : "hidden"} aria-hidden={mode !== "rich"}>
        <EditorContent editor={editor} />
      </div>
      {mode === "markdown" && (
        <SourceEditor
          label="Markdown source"
          value={markdown}
          onChange={(value) => {
            setMarkdown(value);
            setDirty(true);
          }}
          hint="Headings, lists, task lists, links, tables, fenced code blocks, and inline HTML are supported."
        />
      )}
      {mode === "html" && (
        <SourceEditor
          label="HTML source"
          value={htmlSource}
          onChange={(value) => {
            setHtmlSource(value);
            setDirty(true);
          }}
          hint="HTML is sanitized on save. Scripts, event handlers, and unsafe attributes are removed before publishing."
        />
      )}
      <div className="grid min-w-0 gap-4 border-t border-[#333] p-4 sm:flex sm:flex-wrap sm:items-center sm:justify-between">
        <p className="text-xs text-[#888]" aria-live="polite">
          {pending ? "Saving…" : dirty ? "Unsaved changes" : message}
        </p>
        <div className="grid gap-2 sm:flex sm:flex-wrap">
          <button
            className="button secondary"
            type="button"
            onClick={() => startTransition(() => archiveDocPage(page.id))}
          >
            <Archive size={16} />
            Archive
          </button>
          <button
            className="button secondary"
            type="button"
            onClick={() => save(false)}
            disabled={pending}
          >
            <Save size={16} />
            Save draft
          </button>
          <button
            className="button"
            type="button"
            onClick={() => save(true)}
            disabled={pending}
          >
            <Send size={16} />
            Publish
          </button>
        </div>
      </div>
    </div>
  );
}

function ModeButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={`inline-flex min-h-9 items-center gap-2 border px-3 text-xs font-bold transition ${active ? "border-[#fd7803] bg-[#28190f] text-[#fd7803]" : "border-[#333] text-[#999] hover:border-[#666] hover:text-white"}`}
    >
      {children}
    </button>
  );
}

function SourceEditor({
  label,
  value,
  onChange,
  hint,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  hint: string;
}) {
  return (
    <label className="block min-w-0 p-4 md:p-6">
      <span className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-[.1em] text-[#fd7803]">
        <FileCode2 size={15} />
        {label}
      </span>
      <textarea
        className="min-h-[540px] w-full max-w-full resize-y overflow-auto whitespace-pre border border-[#353535] bg-[#090909] p-4 font-mono text-sm leading-7 text-[#e7e2d9] outline-none transition focus:border-[#fd7803] sm:p-5"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        spellCheck={false}
        aria-label={label}
      />
      <span className="mt-3 block text-xs leading-5 text-[#777]">{hint}</span>
    </label>
  );
}

function Tool({
  label,
  active,
  onClick,
  children,
}: {
  label: string;
  active?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      className={`calendar-control !h-9 !w-9 ${active ? "border-[#fd7803] text-[#fd7803]" : ""}`}
      aria-label={label}
      title={label}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

function ActionNote({ state }: { state: DocActionState }) {
  return state.message ? (
    <p
      className={`text-xs ${state.status === "error" ? "text-red-400" : "text-emerald-400"}`}
      aria-live="polite"
    >
      {state.message}
    </p>
  ) : null;
}
