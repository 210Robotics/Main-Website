// @vitest-environment jsdom

import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DashboardNavigation } from "@/components/dashboard-navigation";

const push = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
}));

describe("DashboardNavigation", () => {
  beforeEach(() => push.mockClear());

  it("provides a compact section picker without changing route structure", () => {
    render(
      <DashboardNavigation
        current="overview"
        label="Admin dashboard sections"
        items={[
          { value: "overview", label: "Overview", href: "/admin" },
          {
            value: "finance",
            label: "Finance",
            href: "/admin/operations?tool=finance",
          },
        ]}
      />,
    );
    const picker = screen.getByRole("combobox", {
      name: "Admin dashboard sections",
    });
    expect((picker as HTMLSelectElement).value).toBe("overview");
    fireEvent.change(picker, { target: { value: "finance" } });
    expect(push).toHaveBeenCalledWith("/admin/operations?tool=finance");
    expect(
      screen.getAllByRole("link", { name: "Finance" })[0].getAttribute("href"),
    ).toBe("/admin/operations?tool=finance");
  });
});
