import { beforeEach, describe, expect, it, vi } from "vitest";
const cookies = vi.hoisted(() => ({ get: vi.fn(), set: vi.fn(), header: vi.fn() }));
vi.mock("@tanstack/react-start/server", () => ({ getCookie: cookies.get, setCookie: cookies.set, setResponseHeader: cookies.header, getRequestProtocol: () => "https", getRequest: vi.fn() }));
import { anonymousGoogleSearchFetch, publicGoogleFetch, GOOGLE_PUBLIC_DAILY_LIMIT, type PublicRequestDependencies } from "./google-public-request.server";
const hash = "a".repeat(64);
const url = "https://places.googleapis.com/v1/places:autocomplete";
const deps = (): PublicRequestDependencies => ({ fetch: vi.fn(async () => new Response("{}")), consume: vi.fn(async () => "ALLOWED"), log: vi.fn(async () => undefined) });
beforeEach(() => vi.clearAllMocks());
describe("anonymous Google budget", () => {
  it("sets the chosen daily ceiling to 2000", () => expect(GOOGLE_PUBLIC_DAILY_LIMIT).toBe(2000));
  it.each(["DAILY_LIMIT", "SESSION_LIMIT", "UNAVAILABLE"])("never calls Google when gate returns %s", async status => {
    const d = deps(); vi.mocked(d.consume).mockResolvedValue(status);
    await expect(publicGoogleFetch(hash, "autocomplete", "public", d)(url)).rejects.toThrow();
    expect(d.fetch).not.toHaveBeenCalled();
  });
  it("counts retries as separate provider attempts", async () => {
    const d = deps(); vi.mocked(d.fetch).mockResolvedValueOnce(new Response("", { status: 503 })).mockResolvedValueOnce(new Response("{}"));
    await publicGoogleFetch(hash, "quote", "public", d)(url);
    expect(d.consume).toHaveBeenCalledTimes(2);
    expect(d.fetch).toHaveBeenCalledTimes(2);
  });
  it("stops the retry if the global budget is exhausted", async () => {
    const d = deps(); vi.mocked(d.consume).mockResolvedValueOnce("ALLOWED").mockResolvedValueOnce("DAILY_LIMIT");
    vi.mocked(d.fetch).mockResolvedValue(new Response("", { status: 503 }));
    await expect(publicGoogleFetch(hash, "quote", "public", d)(url)).rejects.toThrow("diário");
    expect(d.fetch).toHaveBeenCalledTimes(1);
  });
  it.each([403, 429])("does not retry %s", async status => {
    const d = deps(); vi.mocked(d.fetch).mockResolvedValue(new Response("{}", { status }));
    await expect(publicGoogleFetch(hash, "quote", "public", d)(url)).rejects.toThrow();
    expect(d.consume).toHaveBeenCalledTimes(1);
  });
  it("rejects arbitrary hosts and invalid session hashes before gate", async () => {
    const d = deps();
    await expect(publicGoogleFetch(hash, "quote", "public", d)("https://example.test")).rejects.toThrow("inválido");
    await expect(publicGoogleFetch("raw-session", "quote", "public", d)(url)).rejects.toThrow("inválida");
    expect(d.consume).not.toHaveBeenCalled();
  });
  it("issues an HttpOnly secure cookie and prevents shared response caching", async () => {
    cookies.get.mockReturnValue(undefined);
    expect(typeof await anonymousGoogleSearchFetch("details", "research")).toBe("function");
    expect(cookies.set).toHaveBeenCalledWith("caronaa_google_session", expect.stringMatching(/^[a-f0-9]{64}$/), expect.objectContaining({ httpOnly: true, secure: true, sameSite: "lax" }));
    expect(cookies.header).toHaveBeenCalledWith("Cache-Control", "no-store");
  });
  it("reuses an existing well-formed cookie", async () => {
    cookies.get.mockReturnValue(hash);
    await anonymousGoogleSearchFetch("autocomplete", "research");
    expect(cookies.set).not.toHaveBeenCalled();
  });
});