import { describe, expect, it, vi } from "vitest";
import { authenticatedGoogleRequest, type GoogleRequestDependencies } from "./google-request.server";
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
  it("sets timeout to 5 seconds", () => expect(GOOGLE_TIMEOUT_MS).toBe(5000));
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
  it("never retries a timeout", async () => {
    const d = dependencies(); vi.mocked(d.fetch).mockRejectedValue(new DOMException("timeout", "TimeoutError"));
    await expect(authenticatedGoogleRequest(input, d)).rejects.toThrow("indisponível"); expect(d.fetch).toHaveBeenCalledTimes(1);
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