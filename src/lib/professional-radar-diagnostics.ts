/**
 * Safe F07 GPS diagnostics shared between the browser and the authenticated
 * server. Do not include GPS coordinates, user IDs, emails, tokens or raw
 * PostgREST error messages in user-visible logs.
 */
export type F07RadarDiagnosticCode =
  | "ACCESS_RPC_ERROR" | "ACCESS_NOT_AUTHORIZED"
  | "FEES_RPC_ERROR" | "FEES_BLOCKED"
  | "PRESENCE_RPC_ERROR" | "DRIVER_OFFLINE"
  | "RATE_GATE_UNAVAILABLE" | "RATE_LIMITED"
  | "GOOGLE_REVERSE_FAILED" | "GPS_CITY_UNKNOWN"
  | "REGION_RPC_ERROR" | "REGION_DISABLED"
  | "DB_FUNCTION_MISSING" | "DB_PERMISSION_DENIED"
  | "DB_DRIVER_NOT_APPROVED" | "DB_FINANCIAL_BLOCK"
  | "DB_DRIVER_OFFLINE" | "DB_REGION_DISABLED"
  | "DB_LOCATION_INVALID" | "DB_SCHEMA_MISMATCH" | "DB_CONSTRAINT_FAILED" | "DB_WRITE_FAILED"
  | "DB_WRITE_FALSE" | "LOCATION_CLEAR_FAILED"
  | "NETWORK_OR_SERVER_ERROR" | "GPS_PERMISSION_DENIED"
  | "GPS_TIMEOUT" | "GPS_UNAVAILABLE" | "GPS_INVALID_FIX"
  | "GPS_STALE_SAMPLE" | "GPS_LOW_ACCURACY" | "GPS_IMPLAUSIBLE_JUMP";

export type SafeF07RadarEvent = {
  at: string;
  stage: string;
  code?: string;
  ref?: string;
  city?: string;
  accuracy?: string;
  authorized?: boolean;
  presenceOnline?: boolean;
  feesAllowed?: boolean;
};

type PostgrestLike = { code?: unknown; message?: unknown };
/** Never return or log arbitrary SQL error messages. */
export function classifyF07RadarDbError(error: PostgrestLike | null | undefined):
  F07RadarDiagnosticCode {
  const sqlState = typeof error?.code === "string" ? error.code : "";
  const message = typeof error?.message === "string" ? error.message.toLowerCase() : "";
  if (sqlState === "42883" || sqlState === "PGRST202" ||
      message.includes("could not find the function") ||
      message.includes("function public.publish_verified_professional_position") &&
        message.includes("does not exist")) return "DB_FUNCTION_MISSING";
  if (message.includes("gps_stale_sample") ||
      message.includes("gps_older_than_last_sample")) return "GPS_STALE_SAMPLE";
  if (message.includes("gps_implausible_jump")) return "GPS_IMPLAUSIBLE_JUMP";
  if (message.includes("gps_invalid_fix")) return "GPS_INVALID_FIX";
  if (message.includes("municipality_not_enabled")) return "DB_REGION_DISABLED";
  if (message.includes("driver_not_authorized")) return "DB_DRIVER_NOT_APPROVED";
  if (message.includes("driver_offline")) return "DB_DRIVER_OFFLINE";
  if (message.includes("municipio ainda nao habilitado") ||
      message.includes("município ainda não habilitado")) return "DB_REGION_DISABLED";
  if (message.includes("motorista esta offline") ||
      message.includes("motorista está offline")) return "DB_DRIVER_OFFLINE";
  if (message.includes("posicao gps invalida") ||
      message.includes("posição gps inválida")) return "DB_LOCATION_INVALID";
  if (message.includes("motorista nao autorizado ou bloqueado") ||
      message.includes("motorista não autorizado ou bloqueado")) {
    // SQL groups authorization and fees. The server preflight further
    // distinguishes whether the authorization row really is approved.
    return "DB_DRIVER_NOT_APPROVED";
  }
  // Migration/schema drift and integrity constraints are distinct from generic write errors.
  if (["42703", "42P01", "42804"].includes(sqlState)) return "DB_SCHEMA_MISMATCH";
  if (["23502", "23503", "23505", "23514"].includes(sqlState)) return "DB_CONSTRAINT_FAILED";
  if (message.includes("piloto f07 expirado")) return "DB_DRIVER_NOT_APPROVED";
  if (sqlState === "42501" || sqlState === "PGRST301" ||
      message.includes("permission denied") || message.includes("insufficient privilege")) {
    return "DB_PERMISSION_DENIED";
  }
  return "DB_WRITE_FAILED";
}

export function f07RadarAccuracyBand(accuracy: number): string {
  if (!Number.isFinite(accuracy) || accuracy < 0) return "invalid";
  if (accuracy <= 20) return "0-20m";
  if (accuracy <= 100) return "21-100m";
  if (accuracy <= 1000) return "101-1000m";
  return ">1000m";
}

/** Only a diagnostic code is extracted; never copy arbitrary exception text. */
export function f07RadarFailureCode(error: unknown): string {
  const message = error instanceof Error ? error.message : "";
  const match = message.match(/\[F07:([A-Z_]+)\]/);
  return match?.[1] ?? "NETWORK_OR_SERVER_ERROR";
}

export function f07RadarTraceId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID().slice(0, 8);
  }
  return "f07" + Math.random().toString(36).slice(2, 10);
}

export function f07RadarEvent(stage: string,
  details: Omit<Partial<SafeF07RadarEvent>, "at" | "stage"> = {}
): SafeF07RadarEvent {
  const entry: SafeF07RadarEvent = { at: new Date().toISOString(), stage };
  // Explicit allowlist: never spread a raw GPS object or error payload.
  for (const key of ["code", "ref", "city", "accuracy"] as const) {
    if (typeof details[key] === "string") entry[key] = details[key];
  }
  for (const key of ["authorized", "presenceOnline", "feesAllowed"] as const) {
    if (typeof details[key] === "boolean") entry[key] = details[key];
  }
  return entry;
}
