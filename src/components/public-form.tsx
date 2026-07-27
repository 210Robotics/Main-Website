"use client";

import { upload } from "@vercel/blob/client";
import { CheckCircle2, FileUp, Loader2, Send, Trash2 } from "lucide-react";
import Image from "next/image";
import { useActionState, useRef, useState } from "react";
import { submitPublicForm, type PublicFormState } from "@/app/f/[key]/actions";
import { CalendarInput } from "@/components/calendar-input";
import {
  confirmPublicFormUpload,
  discardPublicFormUpload,
} from "@/app/f/[key]/upload-actions";
import {
  formatFileSize,
  isAllowedFormFileType,
  MAX_FORM_FILE_BYTES,
  normalizedFormFileType,
  safeUploadFilename,
} from "@/lib/form-files";
import type {
  FormFileValue,
  PublicFormAnswer,
  PublicFormField,
} from "@/lib/form-types";

const initial: PublicFormState = { status: "idle", message: "" };

export function PublicForm({
  form,
  identity,
  initialResponse,
}: {
  form: {
    id: string;
    accessKey: string;
    title: string;
    descriptionHtml: string;
    confirmationMessage: string;
    status: "OPEN" | "CLOSED";
    fields: PublicFormField[];
  };
  identity: { name: string; email: string } | null;
  initialResponse: {
    id: string;
    answers: PublicFormAnswer[];
    respondentName: string;
    respondentEmail: string;
  } | null;
}) {
  const [state, action, pending] = useActionState(submitPublicForm, initial);

  if (form.status === "CLOSED") {
    return (
      <FormShell>
        <div className="border-l-4 border-[#fd7803] bg-[#17120d] p-6">
          <p className="eyebrow">Responses closed</p>
          <h1 className="mt-3 text-3xl font-bold">{form.title}</h1>
          <p className="mt-4 leading-7 text-[#aaa]">
            This form is no longer accepting responses.
          </p>
        </div>
      </FormShell>
    );
  }

  if (state.submitted) {
    return (
      <FormShell>
        <div className="border border-emerald-500/35 bg-emerald-500/5 p-8 text-center md:p-12">
          <CheckCircle2 className="mx-auto text-emerald-400" size={48} />
          <p className="eyebrow mt-6">Response recorded</p>
          <h1 className="mt-3 text-3xl font-bold">Thank you.</h1>
          <p className="mx-auto mt-4 max-w-xl leading-7 text-[#aaa]">
            {state.message}
          </p>
        </div>
      </FormShell>
    );
  }

  return (
    <FormShell>
      <header className="overflow-hidden border border-[#353535] bg-[#101010]">
        <div className="h-1.5 bg-[#fd7803]" />
        <div className="p-6 md:p-10">
          <p className="eyebrow">210 Robotics form</p>
          <h1 className="mt-3 text-4xl font-bold tracking-[-.04em] md:text-5xl">
            {form.title}
          </h1>
          {form.descriptionHtml && (
            <div
              className="form-public-intro mt-6 max-w-3xl text-[#bbb]"
              dangerouslySetInnerHTML={{ __html: form.descriptionHtml }}
            />
          )}
          <p className="mt-6 text-xs text-[#777]">
            Questions marked <span className="text-[#fd7803]">*</span> are
            required.
          </p>
        </div>
      </header>
      <form action={action} className="mt-5 grid gap-4" aria-busy={pending}>
        <input type="hidden" name="accessKey" value={form.accessKey} />
        {initialResponse && (
          <input type="hidden" name="responseId" value={initialResponse.id} />
        )}
        <label
          className="absolute left-[-10000px] top-auto h-px w-px overflow-hidden"
          aria-hidden="true"
        >
          Organization website
          <input name="organizationWebsite" tabIndex={-1} autoComplete="off" />
        </label>
        <section className="border border-[#353535] bg-[#101010] p-5 md:p-7">
          <p className="eyebrow">Respondent</p>
          {identity ? (
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div className="border border-[#333] bg-[#0b0b0b] p-4">
                <span className="text-xs uppercase tracking-wider text-[#777]">
                  Name
                </span>
                <strong className="mt-1 block">{identity.name}</strong>
              </div>
              <div className="border border-[#333] bg-[#0b0b0b] p-4">
                <span className="text-xs uppercase tracking-wider text-[#777]">
                  Email
                </span>
                <strong className="mt-1 block break-all">
                  {identity.email}
                </strong>
              </div>
              <p className="text-xs text-[#777] sm:col-span-2">
                This response will be saved to your member portal.
              </p>
            </div>
          ) : (
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <label className="field">
                <span>Name *</span>
                <input
                  className="input"
                  name="respondentName"
                  autoComplete="name"
                  required
                  minLength={2}
                />
              </label>
              <label className="field">
                <span>Email *</span>
                <input
                  className="input"
                  name="respondentEmail"
                  type="email"
                  autoComplete="email"
                  required
                />
              </label>
              <p className="text-xs text-[#777] sm:col-span-2">
                If this email belongs to an active 210 Robotics account, the
                completed form will appear in that member’s portal.
              </p>
            </div>
          )}
          {state.errors?.identity && (
            <p className="mt-3 text-sm text-red-400" role="alert">
              {state.errors.identity}
            </p>
          )}
        </section>
        {form.fields.map((field, index) => (
          <QuestionCard
            key={field.id}
            field={field}
            number={index + 1}
            error={state.errors?.[field.id]}
            formId={form.id}
            accessKey={form.accessKey}
            initialValue={
              initialResponse?.answers.find(
                (answer) => answer.fieldId === field.id,
              )?.value
            }
          />
        ))}
        <div className="mt-2 flex flex-wrap items-center gap-4 border border-[#333] bg-[#0d0d0d] p-5">
          <button className="button" disabled={pending}>
            <Send size={17} />{" "}
            {pending
              ? "Saving…"
              : initialResponse
                ? "Update response"
                : "Submit response"}
          </button>
          <p
            className={
              state.status === "error"
                ? "text-sm text-red-400"
                : "text-sm text-emerald-400"
            }
            aria-live="polite"
          >
            {state.message}
          </p>
        </div>
      </form>
    </FormShell>
  );
}

function QuestionCard({
  field,
  number,
  error,
  formId,
  accessKey,
  initialValue,
}: {
  field: PublicFormField;
  number: number;
  error?: string;
  formId: string;
  accessKey: string;
  initialValue?: PublicFormAnswer["value"];
}) {
  const name = `field_${field.id}`;
  const describedBy =
    [
      field.description ? `${field.id}-help` : null,
      error ? `${field.id}-error` : null,
    ]
      .filter(Boolean)
      .join(" ") || undefined;
  return (
    <fieldset
      className={`border bg-[#101010] p-5 md:p-7 ${error ? "border-red-500/70" : "border-[#353535]"}`}
    >
      <legend className="sr-only">{field.label}</legend>
      <div className="flex gap-4">
        <span className="font-mono text-xs text-[#fd7803]">
          {String(number).padStart(2, "0")}
        </span>
        <div className="min-w-0 flex-1">
          <p className="block text-lg font-bold" id={`${field.id}-label`}>
            {field.label}{" "}
            {field.required && <span className="text-[#fd7803]">*</span>}
          </p>
          {field.description && (
            <p
              className="mt-2 text-sm leading-6 text-[#888]"
              id={`${field.id}-help`}
            >
              {field.description}
            </p>
          )}
          <div className="mt-5">
            <QuestionControl
              field={field}
              name={name}
              describedBy={describedBy}
              formId={formId}
              accessKey={accessKey}
              initialValue={initialValue}
            />
          </div>
          {error && (
            <p
              className="mt-3 text-sm text-red-400"
              id={`${field.id}-error`}
              role="alert"
            >
              {error}
            </p>
          )}
        </div>
      </div>
    </fieldset>
  );
}

function QuestionControl({
  field,
  name,
  describedBy,
  formId,
  accessKey,
  initialValue,
}: {
  field: PublicFormField;
  name: string;
  describedBy?: string;
  formId: string;
  accessKey: string;
  initialValue?: PublicFormAnswer["value"];
}) {
  const common = {
    id: `${field.id}-control`,
    name,
    required: field.required,
    "aria-describedby": describedBy,
    "aria-labelledby": `${field.id}-label`,
  };
  if (field.type === "LONG_TEXT")
    return (
      <textarea
        {...common}
        className="input min-h-36"
        defaultValue={typeof initialValue === "string" ? initialValue : ""}
      />
    );
  if (field.type === "DATE")
    return (
      <CalendarInput
        {...common}
        className="input max-w-sm"
        type="date"
        defaultValue={typeof initialValue === "string" ? initialValue : ""}
      />
    );
  if (field.type === "EMAIL")
    return (
      <input
        {...common}
        className="input"
        type="email"
        autoComplete="email"
        defaultValue={typeof initialValue === "string" ? initialValue : ""}
      />
    );
  if (field.type === "NUMBER")
    return (
      <input
        {...common}
        className="input max-w-sm"
        type="number"
        step="any"
        defaultValue={typeof initialValue === "string" ? initialValue : ""}
      />
    );
  if (field.type === "LINK")
    return (
      <input
        {...common}
        className="input"
        type="url"
        placeholder="https://"
        defaultValue={typeof initialValue === "string" ? initialValue : ""}
      />
    );
  if (field.type === "FILE_UPLOAD")
    return (
      <PublicFileUpload
        field={field}
        name={name}
        formId={formId}
        accessKey={accessKey}
        describedBy={describedBy}
        initialFiles={
          Array.isArray(initialValue)
            ? initialValue.filter(
                (item): item is FormFileValue => typeof item === "object",
              )
            : []
        }
      />
    );
  if (field.type === "DROPDOWN") {
    return (
      <select
        {...common}
        className="input"
        defaultValue={typeof initialValue === "string" ? initialValue : ""}
      >
        <option value="" disabled>
          Choose an option
        </option>
        {field.options.map((option) => (
          <option key={option}>{option}</option>
        ))}
      </select>
    );
  }
  if (field.type === "MULTIPLE_CHOICE" || field.type === "MULTI_SELECT") {
    const inputType = field.type === "MULTI_SELECT" ? "checkbox" : "radio";
    return (
      <div className="grid gap-3">
        {field.options.map((option, index) => (
          <label
            className="flex min-h-12 cursor-pointer items-center gap-3 border border-[#333] px-4 py-3 transition hover:border-[#fd7803]"
            key={option}
          >
            <input
              type={inputType}
              name={name}
              value={option}
              required={field.required && inputType === "radio" && index === 0}
              aria-describedby={describedBy}
              defaultChecked={
                Array.isArray(initialValue)
                  ? initialValue.some(
                      (item) => typeof item === "string" && item === option,
                    )
                  : initialValue === option
              }
            />
            <span>{option}</span>
          </label>
        ))}
      </div>
    );
  }
  return (
    <input
      {...common}
      className="input"
      type="text"
      defaultValue={typeof initialValue === "string" ? initialValue : ""}
    />
  );
}

function PublicFileUpload({
  field,
  name,
  formId,
  accessKey,
  describedBy,
  initialFiles,
}: {
  field: PublicFormField;
  name: string;
  formId: string;
  accessKey: string;
  describedBy?: string;
  initialFiles: FormFileValue[];
}) {
  const input = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<FormFileValue[]>(initialFiles);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [message, setMessage] = useState("");
  const maxFiles = field.maxFiles ?? 1;

  async function addFiles(selected: FileList | null) {
    if (!selected?.length || busy) return;
    const remaining = maxFiles - files.length;
    const candidates = Array.from(selected).slice(0, remaining);
    if (selected.length > remaining)
      setMessage(`This question accepts up to ${maxFiles} files.`);
    setBusy(true);
    try {
      for (const file of candidates) {
        const mimeType = normalizedFormFileType(file);
        if (
          !isAllowedFormFileType(mimeType) ||
          file.size > MAX_FORM_FILE_BYTES
        ) {
          setMessage(
            `${file.name} is not an accepted file or is larger than 10 MB.`,
          );
          continue;
        }
        const uploadId = crypto.randomUUID();
        const uploadFile =
          file.type === mimeType
            ? file
            : new File([file], file.name, {
                type: mimeType,
                lastModified: file.lastModified,
              });
        const pathname = `uploads/form-response/${formId}/${field.id}/${uploadId}-${safeUploadFilename(file.name)}`;
        const blob = await upload(pathname, uploadFile, {
          access: "public",
          handleUploadUrl: "/api/form-uploads",
          clientPayload: JSON.stringify({
            accessKey,
            formId,
            fieldId: field.id,
            uploadId,
            filename: file.name,
            mimeType,
            size: file.size,
          }),
          onUploadProgress: ({ percentage }) =>
            setProgress(Math.round(percentage)),
        });
        const result = await confirmPublicFormUpload({
          accessKey,
          fieldId: field.id,
          uploadId,
          url: blob.url,
        });
        if (!result.success) throw new Error(result.message);
        setFiles((current) => [...current, result.file]);
        setMessage(`${file.name} uploaded.`);
      }
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "The file could not be uploaded.",
      );
    } finally {
      setBusy(false);
      setProgress(0);
      if (input.current) input.current.value = "";
    }
  }

  async function removeFile(file: FormFileValue) {
    setFiles((current) =>
      current.filter((candidate) => candidate.uploadId !== file.uploadId),
    );
    setMessage(`${file.filename} removed.`);
    await discardPublicFormUpload(accessKey, file.uploadId);
  }

  return (
    <div aria-describedby={describedBy}>
      {files.map((file) => (
        <input
          key={file.uploadId}
          type="hidden"
          name={name}
          value={file.uploadId}
        />
      ))}
      <button
        type="button"
        className="grid min-h-32 w-full place-items-center border border-dashed border-[#555] bg-[#0b0b0b] p-5 text-center transition hover:border-[#fd7803] focus-visible:border-[#fd7803] disabled:opacity-50"
        onClick={() => input.current?.click()}
        disabled={busy || files.length >= maxFiles}
      >
        <span>
          {busy ? (
            <Loader2 className="mx-auto animate-spin text-[#fd7803]" />
          ) : (
            <FileUp className="mx-auto text-[#fd7803]" />
          )}
          <strong className="mt-3 block">
            {busy
              ? `Uploading ${progress}%`
              : files.length >= maxFiles
                ? "File limit reached"
                : "Choose files to upload"}
          </strong>
          <span className="mt-1 block text-xs text-[#777]">
            Up to {maxFiles} {maxFiles === 1 ? "file" : "files"} · 10 MB each
          </span>
        </span>
      </button>
      <input
        ref={input}
        className="sr-only"
        type="file"
        multiple={maxFiles > 1}
        onChange={(event) => void addFiles(event.target.files)}
      />
      {files.length > 0 && (
        <div className="mt-3 grid gap-2">
          {files.map((file) => (
            <div
              key={file.uploadId}
              className="flex items-center justify-between gap-4 border border-[#333] bg-[#0b0b0b] px-4 py-3"
            >
              <span className="min-w-0">
                <strong className="block truncate text-sm">
                  {file.filename}
                </strong>
                <span className="text-xs text-[#777]">
                  {formatFileSize(file.size)}
                </span>
              </span>
              <button
                type="button"
                className="text-red-400"
                aria-label={`Remove ${file.filename}`}
                onClick={() => void removeFile(file)}
              >
                <Trash2 size={17} />
              </button>
            </div>
          ))}
        </div>
      )}
      <p className="mt-2 text-xs text-[#888]" aria-live="polite">
        {message}
      </p>
    </div>
  );
}

function FormShell({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-screen bg-[#080808] px-4 py-8 text-white grid-bg md:py-14">
      <div className="mx-auto w-full max-w-3xl">
        <a
          href="https://210robotics.com"
          className="mb-7 inline-flex items-center gap-3"
          aria-label="210 Robotics home"
        >
          <span className="relative h-12 w-28">
            <Image
              src="/media/brand/210-banner.png"
              alt="210 Robotics"
              fill
              sizes="112px"
              className="object-contain"
              priority
            />
          </span>
          <span className="border-l border-[#333] pl-3 text-xs uppercase tracking-[.18em] text-[#888]">
            Secure form
          </span>
        </a>
        {children}
        <p className="mt-7 text-center text-xs text-[#666]">
          Built for 210 Robotics · UT San Antonio
        </p>
      </div>
    </main>
  );
}
