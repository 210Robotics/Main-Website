"use client";

import { upload } from "@vercel/blob/client";
import { mergeAttributes, Node } from "@tiptap/core";
import Highlight from "@tiptap/extension-highlight";
import ImageExtension from "@tiptap/extension-image";
import Placeholder from "@tiptap/extension-placeholder";
import {
  Table,
  TableCell,
  TableHeader,
  TableRow,
} from "@tiptap/extension-table";
import TaskItem from "@tiptap/extension-task-item";
import TaskList from "@tiptap/extension-task-list";
import TextAlign from "@tiptap/extension-text-align";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import {
  Bold,
  AlignCenter,
  AlignLeft,
  AlignRight,
  Braces,
  ChevronDown,
  Code2,
  Columns3,
  Eye,
  FilePlus2,
  Focus,
  Heading1,
  Heading2,
  Heading3,
  ImagePlus,
  Highlighter,
  Italic,
  Link2,
  List,
  ListChecks,
  ListOrdered,
  Minus,
  Quote,
  RemoveFormatting,
  Redo2,
  Rows3,
  Strikethrough,
  Table2,
  Trash2,
  Undo2,
  Underline,
  Upload,
  X,
} from "lucide-react";
import { useRef, useState, type ReactNode } from "react";
import { finalizeNotebookImageUpload } from "@/app/upload-actions";

const LinkEmbedExtension = Node.create({
  name: "linkEmbed",
  group: "block",
  atom: true,
  draggable: true,
  addAttributes() {
    return {
      href: { default: "" },
      title: { default: "Linked resource" },
    };
  },
  parseHTML() {
    return [{ tag: 'a[data-link-embed="true"]' }];
  },
  renderHTML({ HTMLAttributes }) {
    const href = String(HTMLAttributes.href || "");
    const title = String(HTMLAttributes.title || href || "Linked resource");
    return [
      "a",
      mergeAttributes(HTMLAttributes, {
        "data-link-embed": "true",
        class: "notebook-link-embed",
        href,
        target: "_blank",
        rel: "noreferrer",
      }),
      title,
    ];
  },
});

const starters = {
  design: {
    label: "Design decision",
    html: "<h2>Design decision</h2><p><strong>Problem:</strong> What constraint or opportunity are we addressing?</p><h3>Alternatives considered</h3><ul><li>Concept A</li><li>Concept B</li><li>Concept C</li></ul><h3>Evidence and tradeoffs</h3><p>Document sketches, calculations, prototypes, and constraints.</p><blockquote><p><strong>Decision:</strong> Record what the team selected and why.</p></blockquote><h3>Next verification</h3><ul data-type=\"taskList\"><li data-type=\"taskItem\" data-checked=\"false\"><label><input type=\"checkbox\"><span></span></label><div><p>Add acceptance criteria</p></div></li></ul>",
  },
  test: {
    label: "Test and verification",
    html: "<h2>Test and verification record</h2><p><strong>Question:</strong> What are we trying to learn or prove?</p><h3>Setup and variables</h3><table><tbody><tr><th>Variable</th><th>Target</th><th>Observed</th></tr><tr><td>Metric 1</td><td>Acceptance value</td><td>Result</td></tr></tbody></table><h3>Procedure</h3><ol><li>Prepare the test article.</li><li>Run the test consistently.</li><li>Capture photos, video, and measurements.</li></ol><h3>Results</h3><p>Describe what happened, including failures and unexpected behavior.</p><blockquote><p><strong>Conclusion:</strong> Pass, fail, or revise with rationale.</p></blockquote>",
  },
  build: {
    label: "Build log",
    html: "<h2>Build log</h2><p><strong>Build objective:</strong> Describe the assembly, part, or integration work.</p><h3>Work completed</h3><ul data-type=\"taskList\"><li data-type=\"taskItem\" data-checked=\"false\"><label><input type=\"checkbox\"><span></span></label><div><p>Manufacture or prepare components</p></div></li><li data-type=\"taskItem\" data-checked=\"false\"><label><input type=\"checkbox\"><span></span></label><div><p>Assemble and inspect</p></div></li></ul><h3>Issues and changes</h3><p>Capture fit problems, rework, tolerances, and design changes.</p><h3>Evidence</h3><p>Add photos, measurements, links, and responsible team members.</p>",
  },
  competition: {
    label: "Competition record",
    html: "<h2>Competition record</h2><p><strong>Event and match:</strong> Record the competition context.</p><h3>Strategy and roles</h3><p>Describe both robot roles, alliance coordination, and expected scoring pattern.</p><h3>Observed performance</h3><table><tbody><tr><th>Metric</th><th>Plan</th><th>Actual</th></tr><tr><td>Autonomous</td><td>Target</td><td>Result</td></tr><tr><td>Driver control</td><td>Target</td><td>Result</td></tr></tbody></table><h3>Lessons learned</h3><p>Connect scouting evidence to design, software, and practice updates.</p><blockquote><p><strong>Action:</strong> State the next change and owner.</p></blockquote>",
  },
} as const;

type StarterKey = keyof typeof starters;

export function NotebookEditor({
  name = "contentHtml",
  initial = "<h2>What we worked on</h2><p>Document the problem, evidence, iterations, and what changed.</p>",
  uploaderId,
}: {
  name?: string;
  initial?: string;
  uploaderId?: string;
}) {
  const [html, setHtml] = useState(initial);
  const [preview, setPreview] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [starter, setStarter] = useState<StarterKey>("design");
  const [stats, setStats] = useState(() => calculateStats(initial, ""));
  const [notice, setNotice] = useState("");
  const [imageBusy, setImageBusy] = useState(false);
  const imageInput = useRef<HTMLInputElement>(null);
  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({ link: { openOnClick: false } }),
      Highlight,
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      ImageExtension.configure({ allowBase64: false }),
      TaskList,
      TaskItem.configure({ nested: true }),
      Table.configure({ resizable: true }),
      TableRow,
      TableHeader,
      TableCell,
      LinkEmbedExtension,
      Placeholder.configure({
        placeholder:
          "Capture sketches, alternatives, calculations, failures, test evidence, and decisions...",
      }),
    ],
    content: initial,
    editorProps: {
      attributes: {
        class:
          "docs-editor-content notebook-page-content min-h-[720px] focus:outline-none",
        "aria-label": "Engineering notebook page content",
      },
    },
    onCreate: ({ editor: current }) =>
      setStats(calculateStats(current.getHTML(), current.getText())),
    onUpdate: ({ editor: current }) => {
      const currentHtml = current.getHTML();
      setHtml(currentHtml);
      setStats(calculateStats(currentHtml, current.getText()));
    },
  });

  if (!editor)
    return (
      <div className="min-h-[720px] animate-pulse border border-[#333] bg-[#111]" />
    );
  const activeEditor = editor;

  function link() {
    const href = window.prompt("Link URL", activeEditor.getAttributes("link").href || "https://");
    if (!href) return;
    activeEditor.chain().focus().extendMarkRange("link").setLink({ href }).run();
  }

  function image() {
    const src = window.prompt("Image URL", "https://");
    if (!src) return;
    const alt = window.prompt("Image description") || "Engineering notebook image";
    activeEditor.chain().focus().setImage({ src, alt }).run();
  }

  async function uploadImage(file: File | undefined) {
    if (!file || !uploaderId) return;
    if (file.size > 5 * 1024 * 1024) {
      setNotice("Choose a photo smaller than 5 MB.");
      return;
    }
    setImageBusy(true);
    setNotice("Uploading photo...");
    try {
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "-");
      const pathname = `uploads/notebook-image/${uploaderId}/${crypto.randomUUID()}-${safeName}`;
      const blob = await upload(pathname, file, {
        access: "private",
        handleUploadUrl: "/api/uploads",
        clientPayload: JSON.stringify({ purpose: "notebook-image" }),
      });
      const finalized = await finalizeNotebookImageUpload({
        pathname: blob.pathname,
        filename: file.name,
        contentType: file.type || "image/jpeg",
        size: file.size,
      });
      activeEditor
        .chain()
        .focus()
        .setImage({
          src: finalized.url,
          alt: file.name.replace(/\.[^.]+$/, ""),
        })
        .run();
      setNotice("Photo embedded. Add a caption below it for context.");
    } catch (error) {
      console.error("Notebook photo upload failed", error);
      setNotice("Photo upload failed. Check the file type and try again.");
    } finally {
      setImageBusy(false);
      if (imageInput.current) imageInput.current.value = "";
    }
  }

  function embedLink() {
    const href = window.prompt("Resource URL", "https://");
    if (!href) return;
    const title = window.prompt("Link card title", "Linked evidence") || href;
    activeEditor
      .chain()
      .focus()
      .insertContent({ type: "linkEmbed", attrs: { href, title } })
      .run();
  }

  function loadStarter() {
    if (!activeEditor.isEmpty && !window.confirm("Replace the current page content with this starter layout?"))
      return;
    activeEditor.commands.setContent(starters[starter].html, { emitUpdate: true });
    activeEditor.commands.focus("start");
  }

  function togglePreview() {
    const next = !preview;
    setPreview(next);
    activeEditor.setEditable(!next);
  }

  return (
    <section
      className={`notebook-editor-shell overflow-hidden border border-[#393939] bg-[#0b0b0b] shadow-2xl ${
        fullscreen ? "fixed inset-0 z-[100] flex flex-col" : ""
      }`}
    >
      <header className="flex flex-wrap items-center justify-between gap-4 border-b border-[#303030] bg-[#121212] px-4 py-3 md:px-5">
        <div className="flex items-center gap-3">
          <span className="grid size-10 place-items-center bg-[#fd7803] text-black">
            <FilePlus2 className="size-5" />
          </span>
          <div>
            <p className="text-sm font-bold text-white">210 Notebook Studio</p>
            <p className="font-mono text-[.65rem] uppercase tracking-[.16em] text-[#777]">
              {preview ? "Publication preview" : "Live page editor"}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="hidden rounded-full border border-[#333] px-3 py-1 font-mono text-[.65rem] uppercase tracking-wider text-[#888] sm:inline-flex">
            {stats.pages} {stats.pages === 1 ? "page" : "pages"} · {stats.words} words
          </span>
          <button
            className={`button-ghost min-h-10 px-3 text-xs ${preview ? "border-[#fd7803] text-[#fd7803]" : ""}`}
            type="button"
            onClick={togglePreview}
          >
            <Eye className="size-4" />
            {preview ? "Edit" : "Preview"}
          </button>
          <button
            className="button-ghost min-h-10 px-3 text-xs"
            type="button"
            aria-label={fullscreen ? "Exit focus mode" : "Open focus mode"}
            onClick={() => setFullscreen((value) => !value)}
          >
            {fullscreen ? <X className="size-4" /> : <Focus className="size-4" />}
            {fullscreen ? "Exit" : "Focus"}
          </button>
        </div>
      </header>

      {!preview && (
        <>
          <div className="flex flex-wrap items-end gap-3 border-b border-[#303030] bg-[#171717] px-4 py-3 md:px-5">
            <label className="grid min-w-[220px] gap-1 text-xs font-semibold text-[#aaa]">
              Page starter
              <span className="relative">
                <select
                  className="input min-h-10 w-full appearance-none pr-10 text-sm"
                  value={starter}
                  onChange={(event) => setStarter(event.target.value as StarterKey)}
                >
                  {Object.entries(starters).map(([key, value]) => (
                    <option key={key} value={key}>
                      {value.label}
                    </option>
                  ))}
                </select>
                <ChevronDown className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-[#777]" />
              </span>
            </label>
            <button className="button-ghost min-h-10 text-xs" type="button" onClick={loadStarter}>
              <Braces className="size-4" />
              Load starter layout
            </button>
            <p className="max-w-xl text-xs leading-relaxed text-[#777]">
              Starters create an editable structure for decisions, tests, build logs, and competition evidence.
            </p>
          </div>
          <div
            className="flex flex-wrap gap-1.5 border-b border-[#303030] bg-[#101010] p-2.5 md:px-4"
            role="toolbar"
            aria-label="Notebook formatting"
          >
            <ToolbarGroup label="History">
              <Tool label="Undo" onClick={() => editor.chain().focus().undo().run()}><Undo2 /></Tool>
              <Tool label="Redo" onClick={() => editor.chain().focus().redo().run()}><Redo2 /></Tool>
            </ToolbarGroup>
            <ToolbarGroup label="Headings">
              <Tool label="Heading 1" active={editor.isActive("heading", { level: 1 })} onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}><Heading1 /></Tool>
              <Tool label="Heading 2" active={editor.isActive("heading", { level: 2 })} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}><Heading2 /></Tool>
              <Tool label="Heading 3" active={editor.isActive("heading", { level: 3 })} onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}><Heading3 /></Tool>
            </ToolbarGroup>
            <ToolbarGroup label="Text">
              <Tool label="Bold" active={editor.isActive("bold")} onClick={() => editor.chain().focus().toggleBold().run()}><Bold /></Tool>
              <Tool label="Italic" active={editor.isActive("italic")} onClick={() => editor.chain().focus().toggleItalic().run()}><Italic /></Tool>
              <Tool label="Underline" active={editor.isActive("underline")} onClick={() => editor.chain().focus().toggleUnderline().run()}><Underline /></Tool>
              <Tool label="Strike" active={editor.isActive("strike")} onClick={() => editor.chain().focus().toggleStrike().run()}><Strikethrough /></Tool>
              <Tool label="Highlight" active={editor.isActive("highlight")} onClick={() => editor.chain().focus().toggleHighlight().run()}><Highlighter /></Tool>
              <Tool label="Inline code" active={editor.isActive("code")} onClick={() => editor.chain().focus().toggleCode().run()}><Code2 /></Tool>
              <Tool label="Clear formatting" onClick={() => editor.chain().focus().unsetAllMarks().clearNodes().run()}><RemoveFormatting /></Tool>
            </ToolbarGroup>
            <ToolbarGroup label="Alignment">
              <Tool label="Align left" active={editor.isActive({ textAlign: "left" })} onClick={() => editor.chain().focus().setTextAlign("left").run()}><AlignLeft /></Tool>
              <Tool label="Align center" active={editor.isActive({ textAlign: "center" })} onClick={() => editor.chain().focus().setTextAlign("center").run()}><AlignCenter /></Tool>
              <Tool label="Align right" active={editor.isActive({ textAlign: "right" })} onClick={() => editor.chain().focus().setTextAlign("right").run()}><AlignRight /></Tool>
            </ToolbarGroup>
            <ToolbarGroup label="Lists">
              <Tool label="Bulleted list" active={editor.isActive("bulletList")} onClick={() => editor.chain().focus().toggleBulletList().run()}><List /></Tool>
              <Tool label="Numbered list" active={editor.isActive("orderedList")} onClick={() => editor.chain().focus().toggleOrderedList().run()}><ListOrdered /></Tool>
              <Tool label="Task list" active={editor.isActive("taskList")} onClick={() => editor.chain().focus().toggleTaskList().run()}><ListChecks /></Tool>
            </ToolbarGroup>
            <ToolbarGroup label="Blocks">
              <Tool label="Quote" active={editor.isActive("blockquote")} onClick={() => editor.chain().focus().toggleBlockquote().run()}><Quote /></Tool>
              <Tool label="Code block" active={editor.isActive("codeBlock")} onClick={() => editor.chain().focus().toggleCodeBlock().run()}><Braces /></Tool>
              <Tool label="Divider" onClick={() => editor.chain().focus().setHorizontalRule().run()}><Minus /></Tool>
            </ToolbarGroup>
            <ToolbarGroup label="Insert">
              <Tool label="Link" active={editor.isActive("link")} onClick={link}><Link2 /></Tool>
              <Tool label="Embed link card" onClick={embedLink}><Link2 /></Tool>
              {uploaderId && <Tool label={imageBusy ? "Uploading photo" : "Upload photo"} onClick={() => imageInput.current?.click()}><Upload /></Tool>}
              <Tool label="Image URL" onClick={image}><ImagePlus /></Tool>
              <Tool label="Table" active={editor.isActive("table")} onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}><Table2 /></Tool>
            </ToolbarGroup>
            <input
              ref={imageInput}
              className="sr-only"
              type="file"
              accept="image/jpeg,image/png,image/webp,image/avif,image/heic,image/heif,.heic,.heif"
              disabled={imageBusy}
              onChange={(event) => void uploadImage(event.target.files?.[0])}
            />
          </div>
          {editor.isActive("table") && (
            <div className="flex flex-wrap items-center gap-2 border-b border-[#303030] bg-[#171717] px-4 py-2 text-xs">
              <span className="mr-2 font-mono uppercase tracking-wider text-[#777]">Table tools</span>
              <MiniTool label="Add column" onClick={() => editor.chain().focus().addColumnAfter().run()}><Columns3 /></MiniTool>
              <MiniTool label="Remove column" onClick={() => editor.chain().focus().deleteColumn().run()}><Trash2 /></MiniTool>
              <MiniTool label="Add row" onClick={() => editor.chain().focus().addRowAfter().run()}><Rows3 /></MiniTool>
              <MiniTool label="Remove row" onClick={() => editor.chain().focus().deleteRow().run()}><Trash2 /></MiniTool>
              <MiniTool label="Delete table" onClick={() => editor.chain().focus().deleteTable().run()}><X /></MiniTool>
            </div>
          )}
        </>
      )}

      <div className={`notebook-editor-stage ${fullscreen ? "min-h-0 flex-1 overflow-y-auto" : ""}`}>
        <div className="notebook-page-ruler" aria-hidden="true">
          <span>210</span>
          <span>ENGINEERING NOTEBOOK</span>
        </div>
        <div className={`notebook-page-canvas ${preview ? "is-preview" : ""}`}>
          <div className="notebook-page-brand" aria-hidden="true">
            <span>210 ROBOTICS</span>
            <span>LIVE ENGINEERING RECORD</span>
          </div>
          <EditorContent editor={editor} />
          <div className="notebook-page-footer" aria-hidden="true">
            <span>210 Robotics · Engineering Notebook</span>
            <span>Live draft</span>
          </div>
        </div>
      </div>
      <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-[#303030] bg-[#121212] px-4 py-2 font-mono text-[.65rem] uppercase tracking-wider text-[#777] md:px-5">
        <span aria-live="polite">{notice || (preview ? "Previewing the saved document layout" : "Changes are captured when you save this notebook version")}</span>
        <span>{stats.characters} characters · {stats.words} words · {stats.pages} pages</span>
      </footer>
      <input type="hidden" name={name} value={html} readOnly />
    </section>
  );
}

function calculateStats(html: string, text: string) {
  const plain = text || html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  return {
    words: plain ? plain.split(/\s+/).length : 0,
    characters: plain.length,
    pages: 1,
  };
}

function ToolbarGroup({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-center gap-1 border-r border-[#303030] pr-1.5 last:border-r-0" aria-label={label}>
      {children}
    </div>
  );
}

function Tool({
  label,
  active = false,
  onClick,
  children,
}: {
  label: string;
  active?: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      className={`grid size-9 place-items-center border transition ${
        active
          ? "border-[#fd7803] bg-[#fd7803]/10 text-[#fd7803]"
          : "border-transparent text-[#aaa] hover:border-[#555] hover:bg-[#202020] hover:text-white"
      }`}
      type="button"
      aria-label={label}
      aria-pressed={active}
      title={label}
      onClick={onClick}
    >
      <span className="[&>svg]:size-4">{children}</span>
    </button>
  );
}

function MiniTool({ label, onClick, children }: { label: string; onClick: () => void; children: ReactNode }) {
  return (
    <button className="inline-flex min-h-8 items-center gap-1.5 border border-[#393939] px-2 text-[#aaa] hover:border-[#777] hover:text-white" type="button" onClick={onClick}>
      <span className="[&>svg]:size-3.5">{children}</span>
      {label}
    </button>
  );
}
