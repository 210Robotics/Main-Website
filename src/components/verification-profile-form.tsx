"use client";

import { useActionState } from "react";
import {
  saveVerificationProfile,
  type VerificationProfileState,
} from "@/app/verify/actions";

const initialState: VerificationProfileState = { status: "idle", message: "" };
const interests = [
  "CAD & Design",
  "Manufacturing",
  "Programming",
  "Electrical",
  "Scouting",
  "Engineering Notebook",
  "Outreach",
  "Finance",
];

function Errors({ values }: { values?: string[] }) {
  return values?.map((value) => (
    <small className="text-red-300" key={value}>
      {value}
    </small>
  ));
}

export function VerificationProfileForm({
  member,
}: {
  member: {
    firstName: string;
    lastName: string;
    displayName: string;
    academicLevel: string | null;
    major: string;
    expectedGraduationYear: number | null;
    teamInterests: string[];
    isPublic: boolean;
  };
}) {
  const [state, action, pending] = useActionState(
    saveVerificationProfile,
    initialState,
  );
  return (
    <form action={action} className="grid gap-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="field">
          <span>First name</span>
          <input className="input" defaultValue={member.firstName} name="firstName" autoComplete="given-name" required />
          <Errors values={state.errors?.firstName} />
        </label>
        <label className="field">
          <span>Last name</span>
          <input className="input" defaultValue={member.lastName} name="lastName" autoComplete="family-name" required />
          <Errors values={state.errors?.lastName} />
        </label>
      </div>
      <label className="field">
        <span>Team display name</span>
        <input className="input" defaultValue={member.displayName} name="displayName" autoComplete="name" required />
        <small>Use the recognizable name officers should see on the roster and Discord.</small>
        <Errors values={state.errors?.displayName} />
      </label>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="field">
          <span>Year or member type</span>
          <select className="input" defaultValue={member.academicLevel || ""} name="academicLevel" required>
            <option value="" disabled>Select one</option>
            <option value="FRESHMAN">Freshman</option>
            <option value="SOPHOMORE">Sophomore</option>
            <option value="JUNIOR">Junior</option>
            <option value="SENIOR">Senior</option>
            <option value="GRADUATE">Graduate</option>
            <option value="MASTERS">Master&apos;s</option>
            <option value="PHD">PhD</option>
            <option value="MENTOR">Mentor</option>
          </select>
          <Errors values={state.errors?.academicLevel} />
        </label>
        <label className="field">
          <span>Expected graduation year</span>
          <input className="input" defaultValue={member.expectedGraduationYear || ""} inputMode="numeric" name="expectedGraduationYear" placeholder="2028" />
          <Errors values={state.errors?.expectedGraduationYear} />
        </label>
      </div>
      <label className="field">
        <span>Major</span>
        <input className="input" defaultValue={member.major} name="major" placeholder="Mechanical engineering" />
        <Errors values={state.errors?.major} />
      </label>
      <fieldset className="field">
        <legend>Team interests</legend>
        <div className="grid gap-2 sm:grid-cols-2">
          {interests.map((interest) => (
            <label className="flex items-center gap-3 rounded-sm border border-[#303030] bg-[#101010] px-3 py-2 text-sm" key={interest}>
              <input defaultChecked={member.teamInterests.includes(interest)} name="teamInterests" type="checkbox" value={interest} />
              {interest}
            </label>
          ))}
        </div>
      </fieldset>
      <label className="field">
        <span>Directory visibility</span>
        <select className="input" defaultValue={member.isPublic ? "public" : "private"} name="profileVisibility">
          <option value="private">Private to the team</option>
          <option value="public">Show my approved profile publicly</option>
        </select>
      </label>
      <div className="flex flex-wrap items-center gap-4">
        <button className="button" disabled={pending}>
          {pending ? "Saving…" : "Save member profile"}
        </button>
        <p aria-live="polite" className={state.status === "error" ? "text-sm text-red-300" : "text-sm text-emerald-300"}>
          {state.message}
        </p>
      </div>
    </form>
  );
}

