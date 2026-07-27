import { describe, expect, it } from "vitest";
import { parseOnshapeBom } from "@/lib/onshape-bom";

describe("parseOnshapeBom", () => {
  it("maps common Onshape CSV columns", () => {
    const result = parseOnshapeBom('Item,Part number,Name,Description,Quantity,Revision,Material,Vendor,Make / buy,Unit cost\n1,210-001,Intake Plate,"Plate, left",2,B,6061 Aluminum,Metal Shop,Make,$12.50');
    expect(result.rows).toEqual([expect.objectContaining({ partNumber: "210-001", name: "Intake Plate", description: "Plate, left", quantity: 2, revision: "B", unitCost: 12.5 })]);
  });

  it("accepts tab-separated data pasted from a spreadsheet", () => {
    const result = parseOnshapeBom("Part #\tDescription\tQty\n210-002\tBearing\t4");
    expect(result.rows[0]).toEqual(expect.objectContaining({ partNumber: "210-002", name: "Bearing", quantity: 4 }));
  });
});
