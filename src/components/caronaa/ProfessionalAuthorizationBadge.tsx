import { useEffect, useState } from "react";
import { ShieldCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Displays an administrative authorization, not a documentary verification.
 * A fresh server RPC is the authority; no local profile flag grants this seal.
 */
export function ProfessionalAuthorizationBadge() {
  const [authorized, setAuthorized] = useState(false);

  useEffect(() => {
    let active = true;
    void (supabase as any).rpc("get_my_professional_access").then(
      ({ data, error }: { data?: { authorized?: boolean }; error?: unknown }) => {
        if (active) setAuthorized(!error && data?.authorized === true);
      },
      () => { if (active) setAuthorized(false); },
    );
    return () => { active = false; };
  }, []);

  if (!authorized) return null;

  return (
    <div className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-primary/40 bg-primary/10 px-3 py-1.5 text-xs font-semibold text-foreground"
         role="status" aria-label="Motorista autorizado pelo CARONAA">
      <ShieldCheck className="size-4 shrink-0 text-primary" aria-hidden="true" />
      <span>Motorista autorizado pelo CARONAA</span>
    </div>
  );
}
