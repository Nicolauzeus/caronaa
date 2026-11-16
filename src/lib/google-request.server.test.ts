import { describe, expect, it, vi } from "vitest";
import { authenticatedGoogleRequest, googleActionFetch, type GoogleRequestDependencies } from "./google-request.server";
import { GOOGLE_CACHE_TTL_MS, GOOGLE_REQUEST_LIMITS, GOOGLE_TIMEOUT_MS } from "./google-request-policy";

vi.mock("@tanstack/react-start/server", () => ({ getRequest: vi.fn() }));
const input = { url: "https://places.googleapis.com/v1/places:autocomplete", key: "test-only", userId: "test-user", caller: "test", operation: "autocomplete" as const, body: { input: "Redenção" } };
function dependencies(): GoogleRequestDependencies {
  return { fetch: vi.fn().mockResolvedValue(new Response("{}")), consume: vi.fn().mockResolvedValue(true), log: vi.fn().mockResolvedValue(undefined), defer: vi.fn() };
}
describe("Google request policy", () => {
  it("sets autocomplete to 30/min", () => expect(GOOGLE_REQUEST_LIMITS.autocomplete).toBe(30));
  it("sets quote to 10/min", () => expect(GOOGLE_REQUEST_LIMITS.quote).toBe(10));
  it("sets details to 20/min", () => expect(GOOGLE_REQUEST_LIMITS.details).toBe(20));
  it("sets searchText TTL to 30 days", () => expect(GOOGLE_CACHE_TTL_MS.places_search_text).toBe(2592000000));
  it("sets route TTL to 10 minutes", () => expect(GOOGLE_CACHE_TTL_MS.route_quote).toBe(600000));
  it("uses a 12-second timeout for authenticated Google requests", () => expect(GOOGLE_TIMEOUT_MS).toBe(12000));
  it("checks the database gate before sending a paid request", async () => {
    const d = dependencies(); vi.mocked(d.consume).mockResolvedValue(false);
    await expect(authenticatedGoogleRequest(input, d)).rejects.toThrow("Aguarde um minuto");
    expect(d.fetch).not.toHaveBeenCalled();
  });
  it("retries a 5xx once and consumes only one user action", async () => {
    const d = dependencies(); vi.mocked(d.fetch).mockResolvedValueOnce(new Response("", { status: 503 })).mockResolvedValueOnce(new Response("{}"));
    expect((await authenticatedGoogleRequest(input, d)).ok).toBe(true);
    expect(d.fetch).toHaveBeenCalledTimes(2); expect(d.consume).toHaveBeenCalledTimes(1);
    expect(d.log).toHaveBeenCalledTimes(2);
  });
  it("never loops when both attempts fail", async () => {
    const d = dependencies(); vi.mocked(d.fetch).mockImplementation(async () => new Response("", { status: 503 }));
    await expect(authenticatedGoogleRequest(input, d)).rejects.toThrow("503"); expect(d.fetch).toHaveBeenCalledTimes(2);
  });
  it.each([403, 429])("does not retry HTTP %s", async status => {
    const d = dependencies(); vi.mocked(d.fetch).mockResolvedValue(new Response("{}", { status }));
    await expect(authenticatedGoogleRequest(input, d)).rejects.toThrow(); expect(d.fetch).toHaveBeenCalledTimes(1);
  });
  it("classifies Google 403 referrer restrictions without leaking the key", async () => {
    const d = dependencies();
    vi.mocked(d.fetch).mockResolvedValue(new Response(JSON.stringify({
      error: { details: [{ reason: "API_KEY_HTTP_REFERRER_BLOCKED" }] },
    }), { status: 403, headers: { "content-type": "application/json" } }));
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    try {
      await expect(authenticatedGoogleRequest(input, d)).rejects.toThrow("restrita a websites");
      expect(spy).toHaveBeenCalledWith("[CARONAA][GOOGLE_REQUEST]", expect.objectContaining({
        code: "REFERRER_RESTRICTED", httpStatus: 403,
      }));
      expect(JSON.stringify(spy.mock.calls)).not.toContain("test-only");
    } finally { spy.mockRestore(); }
  });
  it("reports network failures with bounded diagnostics, not raw exception text", async () => {
    const d = dependencies();
    vi.mocked(d.fetch).mockRejectedValue(new TypeError("sensitive-host?apikey=private-data"));
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    try {
      await expect(authenticatedGoogleRequest(input, d)).rejects.toThrow("indisponível");
      expect(spy).toHaveBeenCalledWith("[CARONAA][GOOGLE_REQUEST]", expect.objectContaining({
        code: "NETWORK_ERROR", attempt: 1,
      }));
      expect(JSON.stringify(spy.mock.calls)).not.toContain("private-data");
      expect(d.log).toHaveBeenCalledWith(expect.objectContaining({ error_code: "NETWORK_ERROR" }));
    } finally { spy.mockRestore(); }
  });
  it("never retries a timeout", async () => {
    const d = dependencies(); vi.mocked(d.fetch).mockRejectedValue(new DOMException("timeout", "TimeoutError"));
    await expect(authenticatedGoogleRequest(input, d)).rejects.toThrow("demorou"); expect(d.fetch).toHaveBeenCalledTimes(1);
  });
  it("does not await a stalled log", async () => {
    const d = dependencies(); d.log = vi.fn(() => new Promise(() => undefined));
    expect((await authenticatedGoogleRequest(input, d)).ok).toBe(true);
  });
  it("swallows log rejection without changing the response", async () => {
    const d = dependencies(); vi.mocked(d.log).mockRejectedValue(new Error("log unavailable"));
    expect((await authenticatedGoogleRequest(input, d)).ok).toBe(true);
  });
  it("rejects external hosts before consuming a limit", async () => {
    const d = dependencies(); await expect(authenticatedGoogleRequest({ ...input, url: "https://example.org/" }, d)).rejects.toThrow("inválido"); expect(d.consume).not.toHaveBeenCalled();
  });
});
describe("authenticated multi-request actions", () => {
  const options = { method: "POST", headers: { "X-Goog-Api-Key": "test-only" }, body: JSON.stringify({ travelMode: "DRIVE" }) };
  const url = "https://routes.googleapis.com/directions/v2:computeRoutes";
  it("consumes one quote budget for six parallel legs, not six", async () => {
    const deps = dependencies();
    deps.fetch = vi.fn(async () => new Response("{}"));
    const request = googleActionFetch("verified-user", "quote", "group", deps);
    await Promise.all(Array.from({ length: 6 }, () => request(url, options)));
    expect(deps.consume).toHaveBeenCalledExactlyOnceWith("verified-user", "quote");
    expect(deps.fetch).toHaveBeenCalledTimes(6);
  });
  it("blocks all concurrent legs when the atomic gate denies the action", async () => {
    const deps = dependencies(); vi.mocked(deps.consume).mockResolvedValue(false);
    const request = googleActionFetch("verified-user", "quote", "group", deps);
    const results = await Promise.allSettled([request(url, options), request(url, options)]);
    expect(results.map(result => result.status)).toEqual(["rejected", "rejected"]);
    expect(deps.consume).toHaveBeenCalledTimes(1);
    expect(deps.fetch).not.toHaveBeenCalled();
  });
  it("never shares permission between separate actions", async () => {
    const deps = dependencies();
    await googleActionFetch("verified-user", "quote", "first", deps)(url, options);
    await googleActionFetch("verified-user", "quote", "second", deps)(url, options);
    expect(deps.consume).toHaveBeenCalledTimes(2);
  });
  it("bounds one action to 16 outbound requests", async () => {
    const deps = dependencies(); deps.fetch = vi.fn(async () => new Response("{}"));
    const request = googleActionFetch("verified-user", "quote", "bounded", deps);
    for (let i = 0; i < 16; i++) await request(url, options);
    await expect(request(url, options)).rejects.toThrow("demais");
    expect(deps.fetch).toHaveBeenCalledTimes(16);
  });
});