import { supabase } from "@/integrations/supabase/client";
import { hasNativeFirebaseConfig, isNativeAndroid, isNativePluginAvailable } from "./capacitor-bridge";
import type { PluginListenerHandle } from "@capacitor/core";

type Route = "/home" | "/disponibilidade-profissional";
type RecordEntry = { owner: string; token: string };
type Session = {
  owner: string;
  open: (route: Route) => void;
  stopped: boolean;
  paused: boolean;
  driver: boolean;
  token: string | null;
  saved: string | null;
  savedAt: number;
  refreshing: Promise<boolean> | null;
  attaching: Promise<boolean> | null;
  handles: PluginListenerHandle[];
  resolveRegistration: ((ok: boolean) => void) | null;
};
const STORAGE_KEY = "caronaa:native-fcm-device-bindings:v1";
const RPC_TIMEOUT = 3500;
const REFRESH_MS = 60_000;
const RESAVE_MS = 15 * 60_000;
let session: Session | null = null;
let queue: Promise<unknown> = Promise.resolve();
let resetTask: Promise<boolean> | null = null;
let ledger: RecordEntry[] | null = null;

function validToken(token: unknown): token is string {
  return typeof token === "string" && token.length > 0 && token.length <= 4096 &&
    !/[\s\x00-\x1f\x7f]/.test(token);
}
function records(): RecordEntry[] {
  if (ledger) return ledger;
  try {
    const data: unknown = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || "[]");
    ledger = Array.isArray(data) ? data.filter((v): v is RecordEntry =>
      v && typeof v.owner === "string" && validToken(v.token)) : [];
  } catch { ledger = []; }
  return ledger;
}
// Persist only the minimum device binding needed to revoke it after reload.
// No JWT, profile fields, location or notification payload is stored here.
function writeRecords(next: RecordEntry[]): boolean {
  ledger = next;
  try {
    if (next.length) window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    else window.localStorage.removeItem(STORAGE_KEY);
    return true;
  } catch { return false; }
}
function remember(owner: string, token: string): boolean {
  const entries = records();
  if (entries.some(e => e.token === token && e.owner !== owner)) return false;
  const next = entries.some(e => e.owner === owner && e.token === token)
    ? entries : [...entries, { owner, token }];
  // Do not grow an unbounded list or silently discard a possibly registered token.
  return next.length <= 32 && writeRecords(next);
}
function forget(owner: string, token: string) {
  writeRecords(records().filter(e => e.owner !== owner || e.token !== token));
}
function live(s: Session): boolean { return session === s && !s.stopped && !s.paused; }
function online(): boolean { return typeof navigator !== "undefined" && navigator.onLine !== false; }
function serialized<T>(fn: () => Promise<T>): Promise<T> {
  const next = queue.then(fn, fn);
  queue = next.catch(() => undefined);
  return next;
}
// Fail closed on slow/missing connectivity; abort PostgREST requests when possible.
async function bounded<T>(work: (signal: AbortSignal) => PromiseLike<T>, ms = RPC_TIMEOUT): Promise<T | null> {
  const abort = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      Promise.resolve(work(abort.signal)),
      new Promise<null>(resolve => { timer = setTimeout(() => { abort.abort(); resolve(null); }, ms); }),
    ]);
  } catch { return null; }
  finally { if (timer !== undefined) clearTimeout(timer); }
}
async function ownsSession(owner: string): Promise<boolean> {
  if (!online()) return false;
  const result = await bounded(() => supabase.auth.getSession());
  return !result?.error && result?.data.session?.user.id === owner;
}
async function currentRole(s: Session): Promise<"MOTORISTA" | "PASSAGEIRO" | null> {
  if (!live(s) || !(await ownsSession(s.owner)) || !live(s)) return null;
  const result = await bounded(signal => supabase.from("profiles").select("active_role")
    .eq("id", s.owner).abortSignal(signal).maybeSingle());
  if (!live(s) || !result || result.error) return null;
  const role = result.data?.active_role;
  return role === "MOTORISTA" || role === "PASSAGEIRO" ? role : null;
}
async function deviceInfo(): Promise<string> {
  const info: Record<string, string> = { platform: "android" };
  if (isNativePluginAvailable("App")) {
    const app = await bounded(async () => (await import("@capacitor/app")).App.getInfo(), 1200);
    if (app?.version) info.version = app.version.slice(0, 40);
    if (app?.build) info.build = app.build.slice(0, 40);
  }
  // Older APKs do not expose a Device plugin. Include the model only when the
  // Android WebView actually supplies a model (not a fabricated device ID).
  const ua = typeof navigator === "undefined" ? "" : navigator.userAgent;
  const model = /Android [^;]+;\s*([^;()]+?)\s+Build\//i.exec(ua)?.[1]?.trim();
  if (model && model !== "K") info.model = model.slice(0, 80);
  return JSON.stringify(info);
}
async function deleteOwned(owner: string, except?: string): Promise<void> {
  if (!(await ownsSession(owner))) return;
  const targets = records().filter(e => e.owner === owner && e.token !== except);
  await Promise.all(targets.map(async entry => {
    // Do not use another account to revoke the previous account's binding.
    if (!(await ownsSession(owner))) return;
    const result = await bounded(signal => supabase.rpc("delete_driver_fcm_token", {
      p_token: entry.token,
    }).abortSignal(signal));
    if (result && !result.error) forget(owner, entry.token);
  }));
}
async function resetNativeToken(): Promise<boolean> {
  if (resetTask) return resetTask;
  const task = (async () => {
    if (!isNativePluginAvailable("PushNotifications") || !(await hasNativeFirebaseConfig())) return false;
    try {
      const { PushNotifications } = await import("@capacitor/push-notifications");
      // Invalidate the Firebase token as a second safeguard (e.g. expired session).
      // A failed/offline deletion remains in the owner-scoped local ledger.
      const result = await bounded(async () => { await PushNotifications.unregister(); return true; });
      void PushNotifications.removeAllDeliveredNotifications().catch(() => undefined);
      return result === true;
    } catch { return false; }
  })();
  resetTask = task;
  void task.finally(() => { if (resetTask === task) resetTask = null; });
  return task;
}
function stopListening(s: Session) {
  s.stopped = true;
  s.driver = false;
  s.resolveRegistration?.(false);
  s.resolveRegistration = null;
  for (const handle of s.handles.splice(0)) void handle.remove().catch(() => undefined);
}
async function persist(s: Session, token: string): Promise<boolean> {
  return serialized(async () => {
    if (!live(s) || !s.driver || s.token !== token || !online()) return false;
    // Recheck the authenticated database role at every new/rotated token.
    if (await currentRole(s) !== "MOTORISTA" || !live(s) || s.token !== token) return false;
    if (records().some(e => e.token === token && e.owner !== s.owner)) {
      // The previous account could not revoke this same token. Never rebind it
      // blindly across accounts. Ask Firebase for a fresh token on a later retry.
      s.token = null; s.saved = null;
      void resetNativeToken();
      return false;
    }
    if (s.saved === token && Date.now() - s.savedAt < RESAVE_MS) return true;
    const details = await deviceInfo();
    if (!live(s) || !s.driver || s.token !== token || !(await ownsSession(s.owner)) || !live(s)) return false;
    // Record before sending: even a timed-out request might have reached the DB.
    if (!remember(s.owner, token)) return false;
    const result = await bounded(signal => supabase.rpc("save_driver_fcm_token", {
      p_token: token, p_platform: "android", p_device_info: details,
    }).abortSignal(signal));
    if (!result || result.error || !live(s) || !s.driver || s.token !== token) return false;
    s.saved = token; s.savedAt = Date.now();
    // Retire older tokens from this device only; don't touch other devices.
    await deleteOwned(s.owner, token);
    return live(s);
  }).catch(() => false);
}
function notificationRoute(data: unknown): Route {
  if (data && typeof data === "object" && "route" in data && data.route === "/home") return "/home";
  return "/disponibilidade-profissional";
}
async function attach(s: Session): Promise<boolean> {
  if (s.attaching) return s.attaching;
  s.attaching = (async () => {
    if (!isNativePluginAvailable("PushNotifications") || !(await hasNativeFirebaseConfig()) || !live(s)) return false;
    const { PushNotifications } = await import("@capacitor/push-notifications");
    const add = async (promise: Promise<PluginListenerHandle>) => {
      const handle = await promise;
      if (!live(s)) { await handle.remove(); return false; }
      s.handles.push(handle); return true;
    };
    try {
      if (!await add(PushNotifications.addListener("registration", token => {
        if (!live(s) || !s.driver || !validToken(token.value)) return;
        s.token = token.value;
        void persist(s, token.value).then(ok => s.resolveRegistration?.(ok));
      }))) return false;
      if (!await add(PushNotifications.addListener("registrationError", () => {
        // Never log plugin errors: they can include registration identifiers.
        s.resolveRegistration?.(false);
      }))) return false;
      if (!await add(PushNotifications.addListener("pushNotificationActionPerformed", action => {
        if (action.actionId !== "tap" || !live(s) || !s.driver) return;
        void currentRole(s).then(role => {
          if (role !== "MOTORISTA" || !live(s) || !s.driver) return;
          // No arbitrary URLs, IDs, automatic acceptance or privileged actions.
          s.open(notificationRoute(action.notification.data));
        }).catch(() => undefined);
      }))) return false;
      return true;
    } catch {
      for (const handle of s.handles.splice(0)) void handle.remove().catch(() => undefined);
      return false;
    }
  })().catch(() => false);
  const result = await s.attaching;
  if (!result) s.attaching = null;
  return result;
}
async function revokeRoleBinding(s: Session): Promise<void> {
  s.driver = false;
  s.token = null; s.saved = null;
  s.resolveRegistration?.(false);
  if (!records().some(e => e.owner === s.owner)) return;
  await serialized(() => deleteOwned(s.owner));
  if (live(s)) await resetNativeToken();
}
async function refresh(s: Session): Promise<boolean> {
  if (!live(s) || !online()) return false;
  if (s.refreshing) return s.refreshing;
  const run = (async () => {
    const role = await currentRole(s);
    if (role === "PASSAGEIRO") { await revokeRoleBinding(s); return false; }
    if (role !== "MOTORISTA" || !live(s)) return false;
    // Never silently ask for permission on login/resume.
    if (!isNativePluginAvailable("LocalNotifications")) return false;
    const allowed = await bounded(async () => {
      const { LocalNotifications } = await import("@capacitor/local-notifications");
      return (await LocalNotifications.checkPermissions()).display === "granted";
    });
    if (!live(s)) return false;
    if (allowed === false) { await revokeRoleBinding(s); return false; }
    if (!allowed) return false;
    if (resetTask && !(await resetTask)) return false;
    if (!live(s)) return false;
    s.driver = true;
    if (!await attach(s) || !live(s)) return false;
    if (s.token) return persist(s, s.token);
    const { PushNotifications } = await import("@capacitor/push-notifications");
    const result = await bounded(async () => {
      const registered = new Promise<boolean>(resolve => { s.resolveRegistration = resolve; });
      await PushNotifications.register();
      return registered;
    }, 6000);
    s.resolveRegistration = null;
    return result === true && live(s);
  })().catch(() => false);
  s.refreshing = run;
  void run.finally(() => { if (s.refreshing === run) s.refreshing = null; });
  return run;
}

/** Called once by AuthProvider for an authenticated identity, never by a web page. */
export function mountNativeDriverNotifications(owner: string, open: (route: Route) => void): () => void {
  if (!isNativeAndroid()) return () => {};
  if (session) stopListening(session);
  const s: Session = { owner, open, stopped: false, paused: false, driver: false,
    token: null, saved: null, savedAt: 0, refreshing: null, attaching: null,
    handles: [], resolveRegistration: null };
  session = s;
  const retry = () => { void refresh(s); };
  const roleChanged = () => { s.driver = false; void (s.refreshing ?? Promise.resolve()).then(retry); };
  window.addEventListener("online", retry);
  window.addEventListener("caronaa:app-refresh", retry);
  window.addEventListener("caronaa:role-changed", roleChanged);
  const timer = window.setInterval(retry, REFRESH_MS);
  retry();
  return () => {
    window.removeEventListener("online", retry);
    window.removeEventListener("caronaa:app-refresh", retry);
    window.removeEventListener("caronaa:role-changed", roleChanged);
    window.clearInterval(timer);
    stopListening(s);
    if (session === s) session = null;
  };
}
/** Only reports registration after the RPC has actually succeeded. */
export async function registerNativeDriverPush(): Promise<boolean> {
  const s = session;
  if (!s || !isNativeAndroid()) return false;
  // UI can continue while the session worker retries a failed/offline registration.
  return (await bounded(() => refresh(s), 2500)) === true;
}
/** Immediately fence stale callbacks when Supabase changes authenticated identity.
 * An already-lost session cannot authorize an RPC; try native token invalidation.
 */
export function nativeDriverAuthChanged(nextOwner: string | null): void {
  if (!isNativeAndroid() || !session || session.owner === nextOwner) return;
  const old = session;
  stopListening(old);
  session = null;
  if (old.token || records().some(e => e.owner === old.owner)) void resetNativeToken();
}
/** Explicit logout must call this BEFORE Supabase signOut. Bounded, best-effort. */
export async function revokeNativeDriverNotificationsBeforeSignOut(): Promise<void> {
  if (!isNativeAndroid()) return;
  const s = session;
  if (!s) return;
  s.paused = true; s.driver = false;
  s.resolveRegistration?.(false);
  const hasBinding = !!s.token || records().some(e => e.owner === s.owner);
  s.token = null; s.saved = null;
  if (!hasBinding) return;
  // Serial ordering puts deletion after any in-flight save. It also prevents a
  // late completion from re-registering the token during logout.
  await bounded(() => serialized(() => deleteOwned(s.owner)), 4500);
  await resetNativeToken();
}
/** If signOut failed, the same authenticated session can resume registration. */
export function resumeNativeDriverNotifications(): void {
  if (!session || !isNativeAndroid()) return;
  session.paused = false;
  const s = session;
  void (s.refreshing ?? Promise.resolve()).then(() => refresh(s));
}
export function __resetFcmSessionForTests(): void {
  if (session) stopListening(session);
  session = null; ledger = null; queue = Promise.resolve(); resetTask = null;
}
