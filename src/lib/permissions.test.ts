import { describe, expect, it } from "vitest";
import { canGrantPermission, permissionKeys, rolePresets } from "@/lib/permissions";
describe("permission presets",()=>{
  it("keeps members unprivileged",()=>expect(rolePresets.MEMBER).toHaveLength(0));
  it("reserves access management for the super admin",()=>{
    expect(canGrantPermission("SUPER_ADMIN","access.manage")).toBe(true);
    expect(canGrantPermission("FULL_ADMIN","access.manage")).toBe(false);
  });
  it("gives the owner every defined permission",()=>expect(rolePresets.SUPER_ADMIN).toEqual(permissionKeys));
});
