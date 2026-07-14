"use client";

import { useState } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import Image from "@tiptap/extension-image";

export function BlogEditor({ name = "bodyHtml", initial = "<p>Share the story behind the work.</p>" }: { name?: string; initial?: string }) {
  const [html, setHtml] = useState(initial);
  const editor = useEditor({ immediatelyRender: false, extensions: [StarterKit, Link.configure({ openOnClick: false }), Image], content: initial, onUpdate: ({ editor: current }) => setHtml(current.getHTML()), editorProps: { attributes: { class: "min-h-56 p-4 outline-none prose-editor" } } });
  if (!editor) return <div className="card h-56 animate-pulse"/>;
  const button = (label: string, action: () => void, active = false) => <button type="button" className={`border px-3 py-2 text-xs ${active ? "border-[#fd7803] text-[#fd7803]" : "border-[#3a3a3a] text-[#aaa]"}`} onClick={action}>{label}</button>;
  return <div><div className="flex flex-wrap gap-2 border border-b-0 border-[#393939] bg-[#0c0c0c] p-2">{button("Bold", () => editor.chain().focus().toggleBold().run(), editor.isActive("bold"))}{button("Italic", () => editor.chain().focus().toggleItalic().run(), editor.isActive("italic"))}{button("Heading", () => editor.chain().focus().toggleHeading({ level: 2 }).run(), editor.isActive("heading", { level: 2 }))}{button("List", () => editor.chain().focus().toggleBulletList().run(), editor.isActive("bulletList"))}{button("Quote", () => editor.chain().focus().toggleBlockquote().run(), editor.isActive("blockquote"))}{button("Link", () => { const url = window.prompt("Link URL"); if (url) editor.chain().focus().setLink({ href: url }).run(); })}</div><div className="border border-[#393939] bg-[#101010]"><EditorContent editor={editor}/></div><input type="hidden" name={name} value={html} readOnly/></div>;
}
