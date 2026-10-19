import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const read = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");
const css = read("src/styles.css");
const insight = read("src/components/admin/InsightChart.tsx");
const evidence = read("src/components/admin/EvidenceChart.tsx");

function luminance(hex: string): number {
  const channels = [1,3,5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255);
  const [red, green, blue] = channels.map(channel =>
    channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4);
  return red * 0.2126 + green * 0.7152 + blue * 0.0722;
}
function contrast(a: string, b: string): number {
  const high = Math.max(luminance(a), luminance(b));
  const low = Math.min(luminance(a), luminance(b));
  return (high + 0.05) / (low + 0.05);
}

describe("Admin chart visual accessibility contract", () => {
  it("provides high-contrast semantic CSS variables in both theme modes", () => {
    for (const color of ["neutral","warning","success","danger","comparison","comparison-alt"]) {
      const colors = [...css.matchAll(new RegExp("--admin-chart-" + color + ":\\s*(#[0-9a-fA-F]{6})", "g"))]
        .map(match => match[1]);
      expect(colors, "missing light/dark token: " + color).toHaveLength(2);
      expect(contrast(colors[0], "#ffffff"), "light: " + color).toBeGreaterThanOrEqual(3);
      expect(contrast(colors[1], "#121212"), "dark: " + color).toBeGreaterThanOrEqual(3);
    }
  });

  it("uses one color policy across both chart renderers, without legacy blue/orange hex values", () => {
    expect(insight).toContain("CHART_TONE_COLORS");
    expect(evidence).toContain("chartSeriesColor");
    expect(insight + evidence).not.toMatch(/#(?:478CE6|D6A32A|D94B4B|E4A238)/i);
  });

  it("supports a visible text legend and readable tooltips, not color alone", () => {
    for (const component of [insight,evidence]) {
      expect(component).toContain("aria-label");
      expect(component).toContain("Tooltip contentStyle={tooltipStyle}");
      expect(component).toContain("Legenda");
    }
  });
});
