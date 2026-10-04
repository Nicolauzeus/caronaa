type FormIntroProps = {
  onStart: () => void;
};

export function FormIntro({
  onStart,
}: FormIntroProps) {
  return (
    <section className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 py-8 sm:px-6 sm:py-12">
      <div className="space-y-4">
        <span className="inline-flex w-fit items-center rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
          Siará Tech Summit 2026
        </span>

        <div className="space-y-3">
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
            Vai sair do STS hoje?
          </h1>

          <p className="max-w-xl text-base leading-7 text-muted-foreground sm:text-lg">
            A CARONAA quer conectar pessoas que estão saindo
            do evento em horários e rotas parecidas.
          </p>
        </div>
      </div>

      <div className="space-y-3 rounded-2xl border bg-card p-4 sm:p-5">
        <p className="font-medium">
          Você pode:
        </p>

        <ul className="space-y-3 text-sm text-muted-foreground sm:text-base">
          <li className="flex gap-3">
            <span aria-hidden="true">
              🚗
            </span>

            <span>
              oferecer lugares no seu carro;
            </span>
          </li>

          <li className="flex gap-3">
            <span aria-hidden="true">
              🎒
            </span>

            <span>
              encontrar alguém indo para perto do seu destino;
            </span>
          </li>

          <li className="flex gap-3">
            <span aria-hidden="true">
              🔄
            </span>

            <span>
              fazer os dois e escolher a melhor opção.
            </span>
          </li>
        </ul>
      </div>

      <div className="space-y-2">
        <p className="text-sm text-muted-foreground">
          Leva cerca de 1 minuto.
        </p>

        <p className="text-sm text-muted-foreground">
          Se encontrarmos uma rota compatível, podemos entrar
          em contato com você ainda hoje.
        </p>
      </div>

      <button
        type="button"
        onClick={onStart}
        className="inline-flex min-h-12 w-full items-center justify-center rounded-xl bg-primary px-5 py-3 text-base font-semibold text-primary-foreground transition hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
      >
        Quero usar a CARONAA hoje
      </button>

      <p className="text-center text-xs leading-5 text-muted-foreground">
        Ao continuar, você autoriza o uso das informações
        fornecidas para tentar encontrar uma carona compatível
        durante o evento.
      </p>
    </section>
  );
}
