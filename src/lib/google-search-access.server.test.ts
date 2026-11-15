import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ request: vi.fn(), claims: vi.fn(), action: vi.fn() }));
vi.mock("@tanstack/react-start/server", () => ({ getRequest: mocks.request }));
vi.mock("@supabase/supabase-js", () => ({ createClient: () => ({ auth: { getClaims: mocks.claims } }) }));
vi.mock("./google-request.server", () => ({ googleActionFetch: mocks.action }));
import { optionalGoogleSearchFetch } from "./google-search-access.server";
beforeEach(() => { vi.clearAllMocks(); });
describe("public search optional authentication", () => {
  it("preserves anonymous research access without inventing an identity", async () => {
    mocks.request.mockReturnValue(new Request("https://caronaa.com"));
    expect(await optionalGoogleSearchFetch("autocomplete", "research")).toBeUndefined();
    expect(mocks.claims).not.toHaveBeenCalled();
    expect(mocks.action).not.toHaveBeenCalled();
  });
  it("never downgrades malformed authorization to anonymous calls", async () => {
    mocks.request.mockReturnValue(new Request("https://caronaa.com", { headers: { authorization: "invalid" } }));
    await expect(optionalGoogleSearchFetch("quote", "map")).rejects.toThrow("Sessão inválida");
    expect(mocks.action).not.toHaveBeenCalled();
  });
  it("uses verified claims, not a client supplied identity", async () => {
    vi.stubEnv("SUPABASE_URL", "https://example.test"); vi.stubEnv("SUPABASE_PUBLISHABLE_KEY", "sb_publishable_test");
    mocks.request.mockReturnValue(new Request("https://caronaa.com", { headers: { authorization: "Bearer test-only" } }));
    mocks.claims.mockResolvedValue({ data: { claims: { sub: "verified-user" } }, error: null });
    await optionalGoogleSearchFetch("quote", "map");
    expect(mocks.action).toHaveBeenCalledWith("verified-user", "quote", "map");
    vi.unstubAllEnvs();
  });
  it("rejects an expired token rather than falling back to the public path", async () => {
    vi.stubEnv("SUPABASE_URL", "https://example.test"); vi.stubEnv("SUPABASE_PUBLISHABLE_KEY", "sb_publishable_test");
    mocks.request.mockReturnValue(new Request("https://caronaa.com", { headers: { authorization: "Bearer test-only" } }));
    mocks.claims.mockResolvedValue({ data: null, error: { code: "expired" } });
    await expect(optionalGoogleSearchFetch("details", "search")).rejects.toThrow("Sessão expirada");
    expect(mocks.action).not.toHaveBeenCalled();
    vi.unstubAllEnvs();
  });
});