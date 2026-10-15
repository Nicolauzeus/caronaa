/** Trusted server-only Asaas fee configuration; values are never supplied by the browser. */
export function readVerifiedPixFee(
  environment: Readonly<Record<string, string | undefined>>,
  now: Date = new Date(),
): { feeCents: number; verifiedAt: string } {
  if (environment["ASAAS_ENV"] !== "sandbox")
    throw new Error("Prévia Asaas disponível apenas no Sandbox");
  const raw = environment["ASAAS_VERIFIED_PIX_FEE_CENTS"];
  if (!raw || !/^(0|[1-9][0-9]{0,7})$/.test(raw))
    throw new Error("Tarifa Pix não configurada ou não verificada");
  const verifiedAt = environment["ASAAS_FEE_VERIFIED_AT"];
  if (!verifiedAt || !/^\d{4}-\d{2}-\d{2}T/.test(verifiedAt))
    throw new Error("Verificação da tarifa ausente");
  const verifiedMillis = Date.parse(verifiedAt);
  const ageMillis = now.getTime() - verifiedMillis;
  if (!Number.isFinite(verifiedMillis) || !Number.isFinite(ageMillis) ||
      ageMillis < 0 || ageMillis > 14 * 24 * 60 * 60 * 1000)
    throw new Error("Tarifa Pix expirada ou com data inválida");
  return { feeCents: Number(raw), verifiedAt };
}
