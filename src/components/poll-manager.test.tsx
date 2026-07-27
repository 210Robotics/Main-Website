// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PollManager } from "@/components/poll-manager";

const mocks = vi.hoisted(() => ({
  save: vi.fn(async () => ({ status: "success" as const, message: "Poll saved and open for availability." })),
  refresh: vi.fn(),
}));

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: mocks.refresh }) }));
vi.mock("qrcode", () => ({ default: { toDataURL: vi.fn(async () => "data:image/png;base64,test") } }));
vi.mock("@/app/admin/poll-actions", () => ({
  createAvailabilityPoll: vi.fn(),
  deleteAvailabilityPoll: vi.fn(),
  deleteAvailabilityResponse: vi.fn(),
  duplicateAvailabilityPoll: vi.fn(),
  saveAvailabilityPoll: mocks.save,
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("PollManager", () => {
  it("keeps an open poll open when saving and exposes its public link", async () => {
    render(
      <PollManager
        polls={[{
          id: "3dbcc846-f9be-47a0-93f5-592728408df3",
          accessKey: "public-poll-key-1234567890123456",
          title: "Build meeting",
          description: "",
          timezone: "America/Chicago",
          dates: ["2026-07-23"],
          startTime: "18:00",
          endTime: "21:00",
          slotMinutes: 30,
          status: "OPEN",
          responseCount: 0,
          updatedAt: "2026-07-22T12:00:00.000Z",
        }]}
        responses={[]}
      />,
    );

    expect(screen.getByRole("link", { name: "Open poll" })).toHaveAttribute(
      "href",
      "/p/public-poll-key-1234567890123456",
    );
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(mocks.save).toHaveBeenCalledWith(expect.objectContaining({ status: "OPEN" })));
  });

  it("saves a newly entered range and edited times without requiring a separate apply step", async () => {
    render(
      <PollManager
        polls={[{
          id: "3dbcc846-f9be-47a0-93f5-592728408df3",
          accessKey: "public-poll-key-1234567890123456",
          title: "Build meeting",
          description: "",
          timezone: "America/Chicago",
          dates: ["2026-07-23"],
          startTime: "18:00",
          endTime: "21:00",
          slotMinutes: 30,
          status: "OPEN",
          responseCount: 0,
          updatedAt: "2026-07-22T12:00:00.000Z",
        }]}
        responses={[]}
      />,
    );
    fireEvent.change(screen.getByLabelText("Range start"), { target: { value: "2026-08-01" } });
    fireEvent.change(screen.getByLabelText("Range end"), { target: { value: "2026-08-03" } });
    fireEvent.change(screen.getByLabelText("Start time"), { target: { value: "17:30" } });
    fireEvent.change(screen.getByLabelText("End time"), { target: { value: "20:30" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(mocks.save).toHaveBeenCalledWith(expect.objectContaining({
      dates: ["2026-08-01", "2026-08-02", "2026-08-03"],
      startTime: "17:30",
      endTime: "20:30",
    })));
  });
});
