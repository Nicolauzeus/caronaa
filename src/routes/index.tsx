import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowRight,
  ArrowUpRight,
  Calendar,
  CarFront,
  CheckCircle2,
  Clock,
  Compass,
  HeartHandshake,
  MapPin,
  Route as RouteIcon,
  ShieldCheck,
  Sparkles,
  UsersRound,
} from "lucide-react";
import { useEffect, useMemo } from "react";
import { AppShell } from "@/components/caronaa/AppShell";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth-context";
import { getCampaignAttribution, trackFunnelEvent } from "@/lib/funnel-events";
import {
  BrandBadge,
  CaronaaSymbol,
  InstitutionalPartnershipStrip,
  RouteConnectionVisual,
} from "@/components/caronaa/BrandElements";
import { CountdownTimer } from "@/components/caronaa/CountdownTimer";
import stsBannerAsset from "@/assets/brand/sts-banner.png";
import logoAsset from "@/assets/brand/caronaa-logo.png.asset.json";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "CARONAA — Conecte quem precisa ir com quem já está indo" },
      {
        name: "description",
        content:
          "A CARONAA conecta pessoas que precisam fazer um trajeto com quem já vai pelo mesmo caminho e tem lugar disponível no carro. Validação no Siará Tech Summit 2026.",
      },
      {
        property: "og:title",
        content: "CARONAA — Conecte quem precisa ir com quem já está indo",
      },
      {
        property: "og:description",
        content:
          "Encontre uma carona para o seu trajeto ou compartilhe o lugar que está sobrando no seu carro. MVP em validação no Siará Tech Summit 2026.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: LandingPage,
});

function LandingPage() {
  const { user } = useAuth();
  const attribution = useMemo(
    () => getCampaignAttribution({ defaultSource: "direct", defaultCampaignEvent: "Site" }),
    [],
  );

  useEffect(() => {
    void trackFunnelEvent({
      eventName: "landing_view",
      userId: user?.id ?? null,
      ...attribution,
      metadata: {
        surface: "home",
      },
    });
  }, [attribution, user?.id]);

  return (
    <AppShell publicPage>
      {/* =========================================================================
          HERO SECTION (Mobile-First, bastante espaço, contraste e foco no STS)
      ========================================================================= */}
      <section className="relative overflow-hidden bg-radial from-secondary/40 via-background to-background pb-16 pt-8 sm:pb-24 sm:pt-14">
        {/* Detalhe de fundo sutil com cores da marca */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -top-24 left-1/2 -z-10 size-[600px] -translate-x-1/2 rounded-full bg-caronaa-primary/10 blur-3xl sm:size-[800px]"
        />

        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid gap-12 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
            {/* Coluna de Texto Principal */}
            <div className="flex flex-col items-start text-left">
              {/* Badge Oficial */}
              <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-event-cyan/40 bg-caronaa-dark px-3.5 py-1.5 text-xs font-bold text-white shadow-soft">
                <span>🚀 Startup expositora no Siará Tech Summit 2026</span>
              </div>

              {/* Headline Principal */}
              <h1 className="font-display text-4xl font-black tracking-tight text-foreground sm:text-5xl lg:text-6xl lg:leading-[1.1]">
                Conecte quem precisa ir com quem já está indo.
              </h1>

              {/* Subheadline */}
              <p className="mt-5 max-w-xl text-base leading-relaxed text-muted-foreground sm:text-lg">
                A CARONAA conecta pessoas que precisam fazer um trajeto com quem já vai pelo mesmo
                caminho e tem lugar disponível no carro.
              </p>

              {/* CTAs do Hero */}
              <div className="mt-8 flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:items-center">
                <Button
                  asChild
                  variant="strong"
                  size="lg"
                  className="h-14 w-full rounded-2xl px-8 text-base font-extrabold shadow-card sm:w-auto"
                >
                  <Link to="/formulario">🚗 Garantir minha CARONAA no Siará</Link>
                </Button>

                <Button
                  asChild
                  variant="outline"
                  size="lg"
                  className="h-14 w-full rounded-2xl border-border/80 px-6 font-semibold sm:w-auto"
                >
                  <Link to="/auth">Já tenho uma conta</Link>
                </Button>
              </div>

              {/* Contagem Regressiva no Hero */}
              <div className="mt-10 w-full max-w-md pt-2">
                <CountdownTimer />
              </div>
            </div>

            {/* Coluna Visual do Hero */}
            <div className="flex flex-col gap-5 lg:pl-6">
              {/* Visual de Conexão */}
              <RouteConnectionVisual
                origin="Seu ponto de partida (ex.: Aldeota, Messejana...)"
                destination="Centro de Eventos do Ceará • STS 2026"
                className="shadow-card"
              />

              {/* Card Rápido de Contexto */}
              <div className="rounded-3xl border border-border bg-card/80 p-5 shadow-soft backdrop-blur-sm sm:p-6">
                <div className="flex items-center justify-between gap-3 border-b border-border pb-4">
                  <div className="flex items-center gap-3">
                    <img src={logoAsset.url} alt="CARONAA" className="h-9 w-auto object-contain" />
                    <div>
                      <p className="text-xs font-bold uppercase tracking-wider text-primary">
                        Comunidade Ativa
                      </p>
                      <p className="text-xs text-muted-foreground">Fortaleza & Região</p>
                    </div>
                  </div>
                  <BrandBadge variant="unifor" />
                </div>

                <div className="mt-4 grid grid-cols-2 gap-3 text-left">
                  <div className="rounded-2xl bg-secondary/60 p-3">
                    <p className="text-[11px] font-medium text-muted-foreground">Para quem vai</p>
                    <p className="text-sm font-bold text-foreground">Companhia & Conexão</p>
                  </div>
                  <div className="rounded-2xl bg-secondary/60 p-3">
                    <p className="text-[11px] font-medium text-muted-foreground">Para quem leva</p>
                    <p className="text-sm font-bold text-foreground">Assentos ocupados</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Faixa Institucional de Parcerias */}
      <InstitutionalPartnershipStrip />

      {/* =========================================================================
          SEÇÃO EVENTO: CARONAA no Siará Tech Summit
      ========================================================================= */}
      <section
        id="siara-tech-summit"
        className="bg-caronaa-dark py-16 text-white sm:py-24 scroll-mt-20"
      >
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid gap-12 lg:grid-cols-2 lg:items-center">
            {/* Lado Esquerdo: Imagem / Banner do STS */}
            <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-white/5 shadow-2xl">
              <img
                src={stsBannerAsset}
                alt="CARONAA Startup Expositora no Siará Tech Summit 2026"
                loading="lazy"
                decoding="async"
                className="h-full max-h-[500px] w-full object-cover object-center"
              />
              <div className="absolute inset-0 bg-linear-to-t from-black/80 via-transparent to-transparent" />
              <div className="absolute bottom-4 left-4 right-4 rounded-2xl bg-black/60 p-4 backdrop-blur-md">
                <p className="text-xs font-bold uppercase tracking-widest text-event-cyan">
                  07 a 09 OUT • Centro de Eventos do Ceará
                </p>
                <p className="mt-1 text-sm font-semibold text-white">
                  Visite nosso stand e participe dos testes ao vivo!
                </p>
              </div>
            </div>

            {/* Lado Direito: Conteúdo e CTA */}
            <div className="flex flex-col items-start space-y-6">
              <div className="inline-flex items-center gap-2 rounded-full border border-event-cyan/30 bg-white/10 px-3.5 py-1.5 text-xs font-bold text-event-cyan backdrop-blur-md">
                <Sparkles size={14} />
                <span>Edição Especial de Lançamento</span>
              </div>

              <h2 className="font-display text-3xl font-black text-white sm:text-5xl">
                CARONAA no Siará Tech Summit
              </h2>

              <p className="text-lg font-bold text-event-cyan">
                De 07 a 09 de outubro | Centro de Eventos do Ceará
              </p>

              <p className="text-base leading-relaxed text-white/85 sm:text-lg">
                Estamos levando a CARONAA para o Siará Tech Summit para testar o produto em
                situações reais. Você poderá se cadastrar, oferecer ou procurar caronas para o
                evento e nos ajudar a construir a solução.
              </p>

              <div className="pt-2">
                <Button
                  asChild
                  variant="strong"
                  size="lg"
                  className="h-14 rounded-2xl px-8 text-base font-extrabold shadow-glow-primary"
                >
                  <Link to="/formulario">
                    Quero participar <ArrowRight size={18} />
                  </Link>
                </Button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* =========================================================================
          SEÇÃO COMO FUNCIONA (3 Passos Claros e Modernos)
      ========================================================================= */}
      <section className="bg-background py-16 sm:py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-xs font-bold uppercase tracking-widest text-primary">
              Passo a Passo Simples
            </p>
            <h2 className="mt-3 font-display text-3xl font-extrabold text-foreground sm:text-4xl">
              Como funciona a CARONAA?
            </h2>
            <p className="mt-4 text-sm leading-relaxed text-muted-foreground sm:text-base">
              Desenvolvemos uma experiência ágil para aproximar rotas compatíveis de forma
              previsível e segura.
            </p>
          </div>

          <div className="mt-14 grid gap-8 sm:grid-cols-3">
            {[
              {
                step: "1",
                title: "Conte para onde você vai.",
                description:
                  "Informe de onde sai, para onde precisa ir e a sua faixa de horário pretendida no evento ou no dia a dia.",
                icon: MapPin,
              },
              {
                step: "2",
                title: "A CARONAA procura trajetos compatíveis.",
                description:
                  "Comparamos itinerários e proximidades de quem precisa de carona e de quem já vai realizar aquele mesmo percurso.",
                icon: RouteIcon,
              },
              {
                step: "3",
                title: "Você avalia a combinação e decide se quer seguir.",
                description:
                  "Receba os detalhes do trajeto, combine os pontos de encontro e confirme se faz sentido para a sua rotina.",
                icon: CheckCircle2,
              },
            ].map(({ step, title, description, icon: Icon }) => (
              <div
                key={step}
                className="group relative flex flex-col rounded-3xl border border-border bg-card p-7 shadow-soft transition-all hover:-translate-y-1 hover:shadow-card sm:p-8"
              >
                <div className="flex items-center justify-between">
                  <span className="flex size-12 items-center justify-center rounded-2xl bg-caronaa-primary text-caronaa-dark font-display text-xl font-black">
                    {step}
                  </span>
                  <Icon className="size-6 text-muted-foreground transition-colors group-hover:text-primary" />
                </div>
                <h3 className="mt-6 font-display text-xl font-bold text-foreground">{title}</h3>
                <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{description}</p>
              </div>
            ))}
          </div>

          <div className="mt-12 text-center">
            <Button asChild variant="outline" size="lg" className="rounded-2xl font-bold">
              <Link to="/como-funciona">
                Ver detalhes de como funciona <ArrowRight size={16} />
              </Link>
            </Button>
          </div>
        </div>
      </section>

      {/* =========================================================================
          SEÇÃO DOIS LADOS: Motorista & Passageiro
      ========================================================================= */}
      <section className="bg-secondary/40 py-16 sm:py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="font-display text-3xl font-extrabold text-foreground sm:text-4xl">
              Feito para os dois lados do trajeto
            </h2>
            <p className="mt-3 text-sm text-muted-foreground sm:text-base">
              Aproveite os assentos ociosos do seu carro ou encontre alguém que já vai pelo mesmo
              caminho.
            </p>
          </div>

          <div className="mt-12 grid gap-8 md:grid-cols-2">
            {/* Card Motorista */}
            <div className="flex flex-col justify-between rounded-3xl border border-border bg-card p-8 shadow-soft sm:p-10">
              <div className="space-y-4">
                <span className="inline-flex size-12 items-center justify-center rounded-2xl bg-primary/15 text-primary">
                  <CarFront size={28} />
                </span>
                <h3 className="font-display text-2xl font-bold text-foreground">
                  🚗 Tem lugar no carro?
                </h3>
                <p className="text-base leading-relaxed text-muted-foreground">
                  Compartilhe seu trajeto e encontre pessoas que precisam ir pelo mesmo caminho.
                </p>
              </div>
              <div className="pt-8">
                <Button
                  asChild
                  variant="strong"
                  size="lg"
                  className="w-full rounded-2xl font-bold sm:w-auto"
                >
                  <Link to="/formulario">
                    Quero oferecer <ArrowRight size={16} />
                  </Link>
                </Button>
              </div>
            </div>

            {/* Card Passageiro */}
            <div className="flex flex-col justify-between rounded-3xl border border-border bg-card p-8 shadow-soft sm:p-10">
              <div className="space-y-4">
                <span className="inline-flex size-12 items-center justify-center rounded-2xl bg-secondary text-primary">
                  <UsersRound size={28} />
                </span>
                <h3 className="font-display text-2xl font-bold text-foreground">
                  🙋 Precisa de uma carona?
                </h3>
                <p className="text-base leading-relaxed text-muted-foreground">
                  Conte seu trajeto e encontre pessoas que já estão indo naquela direção.
                </p>
              </div>
              <div className="pt-8">
                <Button
                  asChild
                  variant="default"
                  size="lg"
                  className="w-full rounded-2xl font-bold sm:w-auto"
                >
                  <Link to="/formulario">
                    Quero encontrar <ArrowRight size={16} />
                  </Link>
                </Button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* =========================================================================
          SEÇÃO VALIDAÇÃO (Transparência, MVP Real, Pessoas Reais)
      ========================================================================= */}
      <section className="bg-background py-16 sm:py-24">
        <div className="mx-auto max-w-4xl px-4 text-center sm:px-6 lg:px-8">
          <BrandBadge variant="validation" className="mb-4" />

          <h2 className="font-display text-3xl font-extrabold text-foreground sm:text-5xl">
            Estamos construindo a CARONAA com pessoas reais.
          </h2>

          <p className="mx-auto mt-6 max-w-2xl text-base leading-relaxed text-muted-foreground sm:text-lg">
            Este é um MVP em fase de validação. Cada cadastro, carona realizada e feedback nos ajuda
            a entender se estamos resolvendo um problema real.
          </p>

          <div className="mt-8 rounded-3xl border border-border/80 bg-card p-8 shadow-soft sm:p-10">
            <h3 className="font-display text-2xl font-bold text-foreground">
              Quer fazer parte desde o começo?
            </h3>
            <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
              Preencha nosso formulário do Siará Tech Summit e ajude a validar a mobilidade
              compartilhada em Fortaleza.
            </p>
            <div className="mt-6 flex justify-center">
              <Button
                asChild
                variant="strong"
                size="lg"
                className="h-14 rounded-2xl px-10 text-base font-extrabold shadow-card"
              >
                <Link to="/formulario">
                  🚗 Participar da validação no Siará <ArrowUpRight size={18} />
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </section>
    </AppShell>
  );
}
