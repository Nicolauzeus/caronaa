/** Human-readable, allowlisted errors; never expose PostgreSQL internals to riders. */
export function quickRideSubmissionError(message: unknown): string {
  const value = typeof message === "string" ? message : "";
  if (/quote expired|cotação expirada/i.test(value))
    return "O preço desta corrida expirou. Atualize a cotação antes de confirmar.";
  if (/quote destination is not verified|missing verified destination/i.test(value))
    return "O município de destino desta cotação não foi confirmado. Selecione o destino novamente para recalcular.";
  if (/quote not found/i.test(value))
    return "Esta cotação não está disponível para sua conta. Selecione o destino novamente.";
  if (/destination not approved|destination.*not enabled/i.test(value))
    return "O município de destino não está habilitado para esta modalidade.";
  if (/origin, tariff or intermunicipal dispatch unavailable|quick ride tariff no longer available/i.test(value))
    return "A região, a tarifa ou a viagem entre municípios não está habilitada no momento.";
  if (/pilot dispatch window has ended/i.test(value))
    return "O período de testes da Corrida Rápida terminou nesta região.";
  if (/already.*(active|ride)|active.*ride|unique_violation/i.test(value))
    return "Você já possui uma corrida ativa. Consulte o pedido antes de solicitar outra.";
  return "Não foi possível solicitar a corrida agora. Verifique sua disponibilidade e tente novamente.";
}
