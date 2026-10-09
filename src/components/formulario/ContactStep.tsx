import React from "react";
import { Link } from "@tanstack/react-router";
import { Check, ShieldCheck, Lock, UserCheck } from "lucide-react";

type ContactStepProps = {
  name?: string | undefined;
  whatsapp?: string | undefined;
  email?: string | undefined;
  feedback?: string | undefined;
  termsAccepted?: boolean | undefined;
  privacyAccepted?: boolean | undefined;
  researchAccepted?: boolean | undefined;
  onNameChange: (value: string) => void;
  onWhatsappChange: (value: string) => void;
  onEmailChange: (value: string) => void;
  onFeedbackChange?: (value: string) => void;
  onTermsAcceptedChange?: (value: boolean) => void;
  onPrivacyAcceptedChange?: (value: boolean) => void;
  onResearchAcceptedChange?: (value: boolean) => void;
  onNext: () => void;
  onBack: () => void;
};

function formatWhatsapp(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 11);

  if (digits.length <= 2) {
    return digits;
  }

  if (digits.length <= 7) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  }

  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
}

export function ContactStep({
  name,
  whatsapp,
  email,
  feedback,
  termsAccepted,
  privacyAccepted,
  researchAccepted,
  onNameChange,
  onWhatsappChange,
  onEmailChange,
  onFeedbackChange,
  onTermsAcceptedChange,
  onPrivacyAcceptedChange,
  onResearchAcceptedChange,
  onNext,
  onBack,
}: ContactStepProps) {
  const [subStep, setSubStep] = React.useState<number>(1);
  const [localTerms, setLocalTerms] = React.useState(termsAccepted ?? false);
  const [localPrivacy, setLocalPrivacy] = React.useState(privacyAccepted ?? false);
  const [localResearch, setLocalResearch] = React.useState(researchAccepted ?? true);

  const acceptTerms = termsAccepted ?? localTerms;
  const acceptPrivacy = privacyAccepted ?? localPrivacy;
  const acceptResearch = researchAccepted ?? localResearch;

  const handleTermsChange = (checked: boolean) => {
    setLocalTerms(checked);
    onTermsAcceptedChange?.(checked);
  };

  const handlePrivacyChange = (checked: boolean) => {
    setLocalPrivacy(checked);
    onPrivacyAcceptedChange?.(checked);
  };

  const handleResearchChange = (checked: boolean) => {
    setLocalResearch(checked);
    onResearchAcceptedChange?.(checked);
  };

  const normalizedWhatsapp = whatsapp?.replace(/\D/g, "") ?? "";

  const canContinueSubStep1 =
    Boolean(name?.trim() && name.trim().length >= 2) &&
    normalizedWhatsapp.length >= 10 &&
    Boolean(feedback?.trim());

  const canContinueSubStep2 = acceptTerms && acceptPrivacy;

  function handleNextSubStep() {
    if (subStep === 1 && canContinueSubStep1) {
      setSubStep(2);
    } else if (subStep === 2 && canContinueSubStep2) {
      onNext();
    }
  }

  function handleBackSubStep() {
    if (subStep > 1) {
      setSubStep((prev) => prev - 1);
    } else {
      onBack();
    }
  }

  return (
    <div className="flex h-full w-full flex-col justify-between">
      <div className="mx-auto w-full max-w-2xl px-4 py-4 sm:px-6">
        {/* Sub-step Indicator */}
        <div className="mb-4 flex items-center justify-between">
          <div className="inline-flex items-center gap-1.5 rounded-full border border-caronaa-primary/30 bg-caronaa-primary/10 px-3 py-1 text-xs font-semibold text-caronaa-dark dark:text-caronaa-primary">
            <UserCheck size={13} className="text-caronaa-primary" />
            Última etapa • Seus dados ({subStep}/2)
          </div>
          <div className="flex gap-1.5">
            {[1, 2].map((s) => (
              <div
                key={s}
                className={`h-1.5 rounded-full transition-all duration-300 ${
                  s === subStep
                    ? "bg-caronaa-primary w-8"
                    : s < subStep
                      ? "bg-caronaa-primary/60 w-6"
                      : "bg-muted w-6"
                }`}
              />
            ))}
          </div>
        </div>

        {/* SUBSTEP 1: Informações de Contato & Feedback */}
        {subStep === 1 && (
          <div className="space-y-4">
            <div>
              <h2 className="text-xl font-bold tracking-tight sm:text-2xl">
                Como podemos falar com você?
              </h2>
              <p className="text-xs text-muted-foreground sm:text-sm">
                Se identificarmos alguém compatível, entraremos em contato via WhatsApp com a sugestão.
              </p>
            </div>

            <div className="space-y-3">
              <div className="space-y-1">
                <label htmlFor="contact-name" className="text-xs font-semibold">
                  Como prefere ser chamado? *
                </label>
                <input
                  id="contact-name"
                  type="text"
                  value={name ?? ""}
                  onChange={(event) => onNameChange(event.target.value)}
                  placeholder="Ex.: Maria Clara ou João Victor"
                  autoComplete="name"
                  className="h-10 w-full rounded-xl border bg-background px-3 py-2 text-sm outline-none transition placeholder:text-muted-foreground focus:border-caronaa-primary focus:ring-2 focus:ring-caronaa-primary/20"
                />
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="space-y-1">
                  <label htmlFor="contact-whatsapp" className="text-xs font-semibold">
                    WhatsApp para contato *
                  </label>
                  <input
                    id="contact-whatsapp"
                    type="tel"
                    inputMode="tel"
                    value={formatWhatsapp(whatsapp ?? "")}
                    onChange={(event) => onWhatsappChange(event.target.value.replace(/\D/g, ""))}
                    placeholder="(85) 99999-9999"
                    autoComplete="tel"
                    className="h-10 w-full rounded-xl border bg-background px-3 py-2 text-sm outline-none transition placeholder:text-muted-foreground focus:border-caronaa-primary focus:ring-2 focus:ring-caronaa-primary/20"
                  />
                </div>

                <div className="space-y-1">
                  <label htmlFor="contact-email" className="text-xs font-semibold">
                    E-mail institucional / pessoal (opcional)
                  </label>
                  <input
                    id="contact-email"
                    type="email"
                    value={email ?? ""}
                    onChange={(event) => onEmailChange(event.target.value)}
                    placeholder="voce@exemplo.com"
                    autoComplete="email"
                    className="h-10 w-full rounded-xl border bg-background px-3 py-2 text-sm outline-none transition placeholder:text-muted-foreground focus:border-caronaa-primary focus:ring-2 focus:ring-caronaa-primary/20"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label htmlFor="contact-feedback" className="text-xs font-semibold">
                  Comentário ou sugestão *
                </label>
                <textarea
                  id="contact-feedback"
                  rows={2}
                  value={feedback ?? ""}
                  onChange={(event) => onFeedbackChange?.(event.target.value)}
                  placeholder="Alguma dúvida, sugestão ou detalhe sobre seu trajeto? Conte aqui para a nossa equipe..."
                  className="w-full rounded-xl border bg-background px-3 py-2 text-sm outline-none transition placeholder:text-muted-foreground focus:border-caronaa-primary focus:ring-2 focus:ring-caronaa-primary/20"
                />
              </div>
            </div>
          </div>
        )}

        {/* SUBSTEP 2: Termos de Uso & Consentimento */}
        {subStep === 2 && (
          <div className="space-y-4">
            <div>
              <h2 className="text-xl font-bold tracking-tight sm:text-2xl">
                Termos e Consentimento
              </h2>
              <p className="text-xs text-muted-foreground sm:text-sm">
                Para sua segurança e conformidade com a LGPD durante o evento.
              </p>
            </div>

            <div className="space-y-3 rounded-2xl border border-muted-foreground/20 bg-muted/30 p-4">
              <div className="flex items-center gap-2 font-semibold text-xs text-foreground">
                <ShieldCheck size={16} className="text-caronaa-primary" />
                Antes de continuar
              </div>

              <label className="flex items-start gap-2.5 cursor-pointer text-xs text-foreground">
                <input
                  type="checkbox"
                  aria-label="Li e concordo com os Termos de Uso"
                  checked={acceptTerms}
                  onChange={(e) => handleTermsChange(e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-gray-300 text-caronaa-primary focus:ring-caronaa-primary"
                />
                <span>
                  Li e concordo com os{" "}
                  <Link
                    to="/termos"
                    target="_blank"
                    className="font-semibold text-caronaa-primary-strong underline hover:text-caronaa-primary"
                  >
                    Termos de Uso
                  </Link>{" "}
                  da CARONAA e compreendo que o matching é experimental e sujeito à confirmação mútua.
                </span>
              </label>

              <label className="flex items-start gap-2.5 cursor-pointer text-xs text-foreground">
                <input
                  type="checkbox"
                  aria-label="Concordo com a Política de Privacidade"
                  checked={acceptPrivacy}
                  onChange={(e) => handlePrivacyChange(e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-gray-300 text-caronaa-primary focus:ring-caronaa-primary"
                />
                <span>
                  Concordo com a{" "}
                  <Link
                    to="/privacidade"
                    target="_blank"
                    className="font-semibold text-caronaa-primary-strong underline hover:text-caronaa-primary"
                  >
                    Política de Privacidade
                  </Link>{" "}
                  para tratamento seguro dos meus dados e localização aproximada durante o evento.
                </span>
              </label>

              <label className="flex items-start gap-2.5 cursor-pointer text-xs text-muted-foreground">
                <input
                  type="checkbox"
                  aria-label="Aceito receber pesquisas de validação e novidades"
                  checked={acceptResearch}
                  onChange={(e) => handleResearchChange(e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-gray-300 text-caronaa-primary focus:ring-caronaa-primary"
                />
                <span>
                  (Opcional) Aceito receber pesquisas de validação e novidades do lançamento da CARONAA após o evento.
                </span>
              </label>
            </div>

            <div className="rounded-xl border border-primary/20 bg-primary/5 p-3 flex items-start gap-2.5">
              <Lock size={16} className="mt-0.5 text-caronaa-primary shrink-0" />
              <div className="text-[11px] leading-relaxed text-muted-foreground">
                <strong>Transparência e Responsabilidade:</strong> Nenhuma carona é iniciada automaticamente. Tanto motoristas quanto passageiros avaliam os perfis e acordam o trajeto antes da viagem.
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Static/Pinned Bottom Navigation */}
      <div className="shrink-0 border-t border-border bg-background/95 p-4 backdrop-blur-sm sm:px-6">
        <div className="mx-auto flex max-w-2xl items-center justify-between gap-3">
          <button
            type="button"
            onClick={handleBackSubStep}
            className="inline-flex min-h-11 items-center justify-center rounded-xl border px-5 py-2.5 text-sm font-semibold transition hover:bg-accent"
          >
            Voltar
          </button>

          <button
            type="button"
            onClick={handleNextSubStep}
            disabled={subStep === 1 ? !canContinueSubStep1 : !canContinueSubStep2}
            className="inline-flex min-h-11 items-center justify-center rounded-xl bg-caronaa-primary px-7 py-2.5 text-sm font-bold text-caronaa-dark shadow-md transition hover:bg-caronaa-primary-strong disabled:cursor-not-allowed disabled:opacity-50"
          >
            {subStep === 2 ? "Concluir e procurar combinação" : "Continuar"}
          </button>
        </div>
      </div>
    </div>
  );
}
