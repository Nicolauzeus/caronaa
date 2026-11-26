import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { runInNewContext } from "node:vm";
import { describe, expect, it, vi } from "vitest";

function loadWorker(windows: Array<{ url: string; focus: () => Promise<unknown>; navigate: (u: string) => Promise<unknown> }> = []) {
  const listeners: Record<string, (e: unknown) => void> = {};
  const showNotification = vi.fn(async () => {});
  const openWindow = vi.fn(async () => null);
  const self = {
    location: { origin: "https://caronaa.com" },
    addEventListener: (type: string, fn: (e: unknown) => void) => { listeners[type] = fn; },
    registration: { showNotification },
    clients: { matchAll: vi.fn(async () => windows), openWindow, claim: vi.fn() },
    skipWaiting: vi.fn(),
  };
  runInNewContext(readFileSync(resolve(__dirname, "../../public/sw.js"), "utf8"), { self, caches: {}, fetch, URL });
  return { listeners, showNotification, openWindow };
}

async function dispatch(fn: ((e: unknown) => void) | undefined, extra: Record<string, unknown>) {
  let pending: Promise<unknown> = Promise.resolve();
  fn?.({ ...extra, waitUntil: (p: Promise<unknown>) => { pending = p; } });
  await pending;
}

describe("service worker ride push", () => {
  it("shows a high-priority notification from the payload", async () => {
    const w = loadWorker();
    await dispatch(w.listeners.push, { data: { json: () => ({ title: "Nova corrida", body: "R$ 30,00", data: { url: "/disponibilidade-profissional", orderId: "o1" } }) } });
    const [title, opts] = w.showNotification.mock.calls[0] as unknown as [string, Record<string, unknown>];
    expect(title).toBe("Nova corrida");
    expect(opts).toMatchObject({ tag: "caronaa-ride-request", renotify: true, requireInteraction: true, vibrate: [400, 200, 400, 200, 800, 200, 800] });
    expect(opts.data).toEqual({ url: "https://caronaa.com/disponibilidade-profissional", orderId: "o1" });
  });

  it("uses the generic text for an empty push and refuses foreign links", async () => {
    const w = loadWorker();
    await dispatch(w.listeners.push, { data: null });
    expect((w.showNotification.mock.calls[0] as unknown as [string, { body: string }])[1].body).toBe("Nova corrida CARONAA! Toque para ver detalhes.");
    await dispatch(w.listeners.push, { data: { json: () => ({ data: { url: "https://evil.example/x" } }) } });
    expect((w.showNotification.mock.calls[1] as unknown as [string, { data: { url: string } }])[1].data.url).toBe("https://caronaa.com/home");
  });

  it("focuses an open window and navigates to the order", async () => {
    const client = { url: "https://caronaa.com/home", focus: vi.fn(async () => null), navigate: vi.fn(async () => null) };
    const w = loadWorker([client]);
    const close = vi.fn();
    await dispatch(w.listeners.notificationclick, { notification: { close, data: { url: "https://caronaa.com/x" } } });
    expect(close).toHaveBeenCalled();
    expect(client.focus).toHaveBeenCalled();
    expect(client.navigate).toHaveBeenCalledWith("https://caronaa.com/x");
    expect(w.openWindow).not.toHaveBeenCalled();
  });

  it("opens a new window when none is open", async () => {
    const w = loadWorker();
    await dispatch(w.listeners.notificationclick, { notification: { close: vi.fn(), data: {} } });
    expect(w.openWindow).toHaveBeenCalledWith("https://caronaa.com/home");
  });
});
