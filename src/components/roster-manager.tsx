"use client";

import { useActionState, useRef } from "react";
import {
  archiveRosterCard,
  restoreRosterCard,
  saveRosterCard,
  type AdminFormState,
} from "@/app/admin/actions";
import { ImageUpload } from "@/components/image-upload";

type Page = "TEAM" | "VEX_U" | "SIDC" | "ROBOROWDY";
type Card = {
  id: string;
  page: Page;
  section: string;
  name: string;
  title: string;
  bio: string;
  photoUrl: string | null;
  sortOrder: number;
  published: boolean;
  archivedAt: Date | null;
};
const initialState: AdminFormState = { status: "idle", message: "" };
const labels: Record<Page, string> = { TEAM: "Team", VEX_U: "VEX U", SIDC: "SIDC", ROBOROWDY: "RoboRowdy" };

function CardDialog({ card, page, uploaderId }: { card?: Card; page: Page; uploaderId: string }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [state, action, pending] = useActionState(saveRosterCard, initialState);
  const current = card ?? { id: "", page, section: page === "TEAM" ? "leadership" : "people", name: "", title: "Member", bio: "", photoUrl: null, sortOrder: 100, published: true, archivedAt: null };
  return (
    <>
      <button className={card ? "text-xs text-[#fd7803]" : "button secondary"} type="button" onClick={() => dialog.current?.showModal()}>{card ? "Edit card" : `Add ${labels[page]} card`}</button>
      <dialog ref={dialog} className="admin-dialog w-[min(680px,calc(100vw-2rem))] bg-[#101010] p-0 text-white backdrop:bg-black/80">
        <div className="border border-[#383838] p-6 md:p-8">
          <div className="mb-6 flex items-start justify-between"><div><p className="eyebrow">Public roster</p><h3 className="mt-2 text-2xl font-bold">{card ? `Edit ${card.name}` : `Add to ${labels[page]}`}</h3></div><button type="button" className="text-sm text-[#999]" onClick={() => dialog.current?.close()}>Close</button></div>
          <form action={action} className="grid gap-5">
            <input type="hidden" name="cardId" value={current.id} />
            <input type="hidden" name="page" value={current.page} />
            <div className="grid gap-4 md:grid-cols-2">
              <label className="grid gap-2 text-sm text-[#aaa]">Name<input className="input" name="name" defaultValue={current.name} required /></label>
              <label className="grid gap-2 text-sm text-[#aaa]">Card title<input className="input" name="title" defaultValue={current.title} required /></label>
              <label className="grid gap-2 text-sm text-[#aaa]">Page section
                {current.page === "TEAM" ? <select className="input" name="section" defaultValue={current.section}><option value="leadership">Leadership</option><option value="contributors">RoboRowdy contributors</option><option value="advisor">Faculty advisors</option></select> : <input className="input" name="section" value="people" readOnly />}
              </label>
              <label className="grid gap-2 text-sm text-[#aaa]">Display order<input className="input" name="sortOrder" type="number" min="0" max="9999" defaultValue={current.sortOrder} required /></label>
            </div>
            <label className="grid gap-2 text-sm text-[#aaa]">Biography<textarea className="input min-h-28" name="bio" defaultValue={current.bio} required /></label>
            <div><p className="mb-2 text-sm text-[#aaa]">Card photo</p><ImageUpload name="photoMediaId" removeName="removePhoto" purpose="roster-card" uploaderId={uploaderId} currentUrl={current.photoUrl} /></div>
            <label className="flex items-center gap-3 text-sm"><input type="checkbox" name="published" defaultChecked={current.published} />Publish this card</label>
            <div className="flex items-center gap-4"><button className="button" disabled={pending}>{pending ? "Saving…" : "Save card"}</button><p className={state.status === "error" ? "text-sm text-red-400" : "text-sm text-emerald-400"} aria-live="polite">{state.message}</p></div>
          </form>
        </div>
      </dialog>
    </>
  );
}

export function RosterManager({ cards, uploaderId }: { cards: Card[]; uploaderId: string }) {
  const pages: Page[] = ["TEAM", "VEX_U", "SIDC", "ROBOROWDY"];
  return <div className="space-y-8">{pages.map((page) => {
    const pageCards = cards.filter((card) => card.page === page);
    return <section className="border-t border-[#333] pt-6" key={page}>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-4"><div><h3 className="text-xl font-bold">{labels[page]}</h3><p className="mt-1 text-xs text-[#777]">{pageCards.filter((card) => !card.archivedAt).length} active cards</p></div><CardDialog page={page} uploaderId={uploaderId} /></div>
      <div className="grid gap-3 md:grid-cols-2">{pageCards.map((card) => <article className={`border p-4 ${card.archivedAt ? "border-[#332020] opacity-60" : "border-[#333]"}`} key={card.id}><div className="flex items-start justify-between gap-4"><div><strong>{card.name}</strong><p className="mt-1 text-sm text-[#fd7803]">{card.title}</p><p className="mt-1 text-xs text-[#777]">{card.section} · order {card.sortOrder}{!card.published ? " · hidden" : ""}</p></div><div className="flex gap-3">{!card.archivedAt && <CardDialog card={card} page={page} uploaderId={uploaderId} />}{card.archivedAt ? <form action={restoreRosterCard}><input type="hidden" name="cardId" value={card.id} /><button className="text-xs text-emerald-400">Restore</button></form> : <form action={archiveRosterCard}><input type="hidden" name="cardId" value={card.id} /><button className="text-xs text-red-400">Remove</button></form>}</div></div></article>)}</div>
    </section>;
  })}</div>;
}
