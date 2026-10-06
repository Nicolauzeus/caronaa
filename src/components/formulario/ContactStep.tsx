import React from "react";
import { Link } from "@tanstack/react-router";
import { Check, ShieldCheck, Lock } from "lucide-react";

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

  const canContinue =
    Boolean(name?.trim() && name.trim().length >= 2) &&
    normalizedWhatsapp.length >= 10 &&
    Boolean(feedback?.trim()) &&
    acceptTerms &&
    acceptPrivacy;

  return (
    <section className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 py-6 sm:px-6 sm:py-10">
      <div className="space-y-2">
        <div className="inline-flex items-center gap-1.5 rounded-full border border-caronaa-primary/30 bg-caronaa-primary/10 px-3 py-1 text-xs font-semibold text-caronaa-dark dark:text-caronaa-primary">
          <Check size={14} className="text-emerald-600 dark:text-emerald-400" />
          Última etapa • Seus dados para contato
        </div>

        <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
          Como podemos falar com você?
        </h2>

        <p className="text-sm text-muted-foreground">
          Se identificarmos alguém com trajeto e horário compatíveis para o Siará Tech Summit, nossa
          equipe entrará em contato via WhatsApp para apresentar a sugestão.
        </p>
      </div>

      <div className="space-y-5 rounded-2xl border bg-card p-5 sm:p-6 shadow-sm">
        <div className="space-y-2">
          <label htmlFor="contact-name" className="text-sm font-semibold">
            Como prefere ser chamado? *
          </label>

          <input
            id="contact-name"
            type="text"
            value={name ?? ""}
            onChange={(event) => onNameChange(event.target.value)}
            placeholder="Ex.: Maria Clara ou João Victor"
            autoComplete="name"
            className="min-h-12 w-full rounded-xl border bg-background px-4 py-3 text-base outline-none transition placeholder:text-muted-foreground focus:border-caronaa-primary focus:ring-2 focus:ring-caronaa-primary/20"
          />
        </div>

        <div className="space-y-2">
          <label htmlFor="contact-whatsapp" className="text-sm font-semibold">
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
            className="min-h-12 w-full rounded-xl border bg-background px-4 py-3 text-base outline-none transition placeholder:text-muted-foreground focus:border-caronaa-primary focus:ring-2 focus:ring-caronaa-primary/20"
          />

          <p className="text-xs leading-5 text-muted-foreground">
            Usaremos esse contato apenas para viabilizar sua experiência e avisar sobre trajetos
            compatíveis.
          </p>
        </div>

        <div className="space-y-2">
          <label htmlFor="contact-email" className="text-sm font-semibold">
            E-mail institucional ou pessoal (opcional)
          </label>

          <input
            id="contact-email"
            type="email"
            value={email ?? ""}
            onChange={(event) => onEmailChange(event.target.value)}
            placeholder="voce@exemplo.com ou @edu.unifor.br"
            autoComplete="email"
            className="min-h-12 w-full rounded-xl border bg-background px-4 py-3 text-base outline-none transition placeholder:text-muted-foreground focus:border-caronaa-primary focus:ring-2 focus:ring-caronaa-primary/20"
          />
        </div>

        <div className="space-y-2">
          <label htmlFor="contact-feedback" className="text-sm font-semibold">
            Comentário ou sugestão *
          </label>

          <textarea
            id="contact-feedback"
            rows={3}
            value={feedback ?? ""}
            onChange={(event) => onFeedbackChange?.(event.target.value)}
            placeholder="Alguma dúvida, sugestão ou detalhe sobre seu trajeto? Conte aqui para a nossa equipe..."
            className="w-full rounded-xl border bg-background px-4 py-3 text-base outline-none transition placeholder:text-muted-foreground focus:border-caronaa-primary focus:ring-2 focus:ring-caronaa-primary/20"
          />
        </div>
      </div>

      {/* Consent & Term Section */}
      <div className="space-y-3 rounded-2xl border border-muted-foreground/20 bg-muted/30 p-5">
        <div className="flex items-center gap-2 font-semibold text-sm">
          <ShieldCheck size={18} className="text-caronaa-primary" />
          Antes de continuar
        </div>

        <label className="flex items-start gap-3 cursor-pointer text-xs sm:text-sm text-foreground">
          <input
            type="checkbox"
            aria-label="Li e concordo com os Termos de Uso"
            checked={acceptTerms}
            onChange={(e) => handleTermsChange(e.target.checked)}
            className="mt-1 h-4 w-4 rounded border-gray-300 text-caronaa-primary focus:ring-caronaa-primary"
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

        <label className="flex items-start gap-3 cursor-pointer text-xs sm:text-sm text-foreground">
          <input
            type="checkbox"
            aria-label="Concordo com a Política de Privacidade"
            checked={acceptPrivacy}
            onChange={(e) => handlePrivacyChange(e.target.checked)}
            className="mt-1 h-4 w-4 rounded border-gray-300 text-caronaa-primary focus:ring-caronaa-primary"
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

        <label className="flex items-start gap-3 cursor-pointer text-xs sm:text-sm text-muted-foreground">
          <input
            type="checkbox"
            aria-label="Aceito receber pesquisas de validação e novidades"
            checked={acceptResearch}
            onChange={(e) => handleResearchChange(e.target.checked)}
            className="mt-1 h-4 w-4 rounded border-gray-300 text-caronaa-primary focus:ring-caronaa-primary"
          />
          <span>
            (Opcional) Aceito receber pesquisas de validação e novidades do lançamento da CARONAA
            após o evento.
          </span>
        </label>
      </div>

      <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 flex items-start gap-3">
        <Lock size={18} className="mt-0.5 text-caronaa-primary shrink-0" />
        <div className="text-xs leading-relaxed text-muted-foreground">
          <strong>Transparência e Responsabilidade:</strong> Nenhuma carona é garantida
          antecipadamente nem iniciada automaticamente. Tanto motoristas quanto passageiros avaliam
          os perfis e acordam o trajeto antes da viagem. Saiba mais em nossa página de{" "}
          <Link to="/seguranca" target="_blank" className="text-foreground underline">
            Segurança e responsabilidades
          </Link>
          .
        </div>
      </div>

      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-between pt-2">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex min-h-12 items-center justify-center rounded-xl border px-5 py-2.5 text-sm font-medium transition hover:bg-accent"
        >
          Voltar
        </button>

        <button
          type="button"
          onClick={onNext}
          disabled={!canContinue}
          className="inline-flex min-h-12 items-center justify-center rounded-xl bg-caronaa-primary px-8 py-3 text-base font-bold text-caronaa-dark shadow-md transition hover:bg-caronaa-primary-strong disabled:cursor-not-allowed disabled:opacity-50"
        >
          Concluir e procurar combinação
        </button>
      </div>
    </section>
  );
}
