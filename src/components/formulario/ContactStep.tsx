type ContactStepProps = {
  name?: string | undefined;
  whatsapp?: string | undefined;
  onNameChange: (value: string) => void;
  onWhatsappChange: (value: string) => void;
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
  onNameChange,
  onWhatsappChange,
  onNext,
  onBack,
}: ContactStepProps) {
  const normalizedWhatsapp = whatsapp?.replace(/\D/g, "") ?? "";

  const canContinue = Boolean(name?.trim()) && normalizedWhatsapp.length >= 10;

  return (
    <section className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 py-6 sm:px-6 sm:py-10">
      <div className="space-y-2">
        <p className="text-sm font-medium text-primary">Último passo</p>

        <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
          Como podemos falar com você se surgir um match?
        </h2>

        <p className="text-sm leading-6 text-muted-foreground sm:text-base">
          Se encontrarmos alguém com rota e horário compatíveis, entraremos em contato pelo WhatsApp
          ainda durante o STS.
        </p>
      </div>

      <div className="space-y-5">
        <div className="space-y-2">
          <label htmlFor="contact-name" className="text-sm font-medium">
            Seu nome
          </label>

          <input
            id="contact-name"
            type="text"
            value={name ?? ""}
            onChange={(event) => onNameChange(event.target.value)}
            placeholder="Como podemos te chamar?"
            autoComplete="name"
            className="min-h-12 w-full rounded-xl border bg-background px-4 py-3 text-base outline-none transition placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/20"
          />
        </div>

        <div className="space-y-2">
          <label htmlFor="contact-whatsapp" className="text-sm font-medium">
            WhatsApp
          </label>

          <input
            id="contact-whatsapp"
            type="tel"
            inputMode="tel"
            value={formatWhatsapp(whatsapp ?? "")}
            onChange={(event) => onWhatsappChange(event.target.value.replace(/\D/g, ""))}
            placeholder="(85) 99999-9999"
            autoComplete="tel"
            className="min-h-12 w-full rounded-xl border bg-background px-4 py-3 text-base outline-none transition placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/20"
          />

          <p className="text-xs leading-5 text-muted-foreground">
            Usaremos esse contato apenas para tentar viabilizar sua experiência com a CARONAA e
            comunicações relacionadas.
          </p>
        </div>
      </div>

      <div className="rounded-xl border border-primary/20 bg-primary/5 p-4">
        <p className="text-sm font-medium">O que acontece depois?</p>

        <p className="mt-1 text-xs leading-5 text-muted-foreground">
          Vamos comparar destino, horário, disponibilidade e intenção de uso. Se houver
          compatibilidade, a equipe CARONAA poderá entrar em contato para apresentar a possibilidade
          de match.
        </p>
      </div>

      <div className="rounded-xl border bg-muted/40 p-4">
        <p className="text-xs leading-5 text-muted-foreground">
          Nenhuma viagem é confirmada automaticamente. Você sempre poderá analisar as informações
          antes de aceitar.
        </p>
      </div>

      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex min-h-11 items-center justify-center rounded-xl border px-5 py-2.5 text-sm font-medium transition hover:bg-accent"
        >
          Voltar
        </button>

        <button
          type="button"
          onClick={onNext}
          disabled={!canContinue}
          className="inline-flex min-h-11 items-center justify-center rounded-xl bg-primary px-6 py-2.5 text-sm font-semibold text-primary-foreground transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Finalizar
        </button>
      </div>
    </section>
  );
}
