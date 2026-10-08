import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell } from "@/components/caronaa/AppShell";
import { BrandBadge, RouteConnectionVisual } from "@/components/caronaa/BrandElements";
import { Button } from "@/components/ui/button";
import {
  ArrowRight,
  ArrowUpRight,
  CarFront,
  CheckCircle2,
  MapPin,
  ShieldAlert,
  Sparkles,
  UsersRound,
} from "lucide-react";

export const Route = createFileRoute("/como-funciona")({
  head: () => ({
    meta: [{ property: "og:title", content: "Como Funciona — CARONAA" },
{ property: "og:description", content: "Entenda como a CARONAA conecta motoristas e passageiros de rotas afins em um ambiente comunitário de teste." },
{ property: "og:type", content: "website" },
{ name: "twitter:card", content: "summary" },
      { title: "Como Funciona — CARONAA" },
      {
        name: "description",
        content:
          "Entenda como a CARONAA conecta motoristas e passageiros de rotas afins em um ambiente comunitário de teste.",
      },
    ],
  }),
  component: ComoFuncionaPage,
});

function ComoFuncionaPage() {
  return (
    <AppShell publicPage>
      <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6 sm:py-16">
        {/* Topo / Header */}
        <div className="mx-auto max-w-3xl text-center">
          <BrandBadge variant="sts" className="mb-4" />
          <h1 className="font-display text-3xl font-extrabold tracking-tight text-foreground sm:text-5xl">
            Como funciona a CARONAA?
          </h1>
          <p className="mt-4 text-base leading-relaxed text-muted-foreground sm:text-lg">
            A CARONAA conecta quem precisa ir com quem já está indo. Sem complicações e em fase de
            validação prática no Siará Tech Summit 2026 e na comunidade da Unifor.
          </p>
        </div>

        {/* Demonstração Visual */}
        <div className="mx-auto mt-10 max-w-xl">
          <RouteConnectionVisual
            origin="Centro de Eventos do Ceará"
            destination="Seu bairro ou universidade"
          />
        </div>

        {/* Três Passos Principais */}
        <div className="mt-16 grid gap-8 sm:grid-cols-3">
          <div className="flex flex-col rounded-3xl border border-border bg-card p-6 shadow-soft transition-transform hover:-translate-y-1">
            <span className="flex size-11 items-center justify-center rounded-2xl bg-caronaa-primary text-caronaa-dark font-display font-extrabold text-lg">
              1
            </span>
            <h2 className="mt-5 font-display text-xl font-bold">Conte para onde vai</h2>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              Você informa seu trajeto, se precisa de carona ou se tem lugares sobrando no carro,
              além da sua faixa de horário pretendida.
            </p>
          </div>

          <div className="flex flex-col rounded-3xl border border-border bg-card p-6 shadow-soft transition-transform hover:-translate-y-1">
            <span className="flex size-11 items-center justify-center rounded-2xl bg-caronaa-primary text-caronaa-dark font-display font-extrabold text-lg">
              2
            </span>
            <h2 className="mt-5 font-display text-xl font-bold">Procura de compatibilidade</h2>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              Nosso sistema busca conexões que compartilham o mesmo caminho e horários semelhantes
              saindo ou chegando no mesmo evento.
            </p>
          </div>

          <div className="flex flex-col rounded-3xl border border-border bg-card p-6 shadow-soft transition-transform hover:-translate-y-1">
            <span className="flex size-11 items-center justify-center rounded-2xl bg-caronaa-primary text-caronaa-dark font-display font-extrabold text-lg">
              3
            </span>
            <h2 className="mt-5 font-display text-xl font-bold">Você avalia e decide</h2>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              Apresentamos os detalhes da rota e das pessoas para você decidir com tranquilidade e
              combinar os pontos de encontro.
            </p>
          </div>
        </div>

        {/* Dois Lados: Motorista e Passageiro */}
        <div className="mt-16 grid gap-8 md:grid-cols-2">
          <div className="rounded-3xl border border-border bg-card p-8 shadow-soft">
            <div className="inline-flex size-12 items-center justify-center rounded-2xl bg-primary/15 text-primary">
              <CarFront size={26} />
            </div>
            <h2 className="mt-4 font-display text-2xl font-bold">Tem lugar no carro?</h2>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              Se você já vai fazer o trajeto com assentos vazios, compartilhe sua rota. Ajude alguém
              da sua comunidade que vai na mesma direção.
            </p>
            <div className="mt-6">
              <Button asChild variant="strong" className="w-full sm:w-auto">
<StsFormLink to="/formulario">
                  Oferecer carona no STS <ArrowRight size={16} />
                </StsFormLink>
              </Button>
            </div>
          </div>

          <div className="rounded-3xl border border-border bg-card p-8 shadow-soft">
            <div className="inline-flex size-12 items-center justify-center rounded-2xl bg-secondary text-primary">
              <UsersRound size={26} />
            </div>
            <h2 className="mt-4 font-display text-2xl font-bold">Precisa de uma carona?</h2>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              Diga para onde você precisa ir e descubra quem da comunidade ou do evento está indo
              pelo mesmo caminho na mesma faixa de horário.
            </p>
            <div className="mt-6">
              <Button asChild variant="default" className="w-full sm:w-auto">
<StsFormLink to="/formulario">
                  Encontrar carona no STS <ArrowRight size={16} />
                </StsFormLink>
              </Button>
            </div>
          </div>
        </div>

        {/* CTA Final */}
        <div className="mt-16 rounded-3xl border border-border/80 bg-caronaa-dark p-8 text-center text-white sm:p-12">
          <span className="text-xs font-bold uppercase tracking-widest text-event-cyan">
            Siará Tech Summit 2026 • 07 a 09 de outubro
          </span>
          <h2 className="mt-3 font-display text-2xl font-black sm:text-4xl">
            Pronto para testar a CARONAA na prática?
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-sm leading-relaxed text-white/80 sm:text-base">
            Participe do nosso teste ao vivo durante o evento. O formulário leva menos de 2 minutos.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Button asChild variant="strong" size="lg" className="h-12 px-8 font-bold">
<StsFormLink to="/formulario">
                🚗 Garantir minha CARONAA no Siará <ArrowUpRight size={16} />
              </StsFormLink>
            </Button>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
import { StsFormLink } from "@/components/caronaa/StsFormLink";
