// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PortalSearch } from "@/components/portal-search";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
beforeEach(() => {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        items: [
          {
            id: "member-1",
            title: "Alex Builder",
            subtitle: "Mechanical Lead",
            type: "Member",
            href: "/admin/control-center?tab=people&member=member-1",
          },
        ],
      }),
    }),
  );
});

describe("PortalSearch", () => {
  it("shows popular destinations before a query", () => {
    render(<PortalSearch canAdmin />);
    expect(
      screen.getByRole("heading", { name: "Where do you want to go?" }),
    ).toBeVisible();
    expect(screen.getByText("Popular features")).toBeVisible();
    expect(screen.getByRole("link", { name: /Dashboard/ })).toBeVisible();
  });

  it("finds related features from job keywords", () => {
    render(<PortalSearch canAdmin />);
    const search = screen.getByRole("searchbox");
    fireEvent.change(search, { target: { value: "enter expenses" } });
    expect(screen.getByRole("link", { name: /Finance/ })).toHaveAttribute(
      "href",
      "/admin/operations?tool=finance",
    );
    fireEvent.change(search, { target: { value: "battery" } });
    expect(
      screen.getByRole("link", { name: /Battery tracking/ }),
    ).toBeVisible();
  });

  it("finds a member by name or role", async () => {
    render(<PortalSearch canAdmin />);
    fireEvent.change(screen.getByRole("searchbox"), {
      target: { value: "mechanical" },
    });
    await waitFor(() =>
      expect(screen.getByRole("link", { name: /Alex Builder/ })).toHaveAttribute(
        "href",
        "/admin/control-center?tab=people&member=member-1",
      ),
    );
  });
});
