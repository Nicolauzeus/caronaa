import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type ActiveRole = "PASSAGEIRO" | "MOTORISTA";
export type VehicleMissingField = "brand" | "model" | "color" | "plate";
export type VehicleStatus = {
  hasBrand: boolean;
  hasModel: boolean;
  hasColor: boolean;
  hasPlate: boolean;
  isComplete: boolean;
};
export type SwitchRoleResult =
  | { needsVehicleModal: false; missingFields: [] }
  | { needsVehicleModal: true; missingFields: VehicleMissingField[] };

type ProfileVehicle = {
  vehicle_brand?: string | null;
  vehicle_description?: string | null;
  vehicle_plate?: string | null;
  // Optional for forward compatibility if the profile schema adds it later.
  vehicle_color?: string | null;
};

type RoleState = {
  activeRole: ActiveRole;
  isDriverEligible: boolean;
  vehicleStatus: VehicleStatus;
  loading: boolean;
  error: string | null;
};

function hasText(value: unknown): boolean {
  return typeof value === "string" && value.trim().length > 0;
}

function readVehicleStatus(profile: ProfileVehicle | null): VehicleStatus {
  const hasBrand = hasText(profile?.vehicle_brand);
  // The current CARONAA profile schema stores model in vehicle_description.
  const hasModel = hasText(profile?.vehicle_description);
  // vehicle_color is not currently a persisted profiles column. Do not infer it
  // from vehicle_description: that field is used as the vehicle model/description.
  const hasColor = hasText(profile?.vehicle_color);
  const hasPlate = hasText(profile?.vehicle_plate);
  return {
    hasBrand,
    hasModel,
    hasColor,
    hasPlate,
    isComplete: hasBrand && hasModel && hasColor && hasPlate,
  };
}

function isAuthorizedAccess(value: any): boolean {
  return value?.authorized === true ||
    value?.is_driver_eligible === true ||
    value?.eligible === true;
}

function roleFromRpc(value: unknown, fallback: ActiveRole): ActiveRole {
  const candidate = typeof value === "string"
    ? value
    : value && typeof value === "object"
      ? (value as Record<string, unknown>).active_role ??
        (value as Record<string, unknown>).activeRole ??
        (value as Record<string, unknown>).role
      : null;
  return candidate === "MOTORISTA" || candidate === "PASSAGEIRO"
    ? candidate
    : fallback;
}

export function useActiveRole() {
  const [state, setState] = useState<RoleState>({
    activeRole: "PASSAGEIRO",
    isDriverEligible: false,
    vehicleStatus: readVehicleStatus(null),
    loading: true,
    error: null,
  });

  useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        const { data: authData, error: authError } = await supabase.auth.getUser();
        if (authError) throw authError;
        const userId = authData.user?.id;
        if (!userId) {
          if (alive) setState(current => ({ ...current, loading: false }));
          return;
        }

        const [profileResult, accessResult] = await Promise.all([
          (supabase as any).from("profiles")
            .select("vehicle_brand,vehicle_description,vehicle_plate")
            .eq("id", userId)
            .maybeSingle(),
          (supabase as any).rpc("get_my_professional_access"),
        ]);
        if (profileResult.error) throw profileResult.error;
        if (accessResult.error) throw accessResult.error;
        if (!alive) return;

        const vehicleStatus = readVehicleStatus(profileResult.data as ProfileVehicle | null);
        setState(current => ({
          ...current,
          vehicleStatus,
          isDriverEligible: isAuthorizedAccess(accessResult.data),
          loading: false,
          error: null,
        }));
      } catch {
        if (alive) setState(current => ({
          ...current,
          loading: false,
          error: "Não foi possível carregar seu perfil e sua elegibilidade profissional.",
        }));
      }
    })();
    return () => { alive = false; };
  }, []);

  const switchRole = useCallback(async (targetRole: ActiveRole): Promise<SwitchRoleResult> => {
    if (targetRole === "PASSAGEIRO") {
      setState(current => ({ ...current, activeRole: "PASSAGEIRO", error: null }));
      try {
        const { error } = await (supabase as any).rpc("switch_user_active_role", {
          p_target_role: targetRole,
        });
        if (error) {
          setState(current => ({ ...current, error: "Não foi possível atualizar o modo ativo." }));
          throw error;
        }
      } catch (error) {
        throw error;
      }
      return { needsVehicleModal: false, missingFields: [] };
    }

    const missingFields: VehicleMissingField[] = [];
    const vehicle = state.vehicleStatus;
    if (!vehicle.hasBrand) missingFields.push("brand");
    if (!vehicle.hasModel) missingFields.push("model");
    if (!vehicle.hasColor) missingFields.push("color");
    if (!vehicle.hasPlate) missingFields.push("plate");

    if (!state.isDriverEligible && missingFields.length > 0) {
      return { needsVehicleModal: true, missingFields };
    }

    const { data, error } = await (supabase as any).rpc("switch_user_active_role", {
      p_target_role: targetRole,
    });
    if (error) {
      setState(current => ({ ...current, error: "Não foi possível ativar o modo motorista." }));
      throw error;
    }
    setState(current => ({
      ...current,
      activeRole: roleFromRpc(data, "MOTORISTA"),
      error: null,
    }));
    return { needsVehicleModal: false, missingFields: [] };
  }, [state.isDriverEligible, state.vehicleStatus]);

  return {
    ...state,
    switchRole,
  };
}
