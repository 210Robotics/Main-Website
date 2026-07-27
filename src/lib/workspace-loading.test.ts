import { describe, expect, it } from "vitest";
import {
  adminLoadPlan,
  normalizeAdminTab,
  normalizeOperationTool,
  normalizePortalTab,
  operationsLoadPlan,
  portalLoadPlan,
} from "./workspace-loading";

describe("workspace load plans", () => {
  it("falls back to safe overview tabs", () => {
    expect(normalizePortalTab("unknown")).toBe("dashboard");
    expect(normalizeAdminTab("unknown")).toBe("overview");
    expect(normalizeOperationTool("unknown")).toBe("overview");
  });

  it("loads only the records needed by a portal section", () => {
    const polling = portalLoadPlan("polls");
    expect(polling.polls).toBe(true);
    expect(polling.hours).toBe(false);
    expect(polling.engineering).toBe(false);

    const engineering = portalLoadPlan("engineering");
    expect(engineering.engineering).toBe(true);
    expect(engineering.members).toBe(true);
    expect(engineering.polls).toBe(false);
  });

  it("keeps admin editors isolated from unrelated datasets", () => {
    const documents = adminLoadPlan("documents");
    expect(documents.documents).toBe(true);
    expect(documents.media).toBe(false);
    expect(documents.members).toBe(false);

    const overview = adminLoadPlan("overview");
    expect(overview.forms).toBe(true);
    expect(overview.docs).toBe(true);
    expect(overview.documents).toBe(false);
  });

  it("does not hydrate every operations tool together", () => {
    const notebook = operationsLoadPlan("notebook");
    expect(notebook.notebook).toBe(true);
    expect(notebook.financeEntries).toBe(false);
    expect(notebook.scouting).toBe(false);

    const overview = operationsLoadPlan("overview");
    expect(overview.tasks).toBe(true);
    expect(overview.financeEntries).toBe(true);
    expect(overview.notebook).toBe(false);
  });
});
