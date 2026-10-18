export function adminErrorMessage(
  error: unknown,
  fallback = "Não foi possível carregar os dados. Tente novamente.",
) {
  const value = error as { code?: string; status?: number; message?: string } | null;
  if (
    value?.code === "42501" ||
    value?.status === 403 ||
    /admin access required|permission denied|sem permissão|acesso negado/i.test(
      value?.message ?? "",
    )
  ) {
    return "Você não tem permissão para consultar ou alterar estes dados.";
  }
  return fallback;
}
