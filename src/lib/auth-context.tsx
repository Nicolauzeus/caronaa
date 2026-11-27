import type { User } from "@supabase/supabase-js";
import { onNativeAppResume } from "@/lib/native/capacitor-bridge";
import { mountNativeDriverNotifications, nativeDriverAuthChanged, revokeNativeDriverNotificationsBeforeSignOut, resumeNativeDriverNotifications } from "@/lib/native/driver-fcm-session";
import { useRouter } from "@tanstack/react-router";
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import {claimPendingParticipations,readPendingParticipations,clearPendingLaunchReceipts} from "@/lib/formulario/research-participation";
import { leaveAdminAppPreview } from "@/lib/admin/entry";

type AuthContextValue = {
  user: User | null;
  loading: boolean;
};

const AuthContext = createContext<AuthContextValue>({ user: null, loading: false });

export function AuthProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const lastIdentity=useRef<string|null>(null);

  useEffect(() => {
    let active = true;
    // Supabase emits INITIAL_SESSION from persistent storage. A transient
    // network error in getUser must never overwrite that restored identity.
    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      if (!active) return;
      // A network interruption must not masquerade as a deliberate sign-out.
      if (event === "SIGNED_OUT" && !navigator.onLine) return;
      if (!["INITIAL_SESSION","TOKEN_REFRESHED","SIGNED_IN","SIGNED_OUT","USER_UPDATED"].includes(event)) return;
      const identity=session?.user?.id??null;
      const identityChanged=lastIdentity.current!==identity;
      lastIdentity.current=identity;
      if (identityChanged) nativeDriverAuthChanged(identity);
      setUser(previous => {
        const next = session?.user ?? null;
        return previous?.id === next?.id ? (next ?? previous) : next;
      });
      setLoading(false);
      if (event === "SIGNED_IN" || event === "SIGNED_OUT") leaveAdminAppPreview();
      if (event === "SIGNED_OUT") clearPendingLaunchReceipts();
      if ((event === "SIGNED_IN" || event === "SIGNED_OUT") && identityChanged)
        void router.invalidate();
    });

    void supabase.auth.getSession().then(({ data, error }) => {
      if (!active) return;
      if (!error) setUser(previous => data.session?.user ?? previous);
      setLoading(false);
    }).catch(() => { if (active) setLoading(false); });

    let lastResume = 0;
    const resume = () => {
      if (!active || document.hidden || Date.now() - lastResume < 1500) return;
      lastResume = Date.now();
      void supabase.auth.getSession().then(({ data, error }) => {
        if (!active || error) return;
        // A temporarily unavailable auth endpoint is NOT a sign-out.
        if (data.session?.user) setUser(data.session.user);
        // Route invalidation on a normal reconnect can invoke auth redirects;
        // live screens are reconciled in place by caronaa:app-refresh.
      }).catch(() => {});
    };
    document.addEventListener("visibilitychange", resume);
    window.addEventListener("focus", resume);
    window.addEventListener("pageshow", resume);
    window.addEventListener("online", resume);
    // Android APK: resume restores the session in place; never signs out or prompts.
    const offNativeResume = onNativeAppResume(() => {
      resume();
      window.dispatchEvent(new Event("caronaa:app-refresh"));
    });
    return () => {
      offNativeResume();
      active = false;
      document.removeEventListener("visibilitychange", resume);
      window.removeEventListener("focus", resume);
      window.removeEventListener("pageshow", resume);
      window.removeEventListener("online", resume);
      listener.subscription.unsubscribe();
    };
  }, [router]);

  // The root owns the native push listener across all authenticated routes.
  // Mount only after the session is restored; no permission request on login.
  useEffect(() => {
    if (loading || !user?.id) return;
    return mountNativeDriverNotifications(user.id, route => {
      void router.navigate({ to: route }).then(() => {
        window.dispatchEvent(new Event("caronaa:app-refresh"));
      }).catch(() => undefined);
    });
  }, [loading, user?.id, router]);

  // Authenticated engagement: count unique accounts once per day/role, with
  // throttled presence signals. No GPS, user agent, IP or raw navigation data.
  useEffect(()=>{
    if(!user?.id||typeof window==="undefined")return;
    let alive=true;
    let lastSent=0;
    const mark=()=>{
      if(!alive||document.hidden||!navigator.onLine||window.location.pathname.startsWith("/admin")||Date.now()-lastSent<60_000)return;
      lastSent=Date.now();
      void (supabase as any).rpc("record_caronaa_app_access").then(
        ({error}:{error?:unknown})=>{if(error)lastSent=0;}
      ).catch(()=>{lastSent=0;});
    };
    mark();
    const onVisible=()=>mark();
    const timer=window.setInterval(mark,5*60_000);
    window.addEventListener("focus",onVisible);
    window.addEventListener("pageshow",onVisible);
    window.addEventListener("online",onVisible);
    document.addEventListener("visibilitychange",onVisible);
    return()=>{
      alive=false;window.clearInterval(timer);
      window.removeEventListener("focus",onVisible);
      window.removeEventListener("pageshow",onVisible);
      window.removeEventListener("online",onVisible);
      document.removeEventListener("visibilitychange",onVisible);
    };
  },[user?.id]);

  useEffect(()=>{
    if(!user?.id||!user.email_confirmed_at||readPendingParticipations().length===0)return;
    // Only claims for receipts explicitly opted into after submission.
    // The server verifies the authenticated email and binds to immutable form UUID.
    void claimPendingParticipations().then(() => router.invalidate()).catch(() => undefined);
    // A linked UNIFOR research participant must immediately enter the waiting
    // experience; this is not proof of university enrollment.
  },[user?.id,user?.email_confirmed_at]);

  return <AuthContext.Provider value={{ user, loading }}>{children}</AuthContext.Provider>;
}

/** All deliberate logout paths revoke native bindings while the JWT is valid.
 * Web/PWA remains the original Supabase logout. Never block logout indefinitely.
 */
export async function signOutWithNativeNotifications() {
  await revokeNativeDriverNotificationsBeforeSignOut().catch(() => undefined);
  try {
    const result = await supabase.auth.signOut();
    if (result.error) resumeNativeDriverNotifications();
    return result;
  } catch (error) {
    resumeNativeDriverNotifications();
    throw error;
  }
}

export function useAuth() {
  return useContext(AuthContext);
}
