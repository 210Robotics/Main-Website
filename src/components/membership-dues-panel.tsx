import { and, asc, eq } from "drizzle-orm";
import Link from "next/link";
import { getDb } from "@/db";
import { discordGuilds, membershipDues, members } from "@/db/schema";
import {
  initializeMembershipDuesPeriod,
  saveMembershipDues,
} from "@/app/admin/discord-actions";
import { ActionForm } from "@/components/action-form";
import { requirePermission } from "@/lib/auth";
import { currentMembershipPeriod } from "@/lib/membership-dues";

function dollars(cents: number) {
  return (cents / 100).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
  });
}

function dateInput(value: Date | null) {
  if (!value) return "";
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export async function MembershipDuesPanel({
  period = currentMembershipPeriod(),
}: {
  period?: string;
}) {
  await requirePermission("dues.manage");
  const safePeriod = /^\d{4}-\d{4}$/.test(period)
    ? period
    : currentMembershipPeriod();
  const [rows, guildRows] = await Promise.all([
    getDb()
      .select({
        member: members,
        dues: membershipDues,
      })
      .from(members)
      .leftJoin(
        membershipDues,
        and(
          eq(membershipDues.memberId, members.id),
          eq(membershipDues.period, safePeriod),
        ),
      )
      .where(eq(members.status, "ACTIVE"))
      .orderBy(asc(members.displayName)),
    getDb()
      .select()
      .from(discordGuilds)
      .orderBy(discordGuilds.updatedAt)
      .limit(1),
  ]);
  const guild = guildRows[0] ?? null;
  const totalDue = rows.reduce(
    (total, row) => total + (row.dues?.amountDueCents ?? 0),
    0,
  );
  const totalPaid = rows.reduce(
    (total, row) => total + (row.dues?.amountPaidCents ?? 0),
    0,
  );
  const paidCount = rows.filter(
    (row) => row.dues?.status === "PAID" || row.dues?.status === "WAIVED",
  ).length;
  const outstanding = Math.max(0, totalDue - totalPaid);

  return (
    <section className="card mt-7 min-w-0 p-5 sm:p-6 md:p-8">
      <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <p className="eyebrow">Active member roster</p>
          <h2 className="mt-4 text-2xl font-bold">Membership dues</h2>
          <p className="mt-3 max-w-3xl text-sm leading-7 text-[#999]">
            Every active member is listed, including people who do not yet have
            a dues record. Paid status is calculated from the amount due and
            amount received.
          </p>
        </div>
        <form className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
          <input type="hidden" name="tab" value="dues" />
          <label className="field min-w-44">
            <span>Tracking period</span>
            <input
              className="input"
              name="period"
              pattern="\d{4}-\d{4}"
              defaultValue={safePeriod}
              placeholder="2026-2027"
            />
          </label>
          <button className="button secondary justify-center sm:self-end">
            View period
          </button>
        </form>
      </div>

      <div className="mt-7 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Metric value={String(rows.length)} label="Active members" />
        <Metric
          value={`${paidCount}/${rows.length}`}
          label="Paid or waived"
        />
        <Metric value={dollars(totalPaid)} label="Collected" />
        <Metric value={dollars(outstanding)} label="Outstanding" />
      </div>

      {guild && (
        <div className="mt-5 flex flex-col gap-4 border border-[#343434] bg-[#0d0d0d] p-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <strong className="text-sm text-white">
              Discord access: {guild.duesEnforcementEnabled ? "payment enforcement on" : "transition mode"}
            </strong>
            <p className="mt-1 text-xs leading-5 text-[#888]">
              {guild.duesEnforcementEnabled
                ? "Paid and waived updates automatically refresh the linked member's Discord role."
                : "Dues are tracked, but nobody is restricted while the transition toggle is off."}
            </p>
          </div>
          <Link
            className="button secondary shrink-0 justify-center"
            href="/admin?tab=discord#discord-dues-access"
          >
            Configure Discord access
          </Link>
        </div>
      )}

      <details className="mt-7 border border-[#343434] bg-[#0d0d0d]">
        <summary className="cursor-pointer px-5 py-4 font-semibold text-white">
          Set up or update this period for every active member
        </summary>
        <ActionForm
          action={initializeMembershipDuesPeriod}
          successMessage="Dues period applied to the active roster."
          className="grid gap-4 border-t border-[#333] p-5 md:grid-cols-3"
        >
          <input type="hidden" name="period" value={safePeriod} />
          <label className="field">
            <span>Amount due per member</span>
            <input
              className="input"
              name="amountDue"
              type="number"
              min="0"
              max="100000"
              step="0.01"
              defaultValue="0"
              required
            />
          </label>
          <label className="field">
            <span>Due date</span>
            <input className="input" name="dueAt" type="date" />
          </label>
          <button className="button justify-center md:self-end">
            Apply to active roster
          </button>
        </ActionForm>
      </details>

      <div className="mt-7 grid gap-3">
        {rows.map(({ member, dues }) => (
          <details
            className="group border border-[#343434] bg-[#101010] open:border-[#5a3a20]"
            key={member.id}
          >
            <summary className="grid cursor-pointer list-none gap-3 p-4 sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:items-center sm:px-5">
              <div className="min-w-0">
                <strong className="block truncate">{member.displayName}</strong>
                <span className="block truncate text-xs text-[#777]">
                  {member.organizationRole} · {member.email}
                </span>
              </div>
              <span
                className={`tag w-fit ${
                  dues?.status === "PAID"
                    ? "border-emerald-700 text-emerald-300"
                    : dues?.status === "WAIVED"
                      ? "border-blue-700 text-blue-300"
                      : dues?.status === "PARTIAL"
                        ? "border-amber-700 text-amber-300"
                        : "border-[#555] text-[#aaa]"
                }`}
              >
                {dues?.status ?? "NOT SET"}
              </span>
              <span className="text-sm tabular-nums text-[#bbb]">
                {dollars(dues?.amountPaidCents ?? 0)} /{" "}
                {dollars(dues?.amountDueCents ?? 0)}
              </span>
            </summary>
            <ActionForm
              action={saveMembershipDues}
              successMessage="Member dues updated."
              className="grid gap-4 border-t border-[#333] p-4 sm:p-5 lg:grid-cols-4"
            >
              <input type="hidden" name="memberId" value={member.id} />
              <input type="hidden" name="period" value={safePeriod} />
              <label className="field">
                <span>Amount due</span>
                <input
                  className="input"
                  name="amountDue"
                  type="number"
                  min="0"
                  max="100000"
                  step="0.01"
                  defaultValue={(dues?.amountDueCents ?? 0) / 100}
                  required
                />
              </label>
              <label className="field">
                <span>Manual / non-Stripe amount received</span>
                <input
                  className="input"
                  name="amountPaid"
                  type="number"
                  min="0"
                  max="100000"
                  step="0.01"
                  defaultValue={(dues?.manualAmountPaidCents ?? 0) / 100}
                  required
                />
                <small className="text-xs leading-5 text-[#777]">
                  Stripe payments are added automatically and should not be
                  entered here again.
                </small>
              </label>
              <label className="field">
                <span>Status</span>
                <select
                  className="input"
                  name="status"
                  defaultValue={dues?.status ?? "DUE"}
                >
                  <option value="DUE">Due / calculate automatically</option>
                  <option value="PARTIAL">Partial / calculate automatically</option>
                  <option value="PAID">Paid / calculate automatically</option>
                  <option value="WAIVED">Waived</option>
                </select>
              </label>
              <label className="field">
                <span>Due date</span>
                <input
                  className="input"
                  name="dueAt"
                  type="date"
                  defaultValue={dateInput(dues?.dueAt ?? null)}
                />
              </label>
              <label className="field lg:col-span-2">
                <span>Payment method</span>
                <input
                  className="input"
                  name="paymentMethod"
                  defaultValue={dues?.paymentMethod ?? ""}
                  placeholder="Cash, check, card, waiver…"
                />
              </label>
              <label className="field lg:col-span-2">
                <span>Private notes</span>
                <input
                  className="input"
                  name="notes"
                  defaultValue={dues?.notes ?? ""}
                  placeholder="Receipt or follow-up note"
                />
              </label>
              <button className="button justify-center lg:col-span-4 lg:w-fit">
                Save member dues
              </button>
            </ActionForm>
          </details>
        ))}
      </div>
      {!rows.length && (
        <p className="mt-7 border border-dashed border-[#333] p-6 text-sm text-[#777]">
          There are no active members to display.
        </p>
      )}
    </section>
  );
}

function Metric({ value, label }: { value: string; label: string }) {
  return (
    <div className="border border-[#343434] bg-[#101010] p-4">
      <strong className="text-2xl text-[#fd7803]">{value}</strong>
      <p className="mt-2 text-xs uppercase tracking-[.09em] text-[#777]">
        {label}
      </p>
    </div>
  );
}
