import { describe, expect, it } from "vitest";
import {
  estimatedOverrideScore,
  inventoryAvailable,
  parseTags,
  scoutingAwpEligible,
} from "./engineering-operations";

describe("engineering operations helpers", () => {
  it("evaluates the VEX U Override autonomous win point criteria", () => {
    expect(
      scoutingAwpEligible({
        autoPinsScored: 12,
        autoGoalsWithTwoPins: 4,
        autoRobotsMidfield: 1,
        autoContactedPerimeter: false,
        autoViolation: false,
      }),
    ).toBe(true);
    expect(
      scoutingAwpEligible({
        autoPinsScored: 11,
        autoGoalsWithTwoPins: 4,
        autoRobotsMidfield: 1,
        autoContactedPerimeter: false,
        autoViolation: false,
      }),
    ).toBe(false);
  });

  it("estimates Override scoring from recorded end states", () => {
    expect(
      estimatedOverrideScore({
        alliancePinsScored: 10,
        yellowPinsOwned: 3,
        robotsMidfield: 2,
        autonomousWon: true,
      }),
    ).toBe(108);
  });

  it("normalizes tags and available inventory", () => {
    expect(parseTags("drive, test, drive")).toEqual(["drive", "test"]);
    expect(inventoryAvailable({ quantityOnHand: 7, quantityReserved: 3 })).toBe(4);
  });
});
