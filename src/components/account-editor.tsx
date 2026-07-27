"use client";

import { useActionState, useRef, useState } from "react";
import {
  updateMemberAccess,
  updateMemberProfile,
  type AdminFormState,
} from "@/app/admin/actions";
import { ImageUpload } from "@/components/image-upload";
import {
  accessRoleLabels,
  assignableAccessRoles,
  permissionKeys,
  permissionLabels,
  type AccessRole,
  type PermissionKey,
} from "@/lib/permissions";

const initialState: AdminFormState = { status: "idle", message: "" };

type Account = {
  id: string;
  displayName: string;
  email: string;
  organizationRole: string;
  bio: string;
  accessRole: AccessRole;
  permissionOverrides: { allow: string[]; deny: string[] };
  isPublic: boolean;
  photoUrl: string | null;
};

type OverrideChoice = "preset" | "allow" | "deny";

export function AccountEditor({
  account,
  uploaderId,
  projects,
  selectedProjects,
  canEditProfile,
  canEditAccess,
  isSuperAdmin,
  isSelf,
  activity,
  triggerLabel = "Edit account",
  triggerClassName = "text-xs text-[#fd7803] hover:text-white",
}: {
  account: Account;
  uploaderId: string;
  projects: { id: string; slug: string; name: string }[];
  selectedProjects: string[];
  canEditProfile: boolean;
  canEditAccess: boolean;
  isSuperAdmin: boolean;
  isSelf: boolean;
  activity?: {
    hours: {
      id: string;
      date: string;
      minutes: number;
      project: string;
      category: string;
      description: string;
    }[];
    contributions: {
      id: string;
      date: string;
      title: string;
      project: string;
      category: string;
      description: string;
    }[];
    attendance: {
      id: string;
      date: string;
      title: string;
      type: string;
      topic: string | null;
      location: string | null;
    }[];
  };
  triggerLabel?: string;
  triggerClassName?: string;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [state, profileAction, pending] = useActionState(
    updateMemberProfile,
    initialState,
  );
  const [accessState, accessAction, accessPending] = useActionState(
    updateMemberAccess,
    initialState,
  );
  const [accessRole, setAccessRole] = useState(account.accessRole);
  const [overrides, setOverrides] = useState<
    Record<PermissionKey, OverrideChoice>
  >(
    () =>
      Object.fromEntries(
        permissionKeys.map((key) => [
          key,
          account.permissionOverrides.deny.includes(key)
            ? "deny"
            : account.permissionOverrides.allow.includes(key)
              ? "allow"
              : "preset",
        ]),
      ) as Record<PermissionKey, OverrideChoice>,
  );
  return (
    <>
      <button
        className={triggerClassName}
        type="button"
        onClick={() => dialog.current?.showModal()}
      >
        {triggerLabel}
      </button>
      <dialog
        ref={dialog}
        className="admin-dialog w-[min(760px,calc(100vw-2rem))] bg-[#101010] p-0 text-white backdrop:bg-black/80"
      >
        <div className="border border-[#383838] p-6 md:p-8">
          <div className="mb-6 flex items-start justify-between gap-4">
            <div>
              <p className="eyebrow">Account editor</p>
              <h2 className="mt-2 text-2xl font-bold">{account.displayName}</h2>
              <p className="mt-1 text-xs text-[#777]">{account.email}</p>
            </div>
            <button
              className="text-sm text-[#999] hover:text-white"
              type="button"
              onClick={() => dialog.current?.close()}
            >
              Close
            </button>
          </div>
          {activity && (
            <MemberActivitySummary account={account} activity={activity} />
          )}
          {canEditProfile && (
            <form action={profileAction} className="grid gap-5">
              <input type="hidden" name="memberId" value={account.id} />
              <div className="grid gap-4 md:grid-cols-2">
                <label className="grid gap-2 text-sm text-[#aaa]">
                  Display name
                  <input
                    className="input"
                    name="displayName"
                    defaultValue={account.displayName}
                    required
                  />
                </label>
                <label className="grid gap-2 text-sm text-[#aaa]">
                  Organization title
                  <input
                    className="input"
                    name="organizationRole"
                    defaultValue={account.organizationRole}
                    required
                  />
                </label>
              </div>
              <label className="grid gap-2 text-sm text-[#aaa]">
                Public biography
                <textarea
                  className="input min-h-24"
                  name="bio"
                  defaultValue={account.bio}
                />
              </label>
              <div>
                <p className="mb-2 text-sm text-[#aaa]">Profile photo</p>
                <ImageUpload
                  name="photoMediaId"
                  removeName="removePhoto"
                  purpose="account-profile"
                  uploaderId={uploaderId}
                  currentUrl={account.photoUrl}
                />
              </div>
              <div className="grid gap-2 sm:grid-cols-3">
                {projects.map((project) => (
                  <label
                    className="flex items-center gap-2 text-sm"
                    key={project.id}
                  >
                    <input
                      type="checkbox"
                      name="projects"
                      value={project.slug}
                      defaultChecked={selectedProjects.includes(project.id)}
                    />
                    {project.name}
                  </label>
                ))}
              </div>
              <label className="flex items-center gap-3 text-sm">
                <input
                  type="checkbox"
                  name="isPublic"
                  defaultChecked={account.isPublic}
                />
                Show this approved account publicly
              </label>
              <div className="flex items-center gap-4">
                <button className="button" disabled={pending}>
                  {pending ? "Saving…" : "Save account"}
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
          )}
          {canEditAccess && !isSelf && account.accessRole !== "SUPER_ADMIN" && (
            <form
              action={accessAction}
              className="mt-8 grid gap-5 border-t border-[#333] pt-7"
            >
              <input type="hidden" name="memberId" value={account.id} />
              {permissionKeys.map((key) =>
                overrides[key] === "allow" ? (
                  <input
                    key={`allow-${key}`}
                    type="hidden"
                    name="allow"
                    value={key}
                  />
                ) : overrides[key] === "deny" ? (
                  <input
                    key={`deny-${key}`}
                    type="hidden"
                    name="deny"
                    value={key}
                  />
                ) : null,
              )}
              <label className="grid gap-2 text-sm text-[#aaa]">
                Access preset
                <select
                  className="input"
                  name="accessRole"
                  value={accessRole}
                  onChange={(event) =>
                    setAccessRole(event.target.value as AccessRole)
                  }
                >
                  {assignableAccessRoles
                    .filter((role) => isSuperAdmin || role !== "FULL_ADMIN")
                    .map((role) => (
                      <option key={role} value={role}>
                        {accessRoleLabels[role]}
                      </option>
                    ))}
                </select>
              </label>
              {accessRole.endsWith("_LEAD") && (
                <p className="rounded-sm border border-[#fd7803]/35 bg-[#fd7803]/8 p-4 text-xs leading-5 text-[#d6b08e]">
                  Subteam lead presets only expose that subteam&apos;s assigned
                  admin areas. Additional access must be granted explicitly.
                </p>
              )}
              <div className="rounded-sm border border-[#333] bg-[#0b0b0b] p-4 text-xs leading-5 text-[#999]">
                Each setting can inherit from the preset, be explicitly allowed,
                or be explicitly denied. Deny always wins.
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                {permissionKeys
                  .filter((key) => isSuperAdmin || key !== "access.manage")
                  .map((key) => (
                    <label
                      className="grid gap-2 border border-[#333] p-3 text-xs"
                      key={key}
                    >
                      <span>{permissionLabels[key]}</span>
                      <select
                        className="input py-2 text-xs"
                        aria-label={`${permissionLabels[key]} override`}
                        value={overrides[key]}
                        onChange={(event) =>
                          setOverrides((current) => ({
                            ...current,
                            [key]: event.target.value as OverrideChoice,
                          }))
                        }
                      >
                        <option value="preset">Use preset</option>
                        <option value="allow">Allow</option>
                        <option value="deny">Deny</option>
                      </select>
                    </label>
                  ))}
              </div>
              <div className="flex flex-wrap items-center gap-4">
                <button
                  className="button secondary w-fit"
                  disabled={accessPending}
                >
                  {accessPending ? "Saving..." : "Save access"}
                </button>
                <p
                  className={
                    accessState.status === "error"
                      ? "text-sm text-red-400"
                      : "text-sm text-emerald-400"
                  }
                  aria-live="polite"
                >
                  {accessState.message}
                </p>
              </div>
            </form>
          )}
        </div>
      </dialog>
    </>
  );
}

function MemberActivitySummary({
  account,
  activity,
}: {
  account: Account;
  activity: NonNullable<Parameters<typeof AccountEditor>[0]["activity"]>;
}) {
  const [kind, setKind] = useState<"attendance" | "hours" | "contributions">(
    "attendance",
  );
  const totalMinutes = activity.hours.reduce(
    (sum, entry) => sum + entry.minutes,
    0,
  );
  const byType = activity.attendance.reduce<Record<string, number>>(
    (counts, entry) => ({
      ...counts,
      [entry.type]: (counts[entry.type] ?? 0) + 1,
    }),
    {},
  );
  const byActivity = activity.attendance.reduce<Record<string, number>>(
    (counts, entry) => ({
      ...counts,
      [entry.title]: (counts[entry.title] ?? 0) + 1,
    }),
    {},
  );
  return (
    <section className="mb-7 border border-[#333] bg-[#0b0b0b] p-4 md:p-5">
      <div className="grid gap-3 sm:grid-cols-4">
        <ActivityMetric label="Role" value={account.organizationRole} />
        <ActivityMetric
          label="Hours"
          value={`${(totalMinutes / 60).toFixed(1)}h`}
        />
        <ActivityMetric
          label="Events attended"
          value={String(activity.attendance.length)}
        />
        <ActivityMetric
          label="Contributions"
          value={String(activity.contributions.length)}
        />
      </div>
      {!!Object.keys(byType).length && (
        <div className="mt-4 flex flex-wrap gap-2">
          {Object.entries(byType).map(([type, count]) => (
            <span className="tag" key={type}>
              {type.replaceAll("_", " ")} · {count}
            </span>
          ))}
        </div>
      )}
      {!!Object.keys(byActivity).length && (
        <div className="mt-5">
          <p className="mb-2 text-[10px] uppercase tracking-wider text-[#777]">
            Attendance by activity
          </p>
          <div className="flex flex-wrap gap-2">
            {Object.entries(byActivity).map(([title, count]) => (
              <span className="tag" key={title}>
                {title} · {count}
              </span>
            ))}
          </div>
        </div>
      )}
      <div className="mt-5 flex flex-wrap gap-2">
        {(["attendance", "hours", "contributions"] as const).map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => setKind(item)}
            className={`tag capitalize ${kind === item ? "border-[#fd7803] text-white" : ""}`}
          >
            {item}
          </button>
        ))}
      </div>
      <div className="mt-3 max-h-64 overflow-y-auto border-t border-[#333]">
        {kind === "attendance" &&
          activity.attendance.map((entry) => (
            <ActivityRow
              key={entry.id}
              title={entry.title}
              meta={`${entry.type.replaceAll("_", " ")}${entry.topic ? ` · ${entry.topic}` : ""} · ${entry.date}${entry.location ? ` · ${entry.location}` : ""}`}
            />
          ))}
        {kind === "hours" &&
          activity.hours.map((entry) => (
            <ActivityRow
              key={entry.id}
              title={`${(entry.minutes / 60).toFixed(2)}h · ${entry.project}`}
              meta={`${entry.date} · ${entry.category} · ${entry.description}`}
            />
          ))}
        {kind === "contributions" &&
          activity.contributions.map((entry) => (
            <ActivityRow
              key={entry.id}
              title={entry.title}
              meta={`${entry.date} · ${entry.project} · ${entry.category} · ${entry.description}`}
            />
          ))}
        {!activity[kind].length && (
          <p className="py-5 text-sm text-[#777]">No {kind} recorded.</p>
        )}
      </div>
    </section>
  );
}

function ActivityMetric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wider text-[#777]">
        {label}
      </p>
      <strong className="mt-1 block text-sm text-white">{value}</strong>
    </div>
  );
}
function ActivityRow({ title, meta }: { title: string; meta: string }) {
  return (
    <div className="py-3">
      <strong className="text-sm">{title}</strong>
      <p className="mt-1 text-xs leading-5 text-[#777]">{meta}</p>
    </div>
  );
}
