import type { Session } from "@supabase/supabase-js";
import { registerPlugin } from "@capacitor/core";
import { isNativeAndroid, isNativePluginAvailable } from "./capacitor-bridge";
import { professionalRadarConsentKey } from "@/lib/professional-radar-consent";

type Status = { running: boolean; state: string };
type Credential = { owner: string; accessToken: string; expiresAtMs: number };
interface LocationBridge {
  startForegroundTracking(args: Credential & { requestPermission: boolean }): Promise<Status>;
  updateForegroundTrackingSession(args: Credential): Promise<Status>;
  stopForegroundTracking(): Promise<Status>;
  foregroundTrackingStatus(): Promise<Status>;
}
const native = registerPlugin<LocationBridge>("CaronaaNative");
let owner: string | null = null;
let running = false;
let generation = 0;
let startPending: Promise<boolean> | null = null;
const supported = () => isNativeAndroid() && isNativePluginAvailable("CaronaaNative");
const consented = (id: string) => {
  try { return window.localStorage.getItem(professionalRadarConsentKey(id)) === "yes"; } catch { return false; }
};
const credential = (session: Session): Credential | null =>
  session.user.id && session.access_token && session.expires_at && session.expires_at * 1000 > Date.now() + 5000
    ? { owner: session.user.id, accessToken: session.access_token, expiresAtMs: session.expires_at * 1000 } : null;
async function bounded<T>(work: Promise<T>, ms = 15_000): Promise<T | null> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try { return await Promise.race([work, new Promise<null>(resolve => { timer = setTimeout(() => resolve(null), ms); })]); }
  catch { return null; }
  finally { if (timer !== undefined) clearTimeout(timer); }
}
/** True only when the native service owns background transmission. */
export function nativeOwnsBackgroundGps(): boolean {
  return supported() && running && typeof document !== "undefined" && document.hidden;
}
export function hasNativeForegroundTracking(): boolean { return supported() && running; }

/** Online activation was already committed by the caller. No presence mutation here. */
export function startNativeForegroundTracking(requestPermission = false): Promise<boolean> {
  if (!supported() || document.hidden) return Promise.resolve(false);
  if (startPending) return startPending;
  const epoch = generation;
  const run = (async () => {
    const { supabase } = await import("@/integrations/supabase/client");
    const auth = await bounded(supabase.auth.getSession(), 4000);
    const session = auth?.data.session;
    if (!session || auth?.error || epoch !== generation) return false;
    const id = session.user.id;
    if (requestPermission) {
      // The call is only made from an explicit successful online action.
      window.localStorage.setItem(professionalRadarConsentKey(id), "yes");
    }
    if (!consented(id)) return false;
    const args = credential(session);
    if (!args) return false;
    const checked = await bounded(Promise.all([
      supabase.from("profiles").select("active_role").eq("id", id).maybeSingle(),
      supabase.from("professional_presence").select("is_available").eq("user_id", id).maybeSingle(),
      supabase.rpc("get_my_professional_access"),
    ]), 5000);
    if (!checked || epoch !== generation || !consented(id) || document.hidden) return false;
    const [profile, presence, access] = checked;
    if (profile.error || presence.error || access.error) return false;
    const accessData = access.data as { authorized?: boolean } | null;
    if (profile.data?.active_role !== "MOTORISTA" || presence.data?.is_available !== true || accessData?.authorized !== true) {
      if (owner === id) await stopNativeForegroundTracking(false);
      return false;
    }
    const result = await bounded(native.startForegroundTracking({ ...args, requestPermission }), 45_000);
    if (epoch !== generation || !consented(id)) {
      // A delayed permission callback must not revive a stopped service.
      await bounded(native.stopForegroundTracking(), 1500);
      return false;
    }
    if (!result?.running) {
      running = false; owner = null;
      // If a native permission callback resolves after timeout, stop again.
      if (!result) void bounded(native.stopForegroundTracking(), 1500);
      return false;
    }
    owner = id; running = true;
    return true;
  })().catch(() => false);
  startPending = run;
  void run.finally(() => { if (startPending === run) startPending = null; });
  return run;
}
/** Call before deliberate logout/offline. Fence pending permission responses. */
export async function stopNativeForegroundTracking(clearConsent = false): Promise<void> {
  if (!supported()) return;
  const oldOwner = owner;
  generation++; running = false; owner = null;
  if (clearConsent && oldOwner) {
    try { window.localStorage.removeItem(professionalRadarConsentKey(oldOwner)); } catch { /* storage unavailable */ }
  }
  await bounded(native.stopForegroundTracking(), 1500);
}
/** No storage of bearer tokens or refresh tokens in the native code/bridge. */
export function syncNativeTrackingAuth(session: Session | null): void {
  if (!supported()) return;
  if (!session || (owner && owner !== session.user.id)) {
    void stopNativeForegroundTracking(true); return;
  }
  if (owner !== session.user.id || !running || !consented(owner)) return;
  const args = credential(session);
  if (args) void bounded(native.updateForegroundTrackingSession(args), 1500).then(result => {
    if (owner === args.owner && result?.running === false) { running = false; owner = null; }
  });
}
/** Root owns lifetime across routes. Existing consent only, no automatic permission prompt. */
export function mountNativeForegroundTracking(userId: string): () => void {
  if (!supported()) return () => {};
  let disposed = false;
  const resume = () => {
    if (disposed || document.hidden) return;
    if (!consented(userId)) { if (running) void stopNativeForegroundTracking(false); return; }
    void startNativeForegroundTracking(false);
  };
  const roleChanged = () => {
    // A role transition is not a new consent to share location.
    try { window.localStorage.removeItem(professionalRadarConsentKey(userId)); } catch { /* unavailable */ }
    void stopNativeForegroundTracking(false);
  };
  const storage = (event: StorageEvent) => {
    if (event.key === professionalRadarConsentKey(userId) && event.newValue !== "yes") void stopNativeForegroundTracking(false);
  };
  window.addEventListener("caronaa:app-refresh", resume);
  window.addEventListener("online", resume);
  window.addEventListener("caronaa:role-changed", roleChanged);
  window.addEventListener("storage", storage);
  resume();
  return () => {
    disposed = true;
    window.removeEventListener("caronaa:app-refresh", resume);
    window.removeEventListener("online", resume);
    window.removeEventListener("caronaa:role-changed", roleChanged);
    window.removeEventListener("storage", storage);
    // Navigation is not logout. The auth-state fence stops cross-account tracking.
  };
}
