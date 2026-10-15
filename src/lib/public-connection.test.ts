import { describe, expect, it } from "vitest";
import { publicConnectionDefines } from "../../config/public-connection";

describe("public connection build configuration", () => {
  it("provides the verified managed connection when deployment env is absent", () => {
    const defines = publicConnectionDefines({});
    expect(JSON.parse(defines["import.meta.env.VITE_SUPABASE_URL"])).toBe(
      "https://zlzopkitvfmydceylugq.supabase.co",
    );
    expect(JSON.parse(defines["import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY"])).toBe(
      "sb_publishable_FoGL9W_FEfyH9wlra9BGAQ_HMJLJImV",
    );
  });

  it("preserves a complete browser-facing deployment connection", () => {
    const defines = publicConnectionDefines({
      VITE_SUPABASE_URL: "https://browser.example.test",
      VITE_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_test",
    });
    expect(JSON.parse(defines["import.meta.env.VITE_SUPABASE_URL"])).toBe("https://browser.example.test");
    expect(JSON.parse(defines["import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY"])).toBe("sb_publishable_test");
  });

  it("does not mix an incomplete env pair or expose server bindings", () => {
    const baseline = publicConnectionDefines({});
    expect(publicConnectionDefines({
      VITE_SUPABASE_URL: "https://incomplete.example.test",
      SUPABASE_URL: "http://127.0.0.1:54321",
      SUPABASE_PUBLISHABLE_KEY: "server-only-binding",
      SUPABASE_SERVICE_ROLE_KEY: "private-test-sentinel",
    })).toEqual(baseline);
  });
});