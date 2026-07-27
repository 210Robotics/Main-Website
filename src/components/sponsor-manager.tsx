"use client";

import Image from "next/image";
import { useActionState, useRef } from "react";
import { deleteSponsor, saveSponsor, type AdminFormState } from "@/app/admin/actions";
import { ImageUpload } from "@/components/image-upload";

type Sponsor = {
  id: string;
  name: string;
  sponsorship: string;
  tier: string;
  websiteUrl: string | null;
  logoUrl: string | null;
  sortOrder: number;
  published: boolean;
};

const initialState: AdminFormState = { status: "idle", message: "" };

function SponsorDialog({ sponsor, uploaderId }: { sponsor?: Sponsor; uploaderId: string }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [state, action, pending] = useActionState(saveSponsor, initialState);
  const current = sponsor ?? {
    id: "",
    name: "",
    sponsorship: "",
    tier: "Partner",
    websiteUrl: "",
    logoUrl: null,
    sortOrder: 100,
    published: true,
  };
  return (
    <>
      <button className={sponsor ? "text-xs text-[#fd7803] hover:text-white" : "button secondary"} type="button" onClick={() => dialog.current?.showModal()}>
        {sponsor ? "Edit" : "Add sponsor"}
      </button>
      <dialog ref={dialog} className="admin-dialog w-[min(720px,calc(100vw-2rem))] bg-[#101010] p-0 text-white backdrop:bg-black/80">
        <div className="border border-[#383838] p-6 md:p-8">
          <div className="mb-6 flex items-start justify-between gap-4">
            <div><p className="eyebrow">Sponsor wall</p><h3 className="mt-2 text-2xl font-bold">{sponsor ? `Edit ${sponsor.name}` : "Add a sponsor"}</h3></div>
            <button type="button" className="text-sm text-[#999] hover:text-white" onClick={() => dialog.current?.close()}>Close</button>
          </div>
          <form action={action} className="grid gap-5">
            <input type="hidden" name="sponsorId" value={current.id} />
            <div className="grid gap-4 md:grid-cols-2">
              <label className="field"><span>Sponsor name</span><input className="input" name="name" defaultValue={current.name} required /></label>
              <label className="field"><span>Partnership tier</span><input className="input" name="tier" defaultValue={current.tier} required /></label>
            </div>
            <label className="field"><span>What they sponsor</span><input className="input" name="sponsorship" defaultValue={current.sponsorship} placeholder="Technology and mentorship" required /></label>
            <label className="field"><span>Website (optional)</span><input className="input" name="websiteUrl" type="url" defaultValue={current.websiteUrl ?? ""} placeholder="https://example.com" /></label>
            <div><p className="mb-2 text-sm text-[#aaa]">Sponsor logo</p><ImageUpload name="logoMediaId" removeName="removeLogo" purpose="sponsor-logo" uploaderId={uploaderId} currentUrl={current.logoUrl} label={sponsor ? "Replace logo" : "Upload logo"} presentation="logo" /></div>
            <div className="grid gap-4 md:grid-cols-2 md:items-center">
              <label className="field"><span>Display order</span><input className="input" name="sortOrder" type="number" min="0" max="9999" defaultValue={current.sortOrder} required /></label>
              <label className="flex items-center gap-3 text-sm text-[#bbb]"><input type="checkbox" name="published" defaultChecked={current.published} />Show on Home and Sponsors pages</label>
            </div>
            <div className="flex flex-wrap items-center gap-4">
              <button className="button" disabled={pending}>{pending ? "Saving…" : "Save sponsor"}</button>
              <p className={state.status === "error" ? "text-sm text-red-400" : "text-sm text-emerald-400"} aria-live="polite">{state.message}</p>
            </div>
          </form>
        </div>
      </dialog>
    </>
  );
}

function DeleteSponsorButton({ sponsor }: { sponsor: Sponsor }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [state, action, pending] = useActionState(deleteSponsor, initialState);
  return (
    <>
      <button className="text-xs text-red-400 hover:text-red-300" type="button" onClick={() => dialog.current?.showModal()}>Delete</button>
      <dialog ref={dialog} className="admin-dialog w-[min(500px,calc(100vw-2rem))] bg-[#101010] p-0 text-white backdrop:bg-black/80">
        <div className="border border-red-900/70 p-6 md:p-8">
          <p className="font-mono text-[.65rem] uppercase tracking-wider text-red-400">Permanent action</p>
          <h3 className="mt-3 text-2xl font-bold">Delete {sponsor.name}?</h3>
          <p className="mt-4 text-sm leading-6 text-[#aaa]">The sponsor will disappear from the Home and Sponsors pages. The audit record remains.</p>
          <form action={action} className="mt-6 grid gap-4">
            <input type="hidden" name="sponsorId" value={sponsor.id} />
            <div className="flex flex-wrap gap-3"><button className="button border-red-600 bg-red-600 text-white hover:bg-red-500" disabled={pending}>{pending ? "Deleting…" : "Delete sponsor"}</button><button className="button secondary" type="button" onClick={() => dialog.current?.close()}>Cancel</button></div>
            <p className={state.status === "error" ? "text-sm text-red-400" : "text-sm text-emerald-400"} aria-live="polite">{state.message}</p>
          </form>
        </div>
      </dialog>
    </>
  );
}

export function SponsorManager({ sponsors, uploaderId }: { sponsors: Sponsor[]; uploaderId: string }) {
  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <p className="max-w-2xl text-sm leading-7 text-[#999]">Add logos and describe what each partner supports. Published sponsors update both public sponsor displays.</p>
        <SponsorDialog uploaderId={uploaderId} />
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        {sponsors.map((sponsor) => (
          <article className="flex min-h-36 items-center gap-5 border border-[#333] bg-[#0d0d0d] p-5" key={sponsor.id}>
            <div className="relative h-20 w-28 shrink-0 bg-white/95 p-2">
              {sponsor.logoUrl ? <Image src={sponsor.logoUrl} alt={sponsor.name} fill sizes="112px" className="object-contain p-2" /> : <span className="grid h-full place-items-center text-xs text-[#666]">No logo</span>}
            </div>
            <div className="min-w-0 flex-1"><strong>{sponsor.name}</strong><p className="mt-1 text-sm text-[#aaa]">{sponsor.sponsorship}</p><p className="mt-2 font-mono text-[.62rem] uppercase tracking-wider text-[#666]">{sponsor.tier} · order {sponsor.sortOrder}{!sponsor.published ? " · hidden" : ""}</p><div className="mt-3 flex gap-4"><SponsorDialog sponsor={sponsor} uploaderId={uploaderId} /><DeleteSponsorButton sponsor={sponsor} /></div></div>
          </article>
        ))}
      </div>
      {!sponsors.length && <p className="border border-dashed border-[#333] p-8 text-sm text-[#777]">No sponsors have been added yet.</p>}
    </div>
  );
}
