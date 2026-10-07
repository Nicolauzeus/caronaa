import { supabase } from "@/integrations/supabase/client";
import {
  occurrenceDefinitionSchema,
  routineDefinitionSchema,
  routinesSchema,
  type RoutineDefinition,
  type RoutineOccurrence,
} from "./ride-routines";

async function unwrap<T>(result: PromiseLike<{ data: T; error: { message: string } | null }>) {
  const { data, error } = await result;
  if (error) throw new Error(error.message);
  return data;
}
export async function getRideRoutines() {
  return routinesSchema.parse(await unwrap(supabase.rpc("get_my_ride_routines")));
}
export async function saveRideRoutine(definition: RoutineDefinition, id?: string) {
  const data = routineDefinitionSchema.parse(definition);
  return unwrap(
    supabase.rpc("save_ride_routine", { p_definition: data, ...(id ? { p_routine_id: id } : {}) }),
  );
}
export async function setRideRoutineActive(id: string, active: boolean) {
  await unwrap(supabase.rpc("set_ride_routine_active", { p_routine_id: id, p_active: active }));
}
export async function changeRoutineOccurrence(
  kind: "offer" | "request",
  id: string,
  changes?: RoutineOccurrence,
) {
  await unwrap(
    supabase.rpc("change_ride_routine_occurrence", {
      p_kind: kind,
      p_id: id,
      p_cancel: !changes,
      ...(changes ? { p_changes: occurrenceDefinitionSchema.parse(changes) } : {}),
    }),
  );
}
