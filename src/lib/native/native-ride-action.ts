import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { supabase } from "@/integrations/supabase/client";
import { respondFlashOrder } from "@/services/flash-driver-service";
import { toast } from "sonner";

type Pending = { rideId?: string; ownerHash?: string; expiresAtMs?: number; action?: string };
type Context = { live: () => boolean; role: () => Promise<string | null>; open: () => void };

export async function rideActionOwnerHash(owner: string): Promise<string> {
  return Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(owner))),
    b => b.toString(16).padStart(2,"0")).join("");
}
export function validNativeRideAction(p: Pending, now = Date.now()): boolean {
  return (p.action === "accept" || p.action === "open") &&
    typeof p.rideId === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(p.rideId) &&
    typeof p.ownerHash === "string" && /^[0-9a-f]{64}$/.test(p.ownerHash) &&
    typeof p.expiresAtMs === "number" && Number.isSafeInteger(p.expiresAtMs) &&
    p.expiresAtMs > now && p.expiresAtMs <= now + 300_000;
}

/** Only a private native Activity can enqueue the action. A plain notification tap
 * only navigates. Accept uses the SAME authenticated atomic RPC as the cockpit.
 * Capture the intended account's access token, not a potentially switched session. */
export async function handleNativeRideAction(p: Pending, owner: string, ctx: Context): Promise<void> {
  if (!validNativeRideAction(p) || !ctx.live() || await rideActionOwnerHash(owner) !== p.ownerHash) return;
  if (await ctx.role() !== "MOTORISTA" || !ctx.live() || !validNativeRideAction(p)) return;
  ctx.open();
  if (p.action !== "accept") return;
  try {
    const { data, error } = await supabase.auth.getSession();
    const session = data.session;
    if (error || !session || session.user.id !== owner || !ctx.live() || !validNativeRideAction(p)) return;
    const url = import.meta.env.VITE_SUPABASE_URL;
    const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
    if (!url || !key) throw new Error("Missing public client config");
    // No token is written to disk, logged, or passed to Android.
    const client = createClient<Database>(url, key, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
      accessToken: async () => session.access_token,
    });
    if (!ctx.live() || !validNativeRideAction(p)) return;
    await respondFlashOrder(p.rideId!, true, client);
    if (ctx.live()) {
      toast.success("Corrida aceita. A caminho do embarque.");
      window.dispatchEvent(new Event("caronaa:app-refresh"));
    }
  } catch {
    if (ctx.live()) {
      toast.error("Não foi possível aceitar. Confira a corrida e sua disponibilidade no aplicativo.");
      window.dispatchEvent(new Event("caronaa:app-refresh"));
    }
  }
}
