"use client";

import { Check, LoaderCircle, Send, X } from "lucide-react";
import { FormEvent, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";

type Kind = "contact" | "sponsor" | "join";

export function InquiryForm({ kind = "contact", compact = false, onComplete }: { kind?: Kind; compact?: boolean; onComplete?: () => void }) {
  const pathname = usePathname();
  const [state, setState] = useState<"idle" | "sending" | "success" | "error">("idle");
  const [message, setMessage] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setState("sending");
    const form = event.currentTarget;
    const fields = Object.fromEntries(new FormData(form).entries());
    const response = await fetch("/api/inquiries", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...fields, kind, sourcePath: pathname }) }).catch(() => null);
    const result = response ? await response.json().catch(() => ({})) : {};
    if (response?.ok) {
      form.reset();
      setState("success");
      setMessage("Your message is in the team inbox. A confirmation email is on its way.");
      onComplete?.();
    } else {
      setState("error");
      setMessage(result.message || "We could not send this message. Please email admin@210robotics.com.");
    }
  }

  return <form onSubmit={submit} className={`card grid gap-5 ${compact ? "p-5" : "p-6 md:p-8"}`}>
    <div className="grid gap-5 sm:grid-cols-2"><div className="field"><label htmlFor={`${kind}-name`}>Name</label><input id={`${kind}-name`} name="name" className="input" minLength={2} maxLength={100} required autoComplete="name"/></div><div className="field"><label htmlFor={`${kind}-email`}>Email</label><input id={`${kind}-email`} name="email" type="email" className="input" required autoComplete="email"/></div></div>
    {kind === "join" && <div className="field"><label htmlFor={`${kind}-interest`}>Primary interest</label><select id={`${kind}-interest`} name="interest" className="input"><option>Mechanical engineering</option><option>Programming and controls</option><option>Electrical systems</option><option>Business and sponsorship</option><option>Media and outreach</option></select></div>}
    {kind === "sponsor" && <><div className="field"><label htmlFor={`${kind}-organization`}>Organization</label><input id={`${kind}-organization`} name="organization" className="input" required autoComplete="organization"/></div><div className="field"><label htmlFor={`${kind}-interest`}>How can we help?</label><select id={`${kind}-interest`} name="interest" className="input" required><option value="">Choose a request</option><option>Start a new sponsorship</option><option>Update company or contact information</option><option>Coordinate a sponsor benefit or deliverable</option><option>Plan a renewal</option><option>Request an invoice, receipt, or payment update</option><option>Schedule a team visit or demonstration</option><option>Request an impact update</option><option>Other sponsor support</option></select></div></>}
    <div className="sr-only" aria-hidden="true"><label htmlFor={`${kind}-website`}>Website</label><input id={`${kind}-website`} name="website" tabIndex={-1} autoComplete="off"/></div>
    <div className="field"><label htmlFor={`${kind}-message`}>Message</label><textarea id={`${kind}-message`} name="message" className="input min-h-36" minLength={10} maxLength={4000} required/></div>
    <button className="button w-fit" disabled={state === "sending"} type="submit">{state === "sending" ? <LoaderCircle className="animate-spin" size={16}/> : <Send size={16}/>} {state === "sending" ? "Sending" : "Send inquiry"}</button>
    {state !== "idle" && state !== "sending" && <div role="status" className={`flex items-start gap-3 border p-4 text-sm leading-6 ${state === "success" ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-100" : "border-red-500/40 bg-red-500/10 text-red-100"}`}>{state === "success" ? <Check className="mt-0.5 shrink-0" size={18}/> : <X className="mt-0.5 shrink-0" size={18}/>}<span>{message}</span></div>}
  </form>;
}

export function InquiryModal({ kind, label, className = "button" }: { kind: "join" | "sponsor"; label: string; className?: string }) {
  const [open, setOpen] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => { if (open) dialog.current?.showModal(); else dialog.current?.close(); }, [open]);
  return <><button className={className} onClick={() => setOpen(true)} type="button">{label}</button><dialog ref={dialog} onClose={() => setOpen(false)} className="inquiry-dialog"><div className="flex items-start justify-between gap-5 border-b border-[#333] p-5"><div><p className="eyebrow">{kind === "join" ? "Join 210" : "Partner with 210"}</p><h2 className="mt-3 text-2xl font-bold">{kind === "join" ? "Find your place on the team." : "Start a partnership."}</h2></div><button aria-label="Close form" className="p-2 text-[#aaa] hover:text-white" onClick={() => setOpen(false)}><X/></button></div><InquiryForm kind={kind} compact/></dialog></>;
}
