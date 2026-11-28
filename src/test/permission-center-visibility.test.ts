import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
describe("permission access routes", () => {
  it("does not gate the UI on native platform and mounts access in both maps and header", () => {
    const setup=readFileSync("src/components/caronaa/NativePermissionSetup.tsx","utf8");
    const shell=readFileSync("src/components/caronaa/AppShell.tsx","utf8");
    const cockpit=readFileSync("src/components/caronaa/ProfessionalAvailabilityPage.tsx","utf8");
    const home=readFileSync("src/routes/_authenticated/home.tsx","utf8");
    expect(setup).not.toContain("if (!isNativeAndroid()) return null");
    expect(setup).not.toContain("if (!native) return <>{children}</>");
    expect(shell).toContain("<NativePermissionSetupHeaderButton />");
    expect(cockpit).toContain("<NativePermissionSetupFab ");
    expect(home).toContain("<NativePermissionSetupFab />");
    expect(setup).toContain("readWebSetupStatus()");
  });
});
