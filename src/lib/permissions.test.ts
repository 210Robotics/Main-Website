import { describe, expect, it } from "vitest";
import {
  assignableAccessRoles,
  canAccessAdmin,
  canGrantPermission,
  hasPermission,
  permissionKeys,
  rolePresets,
} from "@/lib/permissions";
describe("permission presets", () => {
  it("keeps members unprivileged", () =>
    expect(rolePresets.MEMBER).toHaveLength(0));
  it("gives mentors records oversight without account or access management", () => {
    expect(rolePresets.MENTOR).toEqual([
      "activity.view_all",
      "activity.edit_all",
      "reports.export",
    ]);
    expect(canAccessAdmin("MENTOR")).toBe(true);
    expect(canGrantPermission("MENTOR", "members.approve")).toBe(false);
    expect(canGrantPermission("MENTOR", "access.manage")).toBe(false);
  });
  it("gives leads, directors, and officers full admin rights without owner access", () => {
    const expected = permissionKeys.filter(
      (permission) => permission !== "access.manage",
    );
    expect(rolePresets.LEAD).toEqual(expected);
    expect(rolePresets.DIRECTOR).toEqual(expected);
    expect(rolePresets.OFFICER).toEqual(expected);
    expect(rolePresets.FULL_ADMIN).toEqual(expected);
    expect(canGrantPermission("LEAD", "members.approve")).toBe(true);
    expect(canGrantPermission("LEAD", "audit.view")).toBe(true);
    expect(canGrantPermission("OFFICER", "sponsors.manage")).toBe(true);
    expect(canGrantPermission("LEAD", "access.manage")).toBe(false);
    expect(canGrantPermission("DIRECTOR", "access.manage")).toBe(false);
    expect(canGrantPermission("OFFICER", "access.manage")).toBe(false);
  });
  it("keeps subteam leads limited to their assigned admin areas", () => {
    expect(rolePresets.OPERATIONS_LEAD).toEqual([
      "tasks.manage",
      "meetings.manage",
      "glossary.manage",
      "integrations.manage",
    ]);
    expect(rolePresets.ENGINEERING_LEAD).toEqual([
      "engineering.manage",
      "seasons.manage",
      "notebook.view",
      "notebook.manage",
      "scouting.manage",
      "inventory.manage",
      "purchasing.manage",
      "design_changes.manage",
    ]);
    expect(rolePresets.ENGINEERING_MEMBER).toEqual([
      "engineering.manage",
      "notebook.view",
      "notebook.manage",
      "scouting.manage",
    ]);
    expect(rolePresets.NOTEBOOK_EDITOR).toEqual([
      "notebook.view",
      "notebook.manage",
    ]);
    expect(rolePresets.SCOUTING_LEAD).toEqual([
      "notebook.view",
      "scouting.manage",
    ]);
    expect(rolePresets.LOGISTICS_LEAD).toEqual([
      "notebook.view",
      "inventory.manage",
      "purchasing.manage",
      "design_changes.manage",
    ]);
    expect(rolePresets.FINANCE_LEAD).toEqual([
      "finance.manage",
      "dues.manage",
    ]);
    expect(rolePresets.OUTREACH_LEAD).toEqual([
      "sponsors.manage",
      "media.manage",
      "inquiries.manage",
    ]);
    expect(rolePresets.CONTENT_LEAD).toEqual([
      "content.manage",
      "forms.manage",
      "events.manage",
      "directory.manage",
    ]);
    expect(hasPermission("ENGINEERING_LEAD", "finance.manage")).toBe(false);
    expect(hasPermission("FINANCE_LEAD", "engineering.manage")).toBe(false);
    expect(assignableAccessRoles).not.toContain("SUPER_ADMIN");
  });
  it("reserves access management for the super admin", () => {
    expect(canGrantPermission("SUPER_ADMIN", "access.manage")).toBe(true);
    expect(canGrantPermission("FULL_ADMIN", "access.manage")).toBe(false);
  });
  it("gives the owner every defined permission", () =>
    expect(rolePresets.SUPER_ADMIN).toEqual(permissionKeys));
  it("hides admin from ordinary members", () =>
    expect(canAccessAdmin("MEMBER")).toBe(false));
  it("allows an explicit admin permission", () =>
    expect(
      canAccessAdmin("MEMBER", { allow: ["directory.manage"], deny: [] }),
    ).toBe(true));
  it("honors a denied preset permission", () =>
    expect(
      hasPermission("OFFICER", "activity.view_all", {
        allow: [],
        deny: ["activity.view_all"],
      }),
    ).toBe(false));
});
