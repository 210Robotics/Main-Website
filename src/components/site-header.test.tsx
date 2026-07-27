// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SiteHeader } from "@/components/site-header";

vi.mock("next/navigation", () => ({ usePathname: () => "/" }));
vi.mock("@/components/inquiry-form", () => ({ InquiryModal: () => null }));

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("SiteHeader", () => {
  it("closes the previous desktop dropdown when another one opens", () => {
    vi.stubGlobal("fetch", vi.fn(() => new Promise(() => undefined)));
    render(<SiteHeader />);

    const programsMenu = screen.getByText("Programs").closest("details");
    const exploreMenu = screen.getByText("Explore").closest("details");

    fireEvent.click(screen.getByText("Programs"));
    expect(programsMenu).toHaveAttribute("open");
    expect(exploreMenu).not.toHaveAttribute("open");

    fireEvent.click(screen.getByText("Explore"));
    expect(programsMenu).not.toHaveAttribute("open");
    expect(exploreMenu).toHaveAttribute("open");
  });
});
