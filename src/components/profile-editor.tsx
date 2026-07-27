"use client";

import { useActionState } from "react";
import { updateProfile, type ProfileFormState } from "@/app/portal/actions";
import { ImageUpload } from "@/components/image-upload";

const initialState: ProfileFormState = { status: "idle", message: "" };

export function ProfileEditor({
  member,
}: {
  member: {
    id: string;
    displayName: string;
    organizationRole: string;
    bio: string;
    photoUrl: string | null;
  };
}) {
  const [state, action, pending] = useActionState(updateProfile, initialState);
  return (
    <form action={action} className="grid gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="grid gap-2 text-sm text-[#aaa]">
          <span>Display name</span>
          <input className="input" name="displayName" defaultValue={member.displayName} required />
          {state.errors?.displayName?.map((error) => <small className="text-red-400" key={error}>{error}</small>)}
        </label>
        <label className="grid gap-2 text-sm text-[#aaa]">
          <span>Organization role</span>
          <input className="input" value={member.organizationRole} disabled />
        </label>
      </div>
      <label className="grid gap-2 text-sm text-[#aaa]">
        <span>Biography</span>
        <textarea className="input min-h-28" name="bio" defaultValue={member.bio} />
      </label>
      <div>
        <p className="mb-2 text-sm text-[#aaa]">Profile photo</p>
        <ImageUpload
          name="photoMediaId"
          removeName="removePhoto"
          purpose="self-profile"
          uploaderId={member.id}
          currentUrl={member.photoUrl}
          label="Choose profile photo"
        />
      </div>
      <div className="flex flex-wrap items-center gap-4">
        <button className="button w-fit" disabled={pending}>{pending ? "Saving…" : "Update profile"}</button>
        <p
          className={state.status === "error" ? "text-sm text-red-400" : "text-sm text-emerald-400"}
          aria-live="polite"
        >
          {state.message}
        </p>
      </div>
    </form>
  );
}
