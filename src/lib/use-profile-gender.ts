import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
export type ProfileGender = "FEMININO" | "MASCULINO" | null;

// Eligibility comes from profiles, never from auth metadata. Fail closed while loading.
export function useProfileGender(): ProfileGender {
  const { user } = useAuth();
  const [profile, setProfile] = useState<{ userId: string; gender: ProfileGender } | null>(null);
  useEffect(() => {
    let active = true;
    setProfile(null);
    if (user) {
      void supabase
        .from("profiles")
        .select("gender")
        .eq("id", user.id)
        .maybeSingle()
        .then(
          ({ data, error }) => {
            if (active)
              setProfile({
                userId: user.id,
                gender:
                  !error && (data?.gender === "FEMININO" || data?.gender === "MASCULINO")
                    ? data.gender
                    : null,
              });
          },
          () => {
            if (active) setProfile(null);
          },
        );
    }
    return () => {
      active = false;
    };
  }, [user?.id]);
  return user && profile?.userId === user.id ? profile.gender : null;
}
