import { describe, expect, it } from "vitest";
import { resolveGoogleMapsBrowserKey } from "./google-maps-key";
describe("ordered public Google browser key", () => {
  it("tries both server variables before the two public Vite bindings", () => {
    const server = {
      GOOGLE_MAPS_BROWSER_API_KEY: " browser ",
      GOOGLE_MAPS_API_KEY: "server",
    };
    const vite = {
      VITE_GOOGLE_MAPS_BROWSER_API_KEY: "vite-browser",
      VITE_GOOGLE_MAPS_API_KEY: "vite",
    };
    expect(resolveGoogleMapsBrowserKey(server, vite)).toBe("browser");
    expect(
      resolveGoogleMapsBrowserKey(
        { ...server, GOOGLE_MAPS_BROWSER_API_KEY: " " },
        vite,
      ),
    ).toBe("server");
    expect(resolveGoogleMapsBrowserKey({}, vite)).toBe("vite-browser");
    expect(
      resolveGoogleMapsBrowserKey(
        {},
        { ...vite, VITE_GOOGLE_MAPS_BROWSER_API_KEY: "" },
      ),
    ).toBe("vite");
    expect(resolveGoogleMapsBrowserKey()).toBe("");
  });
});
