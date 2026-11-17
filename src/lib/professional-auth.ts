/**
 * Regras de orientação para o acesso profissional.
 * A força informada é apenas indicativa; a autenticação continua a cargo do Supabase.
 */
export const PROFESSIONAL_PASSWORD_MIN_LENGTH = 8;

export function passwordGuidance(password: string) {
  if (!password) return { score: 0, label: "Digite uma senha" };
  const score = [
    password.length >= 12,
    password.length >= 16,
    /[a-z]/.test(password) && /[A-Z]/.test(password),
    /\d/.test(password) && /[^a-zA-Z0-9]/.test(password),
  ].filter(Boolean).length;
  if (password.length < PROFESSIONAL_PASSWORD_MIN_LENGTH) return { score: 1, label: "Muito curta" };
  const label = score <= 1 ? "Fraca" : score === 2 ? "Razoável" : score === 3 ? "Boa" : "Forte";
  return { score: Math.max(1, score), label };
}

export function registrationPasswordError(password: string, confirmation: string) {
  if (password.length < PROFESSIONAL_PASSWORD_MIN_LENGTH) {
    return "A senha precisa ter pelo menos 8 caracteres.";
  }
  if (password !== confirmation) return "As senhas não coincidem.";
  return null;
}

/** Apenas para uso no navegador e sob ação explícita do usuário. */
export function generateProfessionalPassword() {
  const groups = [
    "abcdefghijkmnopqrstuvwxyz",
    "ABCDEFGHJKLMNPQRSTUVWXYZ",
    "23456789",
    "!@#$%*-_",
  ];
  const randomIndex = (length: number) => {
    const array = new Uint32Array(1);
    crypto.getRandomValues(array);
    return array[0] % length;
  };
  const chars = groups.map((group) => group[randomIndex(group.length)]);
  const all = groups.join("");
  while (chars.length < 18) chars.push(all[randomIndex(all.length)]);
  for (let i = chars.length - 1; i > 0; i--) {
    const j = randomIndex(i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join("");
}

/**
 * Supabase Auth returns structured error codes with HTTP 400 responses.
 * Show a safe, actionable explanation without echoing email, password or tokens.
 */
export function professionalAuthErrorMessage(error: unknown): string {
  const value = error && typeof error === "object"
    ? error as {message?: string; code?: string; status?: number} : {};
  const message = String(value.message ?? "").toLowerCase();
  const code = String(value.code ?? "").toLowerCase();
  const status = Number(value.status ?? 0);
  if (code === "user_already_exists" || code === "email_exists" ||
      /already registered|already exists|already been registered/.test(message))
    return "Este e-mail já possui uma conta. Use Já tenho conta ou recupere sua senha.";
  if (code === "email_not_confirmed" || message.includes("email not confirmed"))
    return "Confirme seu e-mail antes de entrar. Verifique também a pasta de spam.";
  if (code === "invalid_credentials" || message.includes("invalid login credentials"))
    return "E-mail ou senha incorretos. Confira os dados ou recupere o acesso.";
  if (code === "weak_password" || /weak password|password.*(weak|pwned|compromised|breached)/.test(message))
    return "Esta senha foi recusada por segurança. Use uma senha nova, forte e exclusiva.";
  if (code === "email_address_invalid" || code === "email_address_not_authorized" ||
      /invalid email|email address.*(invalid|not authorized)/.test(message))
    return "Este endereço de e-mail não foi aceito pelo serviço de autenticação.";
  if (code === "over_email_send_rate_limit" || code === "over_request_rate_limit" ||
      /rate limit|too many requests/.test(message))
    return "Muitas tentativas ou envios de e-mail. Aguarde antes de tentar novamente.";
  if (code === "email_provider_disabled" || code === "signup_disabled" ||
      /signups? (are )?disabled|signup is disabled|email provider.*disabled/.test(message))
    return "O cadastro está indisponível na autenticação. Contate o suporte do CARONAA.";
  if (/redirect.*(invalid|not allowed)|invalid redirect/.test(message))
    return "A URL de confirmação não foi autorizada no Supabase. Contate o suporte.";
  if (code === "unexpected_failure" || /database error|error saving new user/.test(message))
    return "O Supabase não conseguiu criar o usuário. O suporte precisa verificar os logs de Auth e os gatilhos do banco.";
  if (status === 400)
    return "O Supabase rejeitou o cadastro (HTTP 400). Verifique o motivo técnico nos detalhes da solicitação e informe o suporte.";
  if (status >= 500)
    return "O serviço de autenticação está indisponível. Tente novamente mais tarde.";
  return "Não foi possível continuar. Confira os dados ou procure o suporte.";
}

export function professionalAuthErrorCode(error: unknown): string | null {
  if (!error || typeof error !== "object") return null;
  const value = error as { code?: unknown; status?: unknown };
  if (typeof value.code === "string" && /^[a-z_]{2,80}$/i.test(value.code))
    return value.code;
  if (value.status === 400) return "HTTP_400";
  if (typeof value.status === "number" && value.status >= 400 && value.status <= 599)
    return "HTTP_" + value.status;
  return null;
}
