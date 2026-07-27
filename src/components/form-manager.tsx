"use client";

import { upload } from "@vercel/blob/client";
import ImageExtension from "@tiptap/extension-image";
import LinkExtension from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import {
  ArrowDown,
  ArrowUp,
  BarChart3,
  Bold,
  CheckSquare,
  ClipboardCopy,
  Copy,
  Download,
  Eye,
  FileText,
  Heading2,
  ImagePlus,
  Italic,
  Link2,
  List,
  Plus,
  Printer,
  QrCode,
  Save,
  Search,
  Trash2,
  X,
} from "lucide-react";
import QRCode from "qrcode";
import Image from "next/image";
import {
  useActionState,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";
import {
  createPublicForm,
  deletePublicForm,
  deletePublicFormResponse,
  duplicatePublicForm,
  savePublicForm,
  type FormManagerState,
} from "@/app/admin/form-actions";
import { finalizeMediaUpload } from "@/app/upload-actions";
import {
  blankFormField,
  formFieldTypeLabels,
  formFieldTypes,
  optionFieldTypes,
  type PublicFormAnswer,
  type PublicFormField,
} from "@/lib/form-types";
import { formatFileSize } from "@/lib/form-files";

type FormRecord = {
  id: string;
  accessKey: string;
  title: string;
  descriptionHtml: string;
  confirmationMessage: string;
  fields: PublicFormField[];
  status: "DRAFT" | "OPEN" | "CLOSED";
  responseCount: number;
  updatedAt: string;
};

type ResponseRecord = {
  id: string;
  formId: string;
  answers: PublicFormAnswer[];
  submittedAt: string;
  updatedAt: string;
  respondentName: string;
  respondentEmail: string;
  memberName: string | null;
};

const initial: FormManagerState = { status: "idle", message: "" };

export function FormManager({
  forms,
  responses,
  uploaderId,
}: {
  forms: FormRecord[];
  responses: ResponseRecord[];
  uploaderId: string;
}) {
  const [selectedId, setSelectedId] = useState(forms[0]?.id ?? "");
  const [query, setQuery] = useState("");
  const createDialog = useRef<HTMLDialogElement>(null);
  const [createState, createAction, createPending] = useActionState(
    async (previous: FormManagerState, formData: FormData) => {
      const result = await createPublicForm(previous, formData);
      if (result.status === "success" && result.formId) {
        setSelectedId(result.formId);
        createDialog.current?.close();
      }
      return result;
    },
    initial,
  );
  const selected =
    forms.find((form) => form.id === selectedId) ?? forms[0] ?? null;
  const filtered = forms.filter((form) =>
    form.title.toLowerCase().includes(query.toLowerCase()),
  );

  return (
    <div className="grid gap-6 xl:grid-cols-[300px_minmax(0,1fr)]">
      <aside className="grid content-start gap-4">
        <div className="border border-[#333] bg-[#0b0b0b] p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="eyebrow">Form library</p>
              <p className="mt-2 text-xs text-[#777]">{forms.length} total</p>
            </div>
            <button
              className="button !min-h-10 !px-3"
              type="button"
              onClick={() => createDialog.current?.showModal()}
            >
              <Plus size={16} /> New
            </button>
          </div>
          <label className="relative mt-4 block">
            <Search
              className="absolute left-3 top-1/2 -translate-y-1/2 text-[#666]"
              size={16}
            />
            <input
              className="input pl-9"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search forms"
            />
          </label>
          <div className="mt-4 grid gap-2">
            {filtered.map((form) => (
              <button
                key={form.id}
                type="button"
                onClick={() => setSelectedId(form.id)}
                className={`border p-3 text-left transition ${selected?.id === form.id ? "border-[#fd7803] bg-[#17120d]" : "border-[#2e2e2e] bg-[#0e0e0e] hover:border-[#666]"}`}
              >
                <span className="block truncate font-semibold">
                  {form.title}
                </span>
                <span className="mt-2 flex items-center justify-between gap-3 text-[11px] uppercase tracking-wider text-[#777]">
                  <span
                    className={
                      form.status === "OPEN"
                        ? "text-emerald-400"
                        : form.status === "CLOSED"
                          ? "text-amber-300"
                          : ""
                    }
                  >
                    {form.status}
                  </span>
                  <span>{form.responseCount} responses</span>
                </span>
              </button>
            ))}
            {!filtered.length && (
              <p className="border border-dashed border-[#333] p-5 text-center text-sm text-[#777]">
                No forms match.
              </p>
            )}
          </div>
        </div>
      </aside>
      {selected ? (
        <FormEditor
          key={selected.id}
          form={selected}
          responses={responses.filter(
            (response) => response.formId === selected.id,
          )}
          uploaderId={uploaderId}
        />
      ) : (
        <div className="grid min-h-96 place-items-center border border-dashed border-[#3a3a3a] p-8 text-center">
          <div>
            <FileText className="mx-auto text-[#555]" size={42} />
            <h3 className="mt-5 text-xl font-bold">Create your first form</h3>
            <p className="mt-2 text-sm text-[#777]">
              Build questions, open responses, then share the private link or QR
              code.
            </p>
            <button
              className="button mt-5"
              type="button"
              onClick={() => createDialog.current?.showModal()}
            >
              <Plus size={16} /> New form
            </button>
          </div>
        </div>
      )}
      <dialog
        ref={createDialog}
        className="admin-dialog w-[min(520px,calc(100vw-2rem))] bg-[#101010] p-0 text-white backdrop:bg-black/85"
      >
        <form
          action={createAction}
          className="border border-[#383838] p-6 md:p-8"
        >
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="eyebrow">New private-link form</p>
              <h2 className="mt-2 text-2xl font-bold">Start with a title.</h2>
            </div>
            <button
              type="button"
              aria-label="Close new form dialog"
              onClick={() => createDialog.current?.close()}
            >
              <X />
            </button>
          </div>
          <label className="field mt-6">
            <span>Form title</span>
            <input
              className="input"
              name="title"
              placeholder="Workshop interest form"
              required
            />
          </label>
          <div className="mt-6 flex flex-wrap items-center gap-4">
            <button className="button" disabled={createPending}>
              {createPending ? "Creating…" : "Create form"}
            </button>
            <p
              className={
                createState.status === "error"
                  ? "text-sm text-red-400"
                  : "text-sm text-emerald-400"
              }
              aria-live="polite"
            >
              {createState.message}
            </p>
          </div>
        </form>
      </dialog>
    </div>
  );
}

function FormEditor({
  form,
  responses,
  uploaderId,
}: {
  form: FormRecord;
  responses: ResponseRecord[];
  uploaderId: string;
}) {
  const [title, setTitle] = useState(form.title);
  const [confirmationMessage, setConfirmationMessage] = useState(
    form.confirmationMessage,
  );
  const [status, setStatus] = useState(form.status);
  const [fields, setFields] = useState(form.fields);
  const [message, setMessage] = useState("");
  const [imageBusy, setImageBusy] = useState(false);
  const [pending, startTransition] = useTransition();
  const imageInput = useRef<HTMLInputElement>(null);
  const shareDialog = useRef<HTMLDialogElement>(null);
  const resultsDialog = useRef<HTMLDialogElement>(null);
  const deleteDialog = useRef<HTMLDialogElement>(null);
  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit,
      LinkExtension.configure({ openOnClick: false }),
      ImageExtension,
      Placeholder.configure({
        placeholder:
          "Add instructions, links, images, or context for respondents…",
      }),
    ],
    content: form.descriptionHtml,
    editorProps: {
      attributes: {
        class: "form-builder-editor min-h-52 px-5 py-5 focus:outline-none",
      },
    },
  });

  function updateField(id: string, change: Partial<PublicFormField>) {
    setFields((current) =>
      current.map((field) =>
        field.id === id ? { ...field, ...change } : field,
      ),
    );
  }

  function addField(type: PublicFormField["type"]) {
    setFields((current) => [...current, blankFormField(type)]);
  }

  function moveField(index: number, direction: -1 | 1) {
    setFields((current) => {
      const target = index + direction;
      if (target < 0 || target >= current.length) return current;
      const next = [...current];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  function save() {
    startTransition(async () => {
      const result = await savePublicForm({
        id: form.id,
        title,
        descriptionHtml: editor?.getHTML() ?? form.descriptionHtml,
        confirmationMessage,
        status,
        fields,
      });
      setMessage(result.message);
    });
  }

  async function addImage(file: File | undefined) {
    if (!file || !editor) return;
    if (file.size > 5 * 1024 * 1024) {
      setMessage("Choose an image smaller than 5 MB.");
      return;
    }
    setImageBusy(true);
    setMessage("Uploading form image…");
    try {
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "-");
      const pathname = `uploads/form-image/${uploaderId}/${crypto.randomUUID()}-${safeName}`;
      const blob = await upload(pathname, file, {
        access: "public",
        handleUploadUrl: "/api/uploads",
        clientPayload: JSON.stringify({ purpose: "form-image" }),
      });
      const finalized = await finalizeMediaUpload({
        purpose: "form-image",
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
      setMessage("Image embedded. Save the form to publish the change.");
    } catch (error) {
      console.error("Form image upload failed", error);
      setMessage("Image upload failed. Check the file type and try again.");
    } finally {
      setImageBusy(false);
      if (imageInput.current) imageInput.current.value = "";
    }
  }

  function addLink() {
    const href = window.prompt("Link URL");
    if (href)
      editor?.chain().focus().extendMarkRange("link").setLink({ href }).run();
  }

  function duplicate() {
    startTransition(async () => {
      const result = await duplicatePublicForm(form.id);
      setMessage(result.message);
    });
  }

  function remove() {
    startTransition(async () => {
      const result = await deletePublicForm(form.id);
      setMessage(result.message);
      if (result.status === "success") deleteDialog.current?.close();
    });
  }

  return (
    <div className="min-w-0 overflow-hidden border border-[#363636] bg-[#0d0d0d]">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#333] bg-[#111] p-4 md:p-5">
        <div>
          <p className="eyebrow">Form editor</p>
          <p className="mt-2 text-xs text-[#777]">
            Updated {new Date(form.updatedAt).toLocaleString()}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            className="button secondary !min-h-10"
            type="button"
            onClick={() => resultsDialog.current?.showModal()}
          >
            <BarChart3 size={16} /> Responses ({form.responseCount})
          </button>
          <button
            className="button secondary !min-h-10"
            type="button"
            onClick={() => shareDialog.current?.showModal()}
          >
            <QrCode size={16} /> Share
          </button>
          <button
            className="button !min-h-10"
            type="button"
            disabled={pending}
            onClick={save}
          >
            <Save size={16} /> {pending ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
      <div className="grid gap-5 p-5 md:p-7">
        <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_190px]">
          <label className="field">
            <span>Form title</span>
            <input
              className="input text-lg font-bold"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
            />
          </label>
          <label className="field">
            <span>Response status</span>
            <select
              className="input"
              value={status}
              onChange={(event) =>
                setStatus(event.target.value as typeof status)
              }
            >
              <option value="DRAFT">Draft · private</option>
              <option value="OPEN">Open for responses</option>
              <option value="CLOSED">Closed</option>
            </select>
          </label>
        </div>
        <section>
          <p className="mb-2 text-xs font-bold uppercase tracking-wider text-[#aaa]">
            Form introduction
          </p>
          <div
            className="flex flex-wrap gap-1 border border-b-0 border-[#363636] bg-[#151515] p-2"
            role="toolbar"
            aria-label="Form introduction formatting"
          >
            <EditorTool
              label="Bold"
              active={editor?.isActive("bold")}
              onClick={() => editor?.chain().focus().toggleBold().run()}
            >
              <Bold />
            </EditorTool>
            <EditorTool
              label="Italic"
              active={editor?.isActive("italic")}
              onClick={() => editor?.chain().focus().toggleItalic().run()}
            >
              <Italic />
            </EditorTool>
            <EditorTool
              label="Heading"
              active={editor?.isActive("heading", { level: 2 })}
              onClick={() =>
                editor?.chain().focus().toggleHeading({ level: 2 }).run()
              }
            >
              <Heading2 />
            </EditorTool>
            <EditorTool
              label="List"
              active={editor?.isActive("bulletList")}
              onClick={() => editor?.chain().focus().toggleBulletList().run()}
            >
              <List />
            </EditorTool>
            <EditorTool
              label="Add link"
              active={editor?.isActive("link")}
              onClick={addLink}
            >
              <Link2 />
            </EditorTool>
            <EditorTool
              label={imageBusy ? "Uploading image" : "Embed image"}
              onClick={() => imageInput.current?.click()}
            >
              <ImagePlus />
            </EditorTool>
            <input
              ref={imageInput}
              className="sr-only"
              type="file"
              accept="image/jpeg,image/png,image/webp,image/avif,image/heic,image/heif,.heic,.heif"
              disabled={imageBusy}
              onChange={(event) => void addImage(event.target.files?.[0])}
            />
          </div>
          <div className="border border-[#363636] bg-[#101010]">
            <EditorContent editor={editor} />
          </div>
        </section>
        <section>
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="eyebrow">Questions</p>
              <h3 className="mt-2 text-xl font-bold">
                Build the response flow.
              </h3>
            </div>
            <label className="field !gap-1">
              <span>Add question</span>
              <select
                className="input !w-auto"
                value=""
                onChange={(event) => {
                  if (event.target.value)
                    addField(event.target.value as PublicFormField["type"]);
                }}
              >
                <option value="" disabled>
                  Choose a type…
                </option>
                {formFieldTypes.map((type) => (
                  <option value={type} key={type}>
                    {formFieldTypeLabels[type]}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="mt-4 grid gap-4">
            {fields.map((field, index) => (
              <QuestionEditor
                key={field.id}
                field={field}
                index={index}
                total={fields.length}
                onChange={(change) => updateField(field.id, change)}
                onMove={(direction) => moveField(index, direction)}
                onDuplicate={() =>
                  setFields((current) => [
                    ...current.slice(0, index + 1),
                    {
                      ...field,
                      id: crypto.randomUUID(),
                      label: `${field.label} copy`,
                    },
                    ...current.slice(index + 1),
                  ])
                }
                onDelete={() =>
                  setFields((current) =>
                    current.filter((item) => item.id !== field.id),
                  )
                }
              />
            ))}
            {!fields.length && (
              <button
                type="button"
                className="grid min-h-44 place-items-center border border-dashed border-[#3a3a3a] text-sm text-[#777] transition hover:border-[#fd7803] hover:text-white"
                onClick={() => addField("SHORT_TEXT")}
              >
                <span>
                  <Plus className="mx-auto mb-3" />
                  Add the first question
                </span>
              </button>
            )}
          </div>
        </section>
        <label className="field">
          <span>Confirmation message</span>
          <textarea
            className="input min-h-24"
            value={confirmationMessage}
            onChange={(event) => setConfirmationMessage(event.target.value)}
          />
        </label>
        <div className="flex flex-wrap items-center justify-between gap-4 border-t border-[#333] pt-5">
          <p
            className={
              message.toLowerCase().includes("could not") ||
              message.toLowerCase().includes("failed")
                ? "text-sm text-red-400"
                : "text-sm text-[#999]"
            }
            aria-live="polite"
          >
            {message || "Changes stay private until you save."}
          </p>
          <div className="flex flex-wrap gap-3">
            <button
              className="button secondary"
              type="button"
              onClick={duplicate}
              disabled={pending}
            >
              <Copy size={16} /> Duplicate
            </button>
            <button
              className="text-sm text-red-400 hover:text-red-300"
              type="button"
              onClick={() => deleteDialog.current?.showModal()}
            >
              <Trash2 className="inline" size={15} /> Delete form
            </button>
          </div>
        </div>
      </div>
      <ShareDialog dialogRef={shareDialog} form={form} />
      <ResultsDialog
        dialogRef={resultsDialog}
        form={form}
        responses={responses}
      />
      <dialog
        ref={deleteDialog}
        className="admin-dialog w-[min(540px,calc(100vw-2rem))] bg-[#101010] p-0 text-white backdrop:bg-black/85"
      >
        <div className="border border-red-500/40 p-6 md:p-8">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="eyebrow !text-red-400">Permanent action</p>
              <h2 className="mt-2 text-2xl font-bold">Delete this form?</h2>
            </div>
            <button
              type="button"
              aria-label="Close delete form dialog"
              onClick={() => deleteDialog.current?.close()}
            >
              <X />
            </button>
          </div>
          <p className="mt-5 text-sm leading-7 text-[#bbb]">
            <strong className="text-white">{form.title}</strong>, its private
            link, and all {form.responseCount} responses will be permanently
            deleted. This cannot be undone.
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <button
              className="button !border-red-500 !bg-red-500 !text-white"
              type="button"
              disabled={pending}
              onClick={remove}
            >
              <Trash2 size={16} />{" "}
              {pending ? "Deleting…" : "Delete permanently"}
            </button>
            <button
              className="button secondary"
              type="button"
              onClick={() => deleteDialog.current?.close()}
            >
              Keep form
            </button>
          </div>
        </div>
      </dialog>
    </div>
  );
}

function QuestionEditor({
  field,
  index,
  total,
  onChange,
  onMove,
  onDuplicate,
  onDelete,
}: {
  field: PublicFormField;
  index: number;
  total: number;
  onChange: (change: Partial<PublicFormField>) => void;
  onMove: (direction: -1 | 1) => void;
  onDuplicate: () => void;
  onDelete: () => void;
}) {
  return (
    <article className="border border-[#353535] bg-[#111] p-4 md:p-5">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#2e2e2e] pb-4">
        <div className="flex items-center gap-3">
          <span className="font-mono text-xs text-[#fd7803]">
            {String(index + 1).padStart(2, "0")}
          </span>
          <select
            className="input !min-h-10 !w-auto"
            value={field.type}
            onChange={(event) => {
              const type = event.target.value as PublicFormField["type"];
              onChange({
                type,
                options: optionFieldTypes.includes(type)
                  ? field.options.length >= 2
                    ? field.options
                    : ["Option 1", "Option 2"]
                  : [],
                maxFiles:
                  type === "FILE_UPLOAD" ? (field.maxFiles ?? 1) : undefined,
              });
            }}
          >
            {formFieldTypes.map((type) => (
              <option key={type} value={type}>
                {formFieldTypeLabels[type]}
              </option>
            ))}
          </select>
        </div>
        <div className="flex gap-1">
          <SmallIcon
            label="Move up"
            disabled={index === 0}
            onClick={() => onMove(-1)}
          >
            <ArrowUp />
          </SmallIcon>
          <SmallIcon
            label="Move down"
            disabled={index === total - 1}
            onClick={() => onMove(1)}
          >
            <ArrowDown />
          </SmallIcon>
          <SmallIcon label="Duplicate" onClick={onDuplicate}>
            <Copy />
          </SmallIcon>
          <SmallIcon label="Delete question" onClick={onDelete} danger>
            <Trash2 />
          </SmallIcon>
        </div>
      </div>
      <div className="mt-4 grid gap-4">
        <label className="field">
          <span>Question</span>
          <input
            className="input"
            value={field.label}
            onChange={(event) => onChange({ label: event.target.value })}
          />
        </label>
        <label className="field">
          <span>Help text (optional)</span>
          <input
            className="input"
            value={field.description}
            onChange={(event) => onChange({ description: event.target.value })}
            placeholder="Explain what kind of answer you need"
          />
        </label>
        {optionFieldTypes.includes(field.type) && (
          <label className="field">
            <span>Options · one per line</span>
            <textarea
              className="input min-h-28"
              value={field.options.join("\n")}
              onChange={(event) =>
                onChange({ options: event.target.value.split("\n") })
              }
            />
          </label>
        )}
        <label className="flex items-center gap-3 text-sm text-[#bbb]">
          <input
            type="checkbox"
            checked={field.required}
            onChange={(event) => onChange({ required: event.target.checked })}
          />
          Required question
        </label>
      </div>
      {field.type === "FILE_UPLOAD" && (
        <label className="field mt-4 max-w-xs">
          <span>Maximum files</span>
          <select
            className="input"
            value={field.maxFiles ?? 1}
            onChange={(event) =>
              onChange({ maxFiles: Number(event.target.value) })
            }
          >
            {[1, 2, 3, 4, 5].map((count) => (
              <option value={count} key={count}>
                {count}
              </option>
            ))}
          </select>
          <small className="text-[#777]">
            Documents, images, spreadsheets, and ZIP files up to 10 MB each.
          </small>
        </label>
      )}
    </article>
  );
}

function ShareDialog({
  dialogRef,
  form,
}: {
  dialogRef: React.RefObject<HTMLDialogElement | null>;
  form: FormRecord;
}) {
  const url = `https://210robotics.com/f/${form.accessKey}`;
  const [qr, setQr] = useState("");
  const [message, setMessage] = useState("");
  useEffect(() => {
    void QRCode.toDataURL(url, {
      width: 900,
      margin: 2,
      color: { dark: "#111111", light: "#ffffff" },
      errorCorrectionLevel: "H",
    }).then(setQr);
  }, [url]);
  async function copyLink() {
    try {
      await navigator.clipboard.writeText(url);
      setMessage("Link copied.");
    } catch {
      setMessage("Copy the link from the field below.");
    }
  }
  function printQr() {
    if (!qr) return;
    const popup = window.open("", "_blank", "width=760,height=900");
    if (!popup) {
      setMessage("Allow popups to print the QR code.");
      return;
    }
    const page = popup.document;
    page.title = `${form.title} QR`;
    const main = page.createElement("main");
    main.style.cssText =
      "font-family:Arial,sans-serif;text-align:center;padding:32px;color:#111";
    const heading = page.createElement("h1");
    heading.textContent = form.title;
    const image = page.createElement("img");
    image.src = qr;
    image.alt = `QR code for ${form.title}`;
    image.style.cssText = "width:min(620px,90vw);height:auto";
    const note = page.createElement("p");
    note.textContent = "Scan to open this 210 Robotics form.";
    main.append(heading, image, note);
    page.body.append(main);
    image.addEventListener("load", () => {
      popup.focus();
      popup.print();
    });
  }
  return (
    <dialog
      ref={dialogRef}
      className="admin-dialog w-[min(760px,calc(100vw-2rem))] bg-white p-0 text-[#111] backdrop:bg-black/90"
    >
      <div className="relative p-7 text-center md:p-10">
        <button
          className="absolute right-4 top-4"
          type="button"
          aria-label="Close sharing dialog"
          onClick={() => dialogRef.current?.close()}
        >
          <X />
        </button>
        <p className="text-xs font-bold uppercase tracking-[.18em] text-[#bd5600]">
          Private-link sharing
        </p>
        <h2 className="mt-3 text-3xl font-bold">{form.title}</h2>
        {form.status !== "OPEN" && (
          <p className="mx-auto mt-4 max-w-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
            Set the form status to Open and save before sharing. Draft links
            remain unavailable.
          </p>
        )}
        {qr && (
          <Image
            className="mx-auto mt-5 h-auto w-full max-w-[440px]"
            src={qr}
            alt={`QR code for ${form.title}`}
            width={900}
            height={900}
            unoptimized
          />
        )}
        <input
          className="mt-5 w-full border border-[#bbb] bg-[#f6f6f6] px-4 py-3 text-sm"
          readOnly
          value={url}
          aria-label="Form link"
        />
        <div className="mt-5 flex flex-wrap justify-center gap-3">
          <button
            className="button"
            type="button"
            onClick={() => void copyLink()}
          >
            <ClipboardCopy size={16} /> Copy link
          </button>
          <a
            className={`button ${qr ? "" : "pointer-events-none opacity-50"}`}
            href={qr || undefined}
            download={`${form.title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-qr.png`}
          >
            <Download size={16} /> Download QR
          </a>
          <button
            className="button"
            type="button"
            onClick={printQr}
            disabled={!qr}
          >
            <Printer size={16} /> Print QR
          </button>
          {form.status === "OPEN" && (
            <a
              className="button secondary !border-[#999] !text-[#222]"
              href={url}
              target="_blank"
              rel="noreferrer"
            >
              <Eye size={16} /> Open form
            </a>
          )}
        </div>
        <p className="mt-4 text-sm text-[#555]" aria-live="polite">
          {message ||
            "Only people with this exact link or QR code can open the form."}
        </p>
      </div>
    </dialog>
  );
}

function ResultsDialog({
  dialogRef,
  form,
  responses,
}: {
  dialogRef: React.RefObject<HTMLDialogElement | null>;
  form: FormRecord;
  responses: ResponseRecord[];
}) {
  const [tab, setTab] = useState<"analytics" | "responses">("analytics");
  const [query, setQuery] = useState("");
  const [message, setMessage] = useState("");
  const [pending, startTransition] = useTransition();
  const filtered = responses.filter((response) =>
    `${response.respondentName} ${response.respondentEmail} ${response.memberName ?? "anonymous"} ${response.answers.map((answer) => answerText(answer.value)).join(" ")}`
      .toLowerCase()
      .includes(query.toLowerCase()),
  );
  const analytics = useMemo(
    () => calculateAnalytics(form.fields, responses),
    [form.fields, responses],
  );
  function exportCsv() {
    const headers = [
      "Submitted",
      "Name",
      "Email",
      "Linked account",
      ...form.fields.map((field) => field.label),
    ];
    const rows = responses.map((response) => [
      response.submittedAt,
      response.respondentName,
      response.respondentEmail,
      response.memberName ?? "No linked account",
      ...form.fields.map((field) => {
        const answer = response.answers.find(
          (item) => item.fieldId === field.id,
        );
        return answer ? answerText(answer.value) : "";
      }),
    ]);
    const safeCell = (value: string) =>
      /^[=+\-@]/.test(value.trimStart()) ? `'${value}` : value;
    const csv = [headers, ...rows]
      .map((row) =>
        row
          .map((value) => `"${safeCell(String(value)).replaceAll('"', '""')}"`)
          .join(","),
      )
      .join("\n");
    const href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    const anchor = document.createElement("a");
    anchor.href = href;
    anchor.download = `${form.title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-responses.csv`;
    anchor.click();
    URL.revokeObjectURL(href);
  }
  function removeResponse(id: string) {
    if (!window.confirm("Delete this response permanently?")) return;
    startTransition(async () => {
      const result = await deletePublicFormResponse(id);
      setMessage(result.message);
    });
  }
  return (
    <dialog
      ref={dialogRef}
      className="admin-dialog h-[min(88vh,900px)] w-[min(1000px,calc(100vw-2rem))] bg-[#0d0d0d] p-0 text-white backdrop:bg-black/90"
    >
      <div className="flex h-full min-h-0 flex-col">
        <header className="flex flex-wrap items-start justify-between gap-4 border-b border-[#333] p-5 md:p-7">
          <div>
            <p className="eyebrow">Responses & analytics</p>
            <h2 className="mt-2 text-2xl font-bold">{form.title}</h2>
          </div>
          <button
            type="button"
            aria-label="Close response viewer"
            onClick={() => dialogRef.current?.close()}
          >
            <X />
          </button>
          <nav
            className="portal-tabs !mt-2 w-full"
            aria-label="Form response views"
          >
            <button
              className="portal-tab"
              aria-current={tab === "analytics" ? "page" : undefined}
              type="button"
              onClick={() => setTab("analytics")}
            >
              <BarChart3 size={16} /> Analytics
            </button>
            <button
              className="portal-tab"
              aria-current={tab === "responses" ? "page" : undefined}
              type="button"
              onClick={() => setTab("responses")}
            >
              <CheckSquare size={16} /> Responses
            </button>
          </nav>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto p-5 md:p-7">
          {tab === "analytics" ? (
            <AnalyticsView analytics={analytics} />
          ) : (
            <div>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <label className="relative min-w-[240px] flex-1">
                  <Search
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-[#666]"
                    size={16}
                  />
                  <input
                    className="input pl-9"
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Search all responses"
                  />
                </label>
                <button
                  className="button secondary"
                  type="button"
                  onClick={exportCsv}
                >
                  <Download size={16} /> Export CSV
                </button>
              </div>
              <div className="mt-5 grid gap-3">
                {filtered.map((response, index) => (
                  <details
                    className="border border-[#333] bg-[#111] p-4"
                    key={response.id}
                  >
                    <summary className="flex cursor-pointer list-none items-center justify-between gap-4">
                      <div>
                        <strong>Response {responses.length - index}</strong>
                        <p className="mt-1 text-xs text-[#777]">
                          {new Date(response.submittedAt).toLocaleString()} ·{" "}
                          {response.respondentName} · {response.respondentEmail}{" "}
                          · {response.memberName ? "Linked account" : "Guest"}
                        </p>
                      </div>
                      <span className="tag">View answers</span>
                    </summary>
                    <div className="mt-5 grid gap-4 border-t border-[#333] pt-5">
                      {response.answers.map((answer) => (
                        <div key={answer.fieldId}>
                          <p className="text-xs font-bold uppercase tracking-wider text-[#777]">
                            {answer.label}
                          </p>
                          {answer.type === "FILE_UPLOAD" &&
                          Array.isArray(answer.value) ? (
                            <div className="mt-2 grid gap-2">
                              {answer.value.map((file) =>
                                typeof file === "object" ? (
                                  <a
                                    className="flex items-center justify-between gap-3 border border-[#333] bg-[#0b0b0b] px-4 py-3 text-sm text-[#fd7803] hover:border-[#fd7803]"
                                    href={file.url}
                                    target="_blank"
                                    rel="noreferrer"
                                    key={file.uploadId}
                                  >
                                    <span className="truncate">
                                      {file.filename}
                                    </span>
                                    <span className="shrink-0 text-xs text-[#777]">
                                      {formatFileSize(file.size)} · Download
                                    </span>
                                  </a>
                                ) : null,
                              )}
                            </div>
                          ) : (
                            <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-[#ddd]">
                              {answerText(answer.value) || "No answer"}
                            </p>
                          )}
                        </div>
                      ))}
                      <button
                        className="w-fit text-xs text-red-400"
                        type="button"
                        disabled={pending}
                        onClick={() => removeResponse(response.id)}
                      >
                        <Trash2 className="inline" size={14} /> Delete response
                      </button>
                    </div>
                  </details>
                ))}
                {!filtered.length && (
                  <p className="border border-dashed border-[#333] p-8 text-center text-sm text-[#777]">
                    No responses match this search.
                  </p>
                )}
              </div>
            </div>
          )}
        </div>
        <footer
          className="border-t border-[#333] px-5 py-3 text-xs text-[#888]"
          aria-live="polite"
        >
          {pending
            ? "Updating responses…"
            : message || `${responses.length} stored responses`}
        </footer>
      </div>
    </dialog>
  );
}

function answerText(value: PublicFormAnswer["value"]) {
  if (!Array.isArray(value)) return value;
  return value
    .map((item) =>
      typeof item === "string" ? item : `${item.filename} ${item.url}`,
    )
    .join("; ");
}

type Analytics = {
  total: number;
  lastSevenDays: number;
  averageCompletion: number;
  timeline: Array<{ label: string; count: number }>;
  questions: Array<{
    id: string;
    label: string;
    answered: number;
    completion: number;
    choices: Array<{ label: string; count: number }>;
  }>;
};
function calculateAnalytics(
  fields: PublicFormField[],
  responses: ResponseRecord[],
): Analytics {
  const now = new Date();
  const days = Array.from({ length: 7 }, (_, offset) => {
    const date = new Date(now);
    date.setHours(0, 0, 0, 0);
    date.setDate(date.getDate() - (6 - offset));
    return date;
  });
  const timeline = days.map((date) => ({
    label: date.toLocaleDateString(undefined, { weekday: "short" }),
    count: responses.filter((response) => {
      const submitted = new Date(response.submittedAt);
      return (
        submitted >= date && submitted < new Date(date.getTime() + 86_400_000)
      );
    }).length,
  }));
  const questions = fields.map((field) => {
    const values = responses
      .map(
        (response) =>
          response.answers.find((answer) => answer.fieldId === field.id)?.value,
      )
      .filter((value): value is PublicFormAnswer["value"] =>
        Array.isArray(value) ? value.length > 0 : Boolean(value),
      );
    const counts = new Map<string, number>();
    if (optionFieldTypes.includes(field.type))
      values
        .flatMap((value) =>
          Array.isArray(value)
            ? value.filter((item): item is string => typeof item === "string")
            : [value],
        )
        .forEach((value) => counts.set(value, (counts.get(value) ?? 0) + 1));
    return {
      id: field.id,
      label: field.label,
      answered: values.length,
      completion: responses.length
        ? Math.round((values.length / responses.length) * 100)
        : 0,
      choices: optionFieldTypes.includes(field.type)
        ? [...counts.entries()]
            .map(([label, count]) => ({ label, count }))
            .sort((a, b) => b.count - a.count)
        : [],
    };
  });
  const answerSlots = responses.length * fields.length;
  const answeredSlots = questions.reduce(
    (sum, question) => sum + question.answered,
    0,
  );
  return {
    total: responses.length,
    lastSevenDays: timeline.reduce((sum, day) => sum + day.count, 0),
    averageCompletion: answerSlots
      ? Math.round((answeredSlots / answerSlots) * 100)
      : 0,
    timeline,
    questions,
  };
}
function AnalyticsView({ analytics }: { analytics: Analytics }) {
  const peak = Math.max(1, ...analytics.timeline.map((day) => day.count));
  return (
    <div className="grid gap-6">
      <div className="grid gap-3 sm:grid-cols-3">
        <AnalyticsMetric value={analytics.total} label="Total responses" />
        <AnalyticsMetric value={analytics.lastSevenDays} label="Last 7 days" />
        <AnalyticsMetric
          value={`${analytics.averageCompletion}%`}
          label="Average completion"
        />
      </div>
      <section className="border border-[#333] bg-[#111] p-5">
        <h3 className="font-bold">Response activity</h3>
        <div className="mt-6 grid grid-cols-7 items-end gap-2">
          {analytics.timeline.map((day) => (
            <div className="grid gap-2 text-center" key={day.label}>
              <span className="text-xs font-bold">{day.count}</span>
              <div
                className="mx-auto w-full max-w-12 bg-[#fd7803] transition-[height]"
                style={{ height: `${Math.max(4, (day.count / peak) * 120)}px` }}
                aria-label={`${day.count} responses on ${day.label}`}
              />
              <span className="text-[10px] uppercase text-[#777]">
                {day.label}
              </span>
            </div>
          ))}
        </div>
      </section>
      <section className="grid gap-3">
        <h3 className="font-bold">Question insights</h3>
        {analytics.questions.map((question) => (
          <article
            className="border border-[#333] bg-[#111] p-5"
            key={question.id}
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <strong>{question.label}</strong>
              <span className="tag">
                {question.answered} answered · {question.completion}%
              </span>
            </div>
            <div className="mt-4 h-2 overflow-hidden bg-[#262626]">
              <div
                className="h-full bg-[#fd7803]"
                style={{ width: `${question.completion}%` }}
              />
            </div>
            {question.choices.length > 0 && (
              <div className="mt-5 grid gap-3">
                {question.choices.map((choice) => {
                  const maximum = Math.max(
                    1,
                    ...question.choices.map((item) => item.count),
                  );
                  return (
                    <div key={choice.label}>
                      <div className="mb-1 flex justify-between gap-4 text-xs text-[#aaa]">
                        <span>{choice.label}</span>
                        <span>{choice.count}</span>
                      </div>
                      <div className="h-2 bg-[#262626]">
                        <div
                          className="h-full bg-[#fd7803]/75"
                          style={{
                            width: `${(choice.count / maximum) * 100}%`,
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </article>
        ))}
        {!analytics.questions.length && (
          <p className="border border-dashed border-[#333] p-8 text-center text-sm text-[#777]">
            Add questions to see analytics.
          </p>
        )}
      </section>
    </div>
  );
}
function AnalyticsMetric({
  value,
  label,
}: {
  value: string | number;
  label: string;
}) {
  return (
    <div className="border border-[#333] bg-[#111] p-5">
      <strong className="font-mono text-3xl text-[#fd7803]">{value}</strong>
      <p className="mt-2 text-xs uppercase tracking-wider text-[#777]">
        {label}
      </p>
    </div>
  );
}
function EditorTool({
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
function SmallIcon({
  label,
  onClick,
  children,
  disabled,
  danger,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
  disabled?: boolean;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      className={`calendar-control !h-9 !w-9 ${danger ? "text-red-400" : ""}`}
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
    >
      {children}
    </button>
  );
}
