import type { User } from "@supabase/supabase-js";
import { useRouter } from "@tanstack/react-router";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
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

  useEffect(() => {
    let active = true;
    // Supabase emits INITIAL_SESSION from persistent storage. A transient
    // network error in getUser must never overwrite that restored identity.
    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      if (!active) return;
      // A network interruption must not masquerade as a deliberate sign-out.
      if (event === "SIGNED_OUT" && !navigator.onLine) return;
      if (!["INITIAL_SESSION","TOKEN_REFRESHED","SIGNED_IN","SIGNED_OUT","USER_UPDATED"].includes(event)) return;
      setUser(previous => {
        const next = session?.user ?? null;
        return previous?.id === next?.id ? (next ?? previous) : next;
      });
      setLoading(false);
      if (event === "SIGNED_IN" || event === "SIGNED_OUT") leaveAdminAppPreview();
      if (event === "SIGNED_OUT") clearPendingLaunchReceipts();
      if (event === "SIGNED_IN" || event === "SIGNED_OUT") void router.invalidate();
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
    return () => {
      active = false;
      document.removeEventListener("visibilitychange", resume);
      window.removeEventListener("focus", resume);
      window.removeEventListener("pageshow", resume);
      window.removeEventListener("online", resume);
      listener.subscription.unsubscribe();
    };
  }, [router]);

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

export function useAuth() {
  return useContext(AuthContext);
}
