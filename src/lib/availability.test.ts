import { describe, expect, it } from "vitest";
import {
  availabilityOverlap,
  availabilityDateRange,
  defaultAvailabilityPollSchedule,
  generateAvailabilitySlots,
  updateAvailabilitySelection,
} from "@/lib/availability";

describe("availability polls", () => {
  it("builds an inclusive bounded date range", () => {
    expect(availabilityDateRange("2026-08-01", "2026-08-03")).toEqual([
      "2026-08-01",
      "2026-08-02",
      "2026-08-03",
    ]);
  });

  it("creates polls open by default with a usable date", () => {
    const now = new Date("2026-07-22T12:00:00.000Z");
    expect(defaultAvailabilityPollSchedule(now)).toEqual({
      dates: ["2026-07-23"],
      status: "OPEN",
      openedAt: now,
    });
  });

  it("builds slots for each candidate date", () => {
    expect(
      generateAvailabilitySlots({
        dates: ["2026-07-20", "2026-07-21"],
        startTime: "18:00",
        endTime: "19:00",
        slotMinutes: 30,
      }),
    ).toHaveLength(4);
  });

  it("ranks the strongest overlap first", () => {
    const slots = ["2026-07-20|18:00", "2026-07-20|18:30"];
    expect(
      availabilityOverlap(slots, [
        { availableSlots: slots },
        { availableSlots: [slots[1]] },
      ])[0],
    ).toEqual({ slot: slots[1], count: 2 });
  });

  it("paints availability on and off without toggling an already-painted slot", () => {
    const slot = "2026-07-20|18:00";
    const selected = updateAvailabilitySelection([], slot, "select");

    expect([...updateAvailabilitySelection(selected, slot, "select")]).toEqual([
      slot,
    ]);
    expect([...updateAvailabilitySelection(selected, slot, "clear")]).toEqual(
      [],
    );
  });
});
