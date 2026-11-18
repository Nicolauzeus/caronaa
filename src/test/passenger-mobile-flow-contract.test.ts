import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

describe("CARONAA passenger mobile experience", () => {
  it("keeps role switching exclusively in the account drawer", () => {
    const home = source("src/routes/_authenticated/home.tsx");
    const menu = source("src/components/caronaa/MobileAccountDrawer.tsx");
    const nav = source("src/components/caronaa/shell/app-navigation.ts");
    expect(home).not.toContain("<RoleSwitchHeader");
    expect(menu).toContain("Minha atividade");
    expect(menu).toContain('title: "Pedir carona"');
    expect(menu).toContain('title: "Oferecer carona"');
    expect(menu).toContain('intent: "request"');
    expect(menu).toContain('intent: "offer"');
    expect(nav).not.toContain('label: "Oferecer"');
  });

  it("uses verified, separate Flash prices and only shows real matching shared rides", () => {
    const planner = source("src/components/caronaa/shell/ShellJourneyPlanner.tsx");
    expect(planner).toContain("flashFares[type]");
    expect(planner).toContain("flashDriverCounts[type]");
    expect(planner).toContain("onRouteMatches.length>0&&<button");
    expect(planner).toContain('setFlashStep("confirm")');
    expect(planner).toContain('setFlashStep("shared")');
    expect(planner).toContain('targetTime:serviceType==="FLASH"?new Date()');
    expect(planner).toContain('flashStep==="choices"&&flashChoices');
  });

  it("ships real PNG vehicle images instead of external assets", () => {
    for (const file of ["public/flash-moto.png", "public/flash-carro.png"]) {
      const bytes = readFileSync(resolve(process.cwd(), file));
      expect(bytes.length).toBeGreaterThan(1500);
      expect(bytes.subarray(0, 8).toString("hex")).toBe("89504e470d0a1a0a");
    }
  });
});
