import { supabase } from "@/integrations/supabase/client";

export type RideQrData = {
  token: string;
  expiresAt: string;
  rideId: string;
};

export type ConfirmedRideDetails = {
  confirmed: boolean;
  rideId: string;
  driverName: string;
  vehicleModel: string;
  vehiclePlate: string;
  destination: string;
  departureTime: string;
};

export function extractQrToken(rawContent: string): string {
  const trimmed = rawContent.trim();
  if (trimmed.startsWith("caronaa:ride-confirm:")) {
    return trimmed.replace("caronaa:ride-confirm:", "").trim();
  }
  // Se for uma URL (ex: https://.../confirm?token=...)
  if (trimmed.includes("token=")) {
    try {
      const url = new URL(trimmed);
      const tokenParam = url.searchParams.get("token");
      if (tokenParam) return tokenParam.trim();
    } catch {
      // Ignora erro de parsing de URL e segue
    }
  }
  return trimmed;
}

export async function generateRideQrToken(rideId: string): Promise<RideQrData> {
  const { data, error } = await supabase.rpc("generate_ride_qr_token", {
    p_ride_id: rideId,
  });

  if (error) {
    throw new Error(error.message);
  }

  return data as unknown as RideQrData;
}

export async function confirmRideByQr(rawTokenOrPayload: string): Promise<ConfirmedRideDetails> {
  const token = extractQrToken(rawTokenOrPayload);
  if (!token || token.length < 6) {
    throw new Error("Código ou QR Code inválido.");
  }

  const { data, error } = await supabase.rpc("confirm_ride_by_qr", {
    p_token: token,
  });

  if (error) {
    // Erros tratados com mensagens humanas específicas
    const msg = error.message.toLowerCase();
    if (msg.includes("já foi utilizado") || msg.includes("already used")) {
      throw new Error("Este QR já foi utilizado.");
    }
    if (msg.includes("expirou") || msg.includes("expired")) {
      throw new Error("Este QR expirou. Peça ao motorista para gerar um novo.");
    }
    if (msg.includes("autorizado") || msg.includes("not authorized")) {
      throw new Error("Você não é o passageiro autorizado para esta carona.");
    }
    throw new Error(error.message || "QR lido, mas não conseguimos confirmar a viagem. Tente novamente.");
  }

  return data as unknown as ConfirmedRideDetails;
}

