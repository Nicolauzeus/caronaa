import { describe, expect, it } from "vitest";
import { resolveGoogleMapsBrowserKey } from "./google-maps-key";
describe("ordered public Google browser key", () => {
  it("uses only the dedicated browser bindings, never a private server key", () => {
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
    ).toBe("vite-browser");
    expect(resolveGoogleMapsBrowserKey({}, vite)).toBe("vite-browser");
    expect(
      resolveGoogleMapsBrowserKey(
        {},
        { ...vite, VITE_GOOGLE_MAPS_BROWSER_API_KEY: "" },
      ),
    ).toBe("");
    expect(resolveGoogleMapsBrowserKey({ GOOGLE_MAPS_API_KEY: "private-test" })).toBe("");
    expect(resolveGoogleMapsBrowserKey()).toBe("");
  });
});
