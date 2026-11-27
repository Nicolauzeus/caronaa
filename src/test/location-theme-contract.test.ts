import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const autocomplete = readFileSync("src/components/formulario/LocationAutocomplete.tsx", "utf8");
const home = readFileSync("src/components/caronaa/shell/ShellJourneyPlanner.tsx", "utf8");
const offer = readFileSync("src/routes/_authenticated/oferecer.tsx", "utf8");
const theme = readFileSync("src/components/caronaa/ThemeToggle.tsx", "utf8");

describe("Location search contrast across light and dark modes", () => {
  it("uses semantic foreground in light mode fields and suggestions", () => {
    expect(autocomplete).toContain("text-foreground caret-foreground");
    expect(autocomplete).toContain("bg-card text-card-foreground");
    expect(autocomplete).toContain("text-card-foreground hover:bg-caronaa-primary/10");
  });
  it("keeps autocomplete dark within dark-glass journey surfaces", () => {
    expect(home).toContain('id="shell-destination"');
    expect(offer).toContain('id="oferecer-destino"');
    expect(home).not.toContain('variant="simple"');
    expect(offer).not.toContain('variant="simple"');
  });
  it("syncs system and tab preference changes", () => {
    expect(theme).toContain('window.addEventListener("storage", onStorage)');
    expect(theme).toContain("new MutationObserver(sync)");
    expect(theme).toContain('media?.addEventListener?.("change", onSystemTheme)');
  });
});
