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

export function professionalAuthErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message.toLowerCase() : "";
  if (message.includes("invalid login credentials")) return "E-mail ou senha incorretos.";
  if (message.includes("email not confirmed")) return "Confirme seu e-mail antes de entrar.";
  if (message.includes("user already registered")) return "Este e-mail já tem conta. Escolha Entrar.";
  if (message.includes("rate limit") || message.includes("too many requests")) {
    return "Muitas tentativas. Aguarde alguns minutos antes de tentar novamente.";
  }
  if (message.includes("password")) return "Senha não aceita. Escolha outra senha mais segura.";
  return "Não foi possível continuar. Verifique os dados e tente novamente.";
}
