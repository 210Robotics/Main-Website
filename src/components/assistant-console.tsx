"use client";

import { upload } from "@vercel/blob/client";
import {
  Bot,
  ExternalLink,
  FileUp,
  Send,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import Link from "next/link";
import { useRef, useState, useTransition } from "react";
import {
  executeAssistantCommand,
  processAssistantDocument,
  type AssistantExecutionResult,
} from "@/app/admin/assistant-actions";
import { MessageResponse } from "@/components/ai-elements/message";

const examples = [
  "Give Dyshana a task to update the calendar by Friday",
  "Log 2.5 hours for me for drivetrain testing today",
  "Draft a news post about our competition win",
  "We have 12 bearings, SKU 210-BRG-001, and reorder at 4",
  "How much money is left in the budget?",
];

type ChatItem = {
  id: string;
  role: "user" | "assistant";
  text: string;
  status?: AssistantExecutionResult["status"];
  href?: string;
};

export function AssistantConsole({ uploaderId }: { uploaderId: string }) {
  const fileInput = useRef<HTMLInputElement>(null);
  const [prompt, setPrompt] = useState("");
  const [uploading, setUploading] = useState(false);
  const [messages, setMessages] = useState<ChatItem[]>([
    {
      id: "welcome",
      role: "assistant",
      text: "Tell me what should happen in ordinary language. I can perform several actions from one request across tasks, hours, attendance, events, polls, news, inventory, BOM, purchasing, budgets, sponsors, notebooks, and the Control Center. You can also attach a DOCX, PDF, Excel, or CSV file, or paste a shared Google Drive link, and I will archive it before routing each explicit record to the right area.",
    },
  ]);
  const [pending, startTransition] = useTransition();

  async function importDocument(file: File | undefined) {
    if (!file || uploading || pending) return;
    const importInstructions = prompt.trim();
    if (importInstructions) setPrompt("");
    setUploading(true);
    setMessages((items) => [
      ...items,
      {
        id: crypto.randomUUID(),
        role: "user",
        text: `Import ${file.name} and add its explicit records`,
      },
    ]);
    try {
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "-");
      const pathname = `uploads/internal-document/${uploaderId}/${crypto.randomUUID()}-${safeName}`;
      const blob = await upload(pathname, file, {
        access: "private",
        handleUploadUrl: "/api/uploads",
        clientPayload: JSON.stringify({ purpose: "internal-document" }),
      });
      const result = await processAssistantDocument({
        pathname: blob.pathname,
        filename: file.name,
        contentType: file.type || mimeFromName(file.name),
        size: file.size,
        instructions: importInstructions,
      });
      const detail = result.details?.length
        ? `\n\n${result.details.map((item) => `• ${item}`).join("\n")}`
        : "";
      setMessages((items) => [
        ...items,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          text: `${result.message}${detail}`,
          status: result.status === "success" ? "success" : "error",
          href: result.documentId ? "/admin?tab=documents" : undefined,
        },
      ]);
    } catch (error) {
      setMessages((items) => [
        ...items,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          text:
            error instanceof Error
              ? error.message
              : "The document could not be uploaded.",
          status: "error",
        },
      ]);
    } finally {
      setUploading(false);
      if (fileInput.current) fileInput.current.value = "";
    }
  }

  function submit(value = prompt) {
    const request = value.trim();
    if (!request || pending) return;
    const conversation = messages
      .slice(-8)
      .map(
        (item) =>
          `${item.role === "user" ? "User" : "Assistant"}: ${item.text}`,
      )
      .join("\n")
      .slice(-6000);
    setPrompt("");
    setMessages((items) => [
      ...items,
      { id: crypto.randomUUID(), role: "user", text: request },
    ]);
    startTransition(async () => {
      const result = await executeAssistantCommand({
        prompt: request,
        conversation,
      });
      setMessages((items) => [
        ...items,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          text: result.message,
          status: result.status,
          href: result.href,
        },
      ]);
    });
  }

  return (
    <div className="overflow-hidden border border-[#333] bg-[#090909]">
      <header className="border-b border-[#333] bg-[#101010] p-5 md:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <span className="grid size-11 shrink-0 place-items-center bg-[#fd7803] text-black">
              <Bot size={24} />
            </span>
            <div>
              <h3 className="text-xl font-bold">210 Action Assistant</h3>
              <p className="mt-1 text-xs leading-5 text-[#888]">
                Manage the admin portal in ordinary language. Gemini plans
                multi-step work; conventional BOM and priced-material tables
                also receive direct validation for reliable imports.
              </p>
            </div>
          </div>
          <span className="tag">
            <ShieldCheck className="mr-1 inline size-3" /> Gemini AI
          </span>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-[#2c2c2c] pt-4">
          <button
            className="button secondary !min-h-10"
            type="button"
            disabled={uploading || pending}
            onClick={() => fileInput.current?.click()}
          >
            <FileUp size={16} />
            {uploading ? "Importing document…" : "Upload document"}
          </button>
          <input
            ref={fileInput}
            className="sr-only"
            type="file"
            accept=".docx,.pdf,.xlsx,.csv,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/pdf,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv"
            onChange={(event) => void importDocument(event.target.files?.[0])}
          />
          <p className="min-w-0 flex-1 text-[.68rem] leading-5 text-[#777]">
            Add optional instructions in the prompt, then upload a DOCX, PDF,
            XLSX, or CSV. You can also paste a Google Drive, Docs, or Sheets
            link directly into the chat. The assistant classifies the contents,
            validates conventional tables, and routes BOM, finance, task,
            meeting, event, sponsor, and purchasing records.
          </p>
        </div>
      </header>
      <div
        className="max-h-[520px] min-h-80 space-y-4 overflow-y-auto p-5 md:p-6"
        aria-live="polite"
      >
        {messages.map((item) => (
          <div
            className={`flex ${item.role === "user" ? "justify-end" : "justify-start"}`}
            key={item.id}
          >
            <div
              className={`max-w-[88%] border px-4 py-3 text-sm leading-6 ${
                item.role === "user"
                  ? "border-[#8c4507] bg-[#21150c] text-white"
                  : item.status === "error"
                    ? "border-red-500/45 bg-red-950/20 text-red-100"
                    : "border-[#333] bg-[#111] text-[#bbb]"
              }`}
            >
              {item.role === "assistant" ? (
                <MessageResponse>{item.text}</MessageResponse>
              ) : (
                <p className="whitespace-pre-wrap">{item.text}</p>
              )}
              {item.href && (
                <Link
                  className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-[#fd7803] hover:underline"
                  href={item.href}
                >
                  View updated area <ExternalLink size={12} />
                </Link>
              )}
            </div>
          </div>
        ))}
        {(pending || uploading) && (
          <div className="flex items-center gap-2 text-sm text-[#888]">
            <Sparkles className="size-4 animate-pulse text-[#fd7803]" />
            {uploading
              ? "Archiving the file and applying its records…"
              : "Gemini is preparing and applying your update…"}
          </div>
        )}
      </div>
      <div className="border-t border-[#333] bg-[#0d0d0d] p-4 md:p-5">
        <div className="mb-3 flex gap-2 overflow-x-auto pb-1">
          {examples.map((example) => (
            <button
              className="shrink-0 border border-[#333] px-3 py-2 text-[.68rem] text-[#888] transition hover:border-[#fd7803] hover:text-white"
              type="button"
              onClick={() => setPrompt(example)}
              key={example}
            >
              {example}
            </button>
          ))}
        </div>
        <div className="flex gap-3">
          <textarea
            className="input min-h-20 flex-1 resize-y"
            value={prompt}
            onChange={(event) => setPrompt(event.target.value)}
            onKeyDown={(event) => {
              if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
                event.preventDefault();
                submit();
              }
            }}
            placeholder="Ask Gemini to create, assign, complete, add, or update something…"
            aria-label="Assistant prompt"
          />
          <button
            className="button self-stretch px-5"
            type="button"
            disabled={pending || !prompt.trim()}
            onClick={() => submit()}
            aria-label="Send command"
          >
            <Send size={18} />
          </button>
        </div>
        <p className="mt-2 text-[.65rem] text-[#666]">
          Ctrl/⌘ + Enter to send. Record names must resolve uniquely before any
          change is made.
        </p>
      </div>
    </div>
  );
}

function mimeFromName(filename: string) {
  const lower = filename.toLowerCase();
  if (lower.endsWith(".pdf")) return "application/pdf";
  if (lower.endsWith(".xlsx"))
    return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
  if (lower.endsWith(".csv")) return "text/csv";
  return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
}
