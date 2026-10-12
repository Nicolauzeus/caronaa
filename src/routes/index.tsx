import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import {
  ArrowRight,
  ArrowUpRight,
  Calendar,
  CarFront,
  CheckCircle2,
  Clock,
  Compass,
  FileCheck2,
  HeartHandshake,
  Lock,
  MapPin,
  Navigation,
  QrCode,
  Radio,
  Route as RouteIcon,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  UserCheck2,
  UsersRound,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/caronaa/AppShell";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth-context";
import { getCampaignAttribution, trackFunnelEvent } from "@/lib/funnel-events";
import {
  BrandBadge,
  CaronaaSymbol,
  InstitutionalPartnershipStrip,
} from "@/components/caronaa/BrandElements";
import logoAsset from "@/assets/brand/caronaa-logo.png.asset.json";
import caronaaHeroAsset from "@/assets/caronaa-hero.jpg";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "CARONAA — Conecte quem precisa ir com quem já está indo" },
      {
        name: "description",
        content:
          "A CARONAA conecta pessoas que precisam fazer um trajeto com quem já vai pelo mesmo caminho e tem assento disponível no carro. Mobilidade colaborativa com validação real.",
      },
      {
        property: "og:title",
        content: "CARONAA — Conecte quem precisa ir com quem já está indo",
      },
      {
        property: "og:description",
        content:
          "Encontre uma carona para o seu trajeto ou compartilhe os assentos vagos do seu carro. Menos trânsito, custos divididos e segurança verificada.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: LandingPage,
});

function LandingPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [enrollmentCount, setEnrollmentCount] = useState<number | null>(null);
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

  useEffect(() => {
    if (user) void navigate({ to: "/home" });
  }, [navigate, user]);

  useEffect(() => {
    void (supabase as any)
      .rpc("get_public_enrollment_count")
      .then(({ data }: { data: number | null }) => setEnrollmentCount(data ?? null));
  }, []);

  return (
    <AppShell publicPage>
      {/* =========================================================================
          1. HERO SECTION EDITORIAL COM IMAGEM MARCANTE & AÇÕES DIRETAS
      ========================================================================= */}
      <section className="relative overflow-hidden bg-background pt-6 pb-16 sm:pt-12 sm:pb-24 border-b border-border/60">
        {/* Glow de fundo sutil com tokens semânticos */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -top-32 left-1/2 -z-10 size-[700px] -translate-x-1/2 rounded-full bg-primary/10 blur-3xl opacity-70"
        />

        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid gap-12 lg:grid-cols-[1.15fr_0.85fr] lg:items-center">
            {/* Coluna 1: Tipografia Editorial, Badge e CTAs */}
            <div className="flex flex-col items-start text-left">
              {/* Título Curto & Editorial (Sora) */}
              <h1 className="font-display text-4xl font-black tracking-tight text-foreground sm:text-5xl lg:text-6xl lg:leading-[1.1]">
                Conecte quem precisa ir com quem já está indo.
              </h1>

              {/* Mensagem Clara de Benefício (Manrope) */}
              <p className="mt-5 max-w-xl text-base leading-relaxed text-muted-foreground sm:text-lg">
                A CARONAA aproxima rotas de quem busca carona com motoristas que têm assentos
                disponíveis. Divida custos de deslocamento, diminua o estresse do trânsito e viaje
                em companhia na sua comunidade.
              </p>

              {/* Ações Hero: Pedir carona & Oferecer carona */}
              <div className="mt-8 flex w-full flex-col gap-3.5 sm:w-auto sm:flex-row sm:items-center">
                <Button
                  asChild
                  variant="strong"
                  size="lg"
                  className="h-14 w-full rounded-2xl px-8 text-base font-extrabold shadow-card card-hover-lift sm:w-auto"
                >
                  <Link to="/auth" search={{ mode: "cadastro" }}>
                    🙋 Pedir carona <ArrowRight size={18} className="ml-1" />
                  </Link>
                </Button>

                <Button
                  asChild
                  variant="outline"
                  size="lg"
                  className="h-14 w-full rounded-2xl border-border/90 bg-card px-8 text-base font-bold shadow-soft card-hover-lift sm:w-auto"
                >
                  <Link to="/auth" search={{ mode: "cadastro" }}>
                    🚗 Oferecer carona
                  </Link>
                </Button>
              </div>

              {/* Link Secundário de Login */}
              <div className="mt-4 flex flex-wrap items-center gap-4 text-xs font-semibold text-muted-foreground">
                <Link
                  to="/auth"
                  className="inline-flex items-center gap-1.5 text-foreground hover:text-primary transition-colors underline underline-offset-4"
                >
                  Já tenho cadastro • Fazer login
                </Link>
                {enrollmentCount !== null && (
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted/40 px-3 py-1 font-bold text-foreground">
                    <UsersRound size={14} className="text-primary" /> {enrollmentCount} pessoas já
                    cadastradas
                  </span>
                )}
              </div>
            </div>

            {/* Coluna 2: Fotografia Autêntica & Card Visual de Trajeto */}
            <div className="relative flex flex-col gap-5">
              {/* Moldura da Fotografia com Composição Editorial */}
              <div className="relative overflow-hidden rounded-3xl border border-border/80 bg-card shadow-2xl">
                <div className="aspect-[4/3] w-full overflow-hidden bg-muted">
                  <img
                    src={caronaaHeroAsset}
                    alt="Pessoas compartilhando uma viagem no carro com a CARONAA"
                    className="h-full w-full object-cover object-center transition-transform duration-700 hover:scale-105"
                    loading="eager"
                  />
                </div>

                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent pointer-events-none" />

                {/* Badge Flutuante sobre a Foto */}
                <div className="absolute top-4 right-4 rounded-xl bg-black/70 px-3 py-1.5 text-[11px] font-bold text-white backdrop-blur-md border border-white/15">
                  Mobilidade urbana real
                </div>

                {/* Rodapé da Imagem com Chamada Institucional */}
                <div className="absolute bottom-4 left-4 right-4 rounded-2xl bg-black/75 p-4 backdrop-blur-md border border-white/10 text-white">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <img
                        src={logoAsset.url}
                        alt="CARONAA"
                        className="h-6 w-auto object-contain brightness-0 invert"
                      />
                      <div>
                        <p className="text-xs font-bold leading-tight">
                          Rotas inteligentes em Fortaleza
                        </p>
                        <p className="text-[11px] text-white/70">
                          Assentos livres encontram passageiros
                        </p>
                      </div>
                    </div>
                    <span className="flex size-2 rounded-full bg-primary animate-ping" />
                  </div>
                </div>
              </div>

              {/* Card Ilustrativo de Conexão com Trajeto em SVG Animado */}
              <div className="rounded-3xl border border-border bg-card/90 p-5 shadow-soft backdrop-blur-sm card-hover-lift">
                <div className="flex items-center justify-between border-b border-border/70 pb-3">
                  <span className="text-[11px] font-extrabold tracking-wider uppercase text-primary">
                    Trajeto Conectado
                  </span>
                  <span className="rounded-full bg-secondary px-2.5 py-0.5 text-[10px] font-bold text-muted-foreground">
                    Exemplo de rota
                  </span>
                </div>

                <div className="mt-4 flex items-start gap-4">
                  {/* Trilha do Trajeto Animada */}
                  <div className="flex flex-col items-center pt-1 shrink-0">
                    <span className="size-3.5 rounded-full border-2 border-primary bg-background shadow-xs" />
                    <svg className="my-1 h-10 w-2 overflow-visible" aria-hidden="true">
                      <line
                        x1="4"
                        y1="0"
                        x2="4"
                        y2="40"
                        stroke="currentColor"
                        strokeWidth="2"
                        className="text-primary animate-route-dash"
                      />
                    </svg>
                    <span className="size-3.5 rounded-full bg-foreground border-2 border-primary" />
                  </div>

                  <div className="flex flex-1 flex-col justify-between gap-3 text-left min-w-0">
                    <div>
                      <p className="text-[10px] font-bold tracking-wider text-muted-foreground uppercase">
                        Ponto de partida / Encontro
                      </p>
                      <p className="text-sm font-bold text-foreground truncate">
                        Aldeota • Praça Luíza Távora
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold tracking-wider text-primary uppercase">
                        Destino compartilhado
                      </p>
                      <p className="text-sm font-bold text-foreground truncate">Fortaleza, Ceará</p>
                    </div>
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
          2. SEÇÃO COMO FUNCIONA (4 ETAPAS CLARAS E MODERNAS)
      ========================================================================= */}
      <section className="bg-background py-16 sm:py-24 border-b border-border/60">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-bold text-foreground">
              <Sparkles size={13} className="text-primary" /> Fluxo Transparente
            </span>
            <h2 className="mt-3 font-display text-3xl font-extrabold text-foreground sm:text-4xl">
              Como funciona a CARONAA
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground sm:text-base">
              Desenvolvemos um ciclo previsível e seguro para que você viaje com tranquilidade do
              início ao fim.
            </p>
          </div>

          <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {[
              {
                step: "01",
                title: "Publicar",
                subtitle: "Defina seu itinerário",
                description:
                  "Motoristas anunciam os assentos disponíveis no veículo e passageiros solicitam carona para o seu destino com faixas de horário.",
                icon: MapPin,
              },
              {
                step: "02",
                title: "Encontrar combinação",
                subtitle: "Rotas compatíveis",
                description:
                  "O sistema analisa itinerários, tolerância de tempo e proximidade geográfica para conectar quem já vai na mesma direção.",
                icon: RouteIcon,
              },
              {
                step: "03",
                title: "Ambos aceitar",
                subtitle: "Confirmação bilateral",
                description:
                  "A viagem só se torna confirmada quando as duas pessoas aprovam a proposta. Nenhuma carona é imposta sem consentimento mútuo.",
                icon: CheckCircle2,
              },
              {
                step: "04",
                title: "Acompanhar viagem",
                subtitle: "Tempo real e embarque",
                description:
                  "Acompanhe a localização consentida no mapa, valide o embarque via PIN de segurança ou QR Code e viaje com previsibilidade.",
                icon: Radio,
              },
            ].map(({ step, title, subtitle, description, icon: Icon }) => (
              <div
                key={step}
                className="group relative flex flex-col justify-between rounded-3xl border border-border bg-card p-6 shadow-soft card-hover-lift sm:p-7"
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span className="flex size-11 items-center justify-center rounded-2xl bg-primary text-primary-foreground font-display text-base font-black shadow-xs">
                      {step}
                    </span>
                    <Icon className="size-6 text-muted-foreground transition-colors group-hover:text-primary" />
                  </div>
                  <h3 className="mt-5 font-display text-lg font-bold text-foreground">{title}</h3>
                  <p className="text-xs font-semibold text-primary">{subtitle}</p>
                  <p className="mt-2.5 text-xs sm:text-sm leading-relaxed text-muted-foreground">
                    {description}
                  </p>
                </div>

                <div className="mt-5 pt-3 border-t border-border/50 text-[11px] font-bold text-muted-foreground flex items-center gap-1">
                  <span>Passo {step} do fluxo</span>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-12 text-center">
            <Button asChild variant="outline" size="lg" className="rounded-2xl font-bold">
              <Link to="/como-funciona">
                Ver detalhes completos do fluxo <ArrowRight size={16} />
              </Link>
            </Button>
          </div>
        </div>
      </section>

      {/* =========================================================================
          3. DEMONSTRAÇÃO VISUAL DO MATCHING E DO ACOMPANHAMENTO (ILUSTRATIVA)
      ========================================================================= */}
      <section className="bg-secondary/30 py-16 sm:py-24 border-b border-border/60">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <div className="inline-flex items-center gap-2 rounded-full border border-amber-500/30 bg-amber-500/10 px-3.5 py-1 text-xs font-bold text-amber-600 dark:text-amber-400">
              <span>⚠️ Demonstração ilustrativa com simulação de rota</span>
            </div>
            <h2 className="mt-3 font-display text-3xl font-extrabold text-foreground sm:text-4xl">
              Experiência de combinação e rastreamento
            </h2>
            <p className="mt-3 text-sm text-muted-foreground sm:text-base">
              Veja como motoristas e passageiros visualizam a compatibilidade de rotas e acompanham
              o percurso em tempo real.
            </p>
          </div>

          <div className="mt-12 grid gap-8 lg:grid-cols-2">
            {/* Card Demonstrativo 1: Matching Inteligente */}
            <div className="rounded-3xl border border-border bg-card p-6 sm:p-8 shadow-soft flex flex-col justify-between card-hover-lift">
              <div>
                <div className="flex items-center justify-between border-b border-border pb-4">
                  <div className="flex items-center gap-3">
                    <span className="flex size-10 items-center justify-center rounded-xl bg-primary/15 text-primary">
                      <RouteIcon size={20} />
                    </span>
                    <div>
                      <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                        Etapa 2 • Simulação
                      </p>
                      <h3 className="font-display text-base font-extrabold text-foreground">
                        Combinação Encontrada
                      </h3>
                    </div>
                  </div>
                  <span className="rounded-full bg-primary/20 px-3 py-1 text-xs font-black text-foreground">
                    94% Compatível
                  </span>
                </div>

                <div className="mt-5 space-y-3.5 text-xs">
                  <div className="rounded-2xl bg-muted/40 p-4 border border-border/60 space-y-2">
                    <div className="flex justify-between items-center text-muted-foreground">
                      <span>Origem do motorista:</span>
                      <strong className="text-foreground">Aldeota (a 350m do passageiro)</strong>
                    </div>
                    <div className="flex justify-between items-center text-muted-foreground">
                      <span>Destino em comum:</span>
                      <strong className="text-foreground">Centro de Eventos do Ceará</strong>
                    </div>
                    <div className="flex justify-between items-center text-muted-foreground">
                      <span>Horário previsto:</span>
                      <strong className="text-foreground">
                        Hoje às 08:30 (±15 min tolerância)
                      </strong>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-primary/30 bg-primary/5 p-4 flex items-center justify-between">
                    <div>
                      <p className="text-[11px] font-semibold text-muted-foreground">
                        Contribuição calculada
                      </p>
                      <p className="text-base font-extrabold text-foreground">
                        R$ 6,50 por passageiro
                      </p>
                    </div>
                    <span className="text-xs font-bold text-primary">Economia mútua</span>
                  </div>
                </div>
              </div>

              <div className="mt-6 pt-4 border-t border-border flex items-center justify-between text-xs text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <CheckCircle2 size={14} className="text-success" /> Proposta pronta para aceite
                  bilateral
                </span>
                <span className="font-semibold text-foreground">Simulação ilustrativa</span>
              </div>
            </div>

            {/* Card Demonstrativo 2: Acompanhamento em Tempo Real */}
            <div className="rounded-3xl border border-border bg-card p-6 sm:p-8 shadow-soft flex flex-col justify-between card-hover-lift">
              <div>
                <div className="flex items-center justify-between border-b border-border pb-4">
                  <div className="flex items-center gap-3">
                    <span className="flex size-10 items-center justify-center rounded-xl bg-primary/15 text-primary">
                      <Navigation size={20} />
                    </span>
                    <div>
                      <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                        Etapa 4 • Simulação
                      </p>
                      <h3 className="font-display text-base font-extrabold text-foreground">
                        Acompanhamento da Viagem
                      </h3>
                    </div>
                  </div>
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-3 py-1 text-xs font-bold text-emerald-600 dark:text-emerald-400">
                    <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" /> Ao vivo
                  </span>
                </div>

                <div className="mt-5 space-y-3 text-xs">
                  {/* Etapas do Ciclo */}
                  <div className="grid grid-cols-5 gap-1 text-center font-bold text-[10px]">
                    <div className="rounded bg-muted py-1.5 text-muted-foreground">Confirmada</div>
                    <div className="rounded bg-primary text-primary-foreground py-1.5">
                      A caminho
                    </div>
                    <div className="rounded bg-muted py-1.5 text-muted-foreground">Embarque</div>
                    <div className="rounded bg-muted py-1.5 text-muted-foreground">Em viagem</div>
                    <div className="rounded bg-muted py-1.5 text-muted-foreground">Concluída</div>
                  </div>

                  <div className="rounded-2xl border border-border/80 bg-muted/30 p-4 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-foreground flex items-center gap-1.5">
                        <CarFront size={14} className="text-primary" /> Motorista Lucas
                      </span>
                      <span className="text-[11px] font-mono text-muted-foreground">
                        Atualizado há 15s • Precisão ±12m
                      </span>
                    </div>
                    <div className="flex justify-between items-center text-muted-foreground">
                      <span>Distância até o encontro:</span>
                      <strong className="text-foreground">1,2 km (~4 min estimados)</strong>
                    </div>
                    <div className="flex justify-between items-center text-muted-foreground">
                      <span>Ponto de encontro:</span>
                      <strong className="text-foreground">Av. Santos Dumont, 3100</strong>
                    </div>
                  </div>

                  <div className="rounded-xl border border-border/60 bg-background/60 p-3 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Lock size={14} className="text-primary" />
                      <span className="font-medium">Código de Embarque</span>
                    </div>
                    <span className="font-mono font-bold tracking-widest text-sm bg-muted px-2 py-0.5 rounded">
                      4829 1054
                    </span>
                  </div>
                </div>
              </div>

              <div className="mt-6 pt-4 border-t border-border flex items-center justify-between text-xs text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <ShieldCheck size={14} className="text-primary" /> Localização autorizada
                  explicitamente
                </span>
                <span className="font-semibold text-foreground">Simulação ilustrativa</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* =========================================================================
          4. SEÇÃO BENEFÍCIOS REAIS DE COMPARTILHAR
      ========================================================================= */}
      <section className="bg-background py-16 sm:py-24 border-b border-border/60">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-bold text-foreground">
              <TrendingUp size={13} className="text-primary" /> Vantagens Reais
            </span>
            <h2 className="mt-3 font-display text-3xl font-extrabold text-foreground sm:text-4xl">
              Por que compartilhar viagens?
            </h2>
            <p className="mt-3 text-sm text-muted-foreground sm:text-base">
              Benefícios práticos e mensuráveis para quem oferece e para quem precisa de transporte.
            </p>
          </div>

          <div className="mt-14 grid gap-8 md:grid-cols-3">
            <div className="rounded-3xl border border-border bg-card p-8 shadow-soft card-hover-lift space-y-4">
              <div className="flex size-12 items-center justify-center rounded-2xl bg-primary/15 text-primary">
                <CarFront size={24} />
              </div>
              <h3 className="font-display text-xl font-bold text-foreground">
                Divisão transparente de custos
              </h3>
              <p className="text-sm leading-relaxed text-muted-foreground">
                Combustível e estacionamento são rateados de forma justa e automática pelo sistema
                entre os participantes da viagem, sem surpresas.
              </p>
            </div>

            <div className="rounded-3xl border border-border bg-card p-8 shadow-soft card-hover-lift space-y-4">
              <div className="flex size-12 items-center justify-center rounded-2xl bg-primary/15 text-primary">
                <Compass size={24} />
              </div>
              <h3 className="font-display text-xl font-bold text-foreground">
                Menos trânsito e vagas ocupadas
              </h3>
              <p className="text-sm leading-relaxed text-muted-foreground">
                Cada carro com assentos ocupados representa menos um veículo congestionando avenidas
                e disputando vagas em polos universitários e eventos.
              </p>
            </div>

            <div className="rounded-3xl border border-border bg-card p-8 shadow-soft card-hover-lift space-y-4">
              <div className="flex size-12 items-center justify-center rounded-2xl bg-primary/15 text-primary">
                <HeartHandshake size={24} />
              </div>
              <h3 className="font-display text-xl font-bold text-foreground">
                Conexão entre pessoas reais
              </h3>
              <p className="text-sm leading-relaxed text-muted-foreground">
                Transforme tempo ocioso e rotas solitárias em oportunidades de convivência segura
                com pessoas da sua própria comunidade ou faculdade.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* =========================================================================
          5. SEÇÃO SEGURANÇA E PRIVACIDADE RÍGIDA
      ========================================================================= */}
      <section className="bg-secondary/30 py-16 sm:py-24 border-b border-border/60">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-bold text-foreground">
              <ShieldCheck size={13} className="text-primary" /> Compromisso com Proteção
            </span>
            <h2 className="mt-3 font-display text-3xl font-extrabold text-foreground sm:text-4xl">
              Segurança e privacidade em primeiro lugar
            </h2>
            <p className="mt-3 text-sm text-muted-foreground sm:text-base">
              Estrutura técnica desenhada para resguardar a identidade e a localização de cada
              participante.
            </p>
          </div>

          <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-2xl border border-border bg-card p-6 shadow-soft space-y-3">
              <UserCheck2 className="size-6 text-primary" />
              <h3 className="font-display text-base font-bold text-foreground">Aceite bilateral</h3>
              <p className="text-xs leading-relaxed text-muted-foreground">
                A carona só é confirmada após aprovação explícita de motorista e passageiro. Você
                decide se a combinação faz sentido.
              </p>
            </div>

            <div className="rounded-2xl border border-border bg-card p-6 shadow-soft space-y-3">
              <QrCode className="size-6 text-primary" />
              <h3 className="font-display text-base font-bold text-foreground">
                PIN e QR de embarque
              </h3>
              <p className="text-xs leading-relaxed text-muted-foreground">
                O trajeto só inicia no sistema quando o código de segurança do passageiro é validado
                no momento do encontro físico.
              </p>
            </div>

            <div className="rounded-2xl border border-border bg-card p-6 shadow-soft space-y-3">
              <Lock className="size-6 text-primary" />
              <h3 className="font-display text-base font-bold text-foreground">
                Localização restrita
              </h3>
              <p className="text-xs leading-relaxed text-muted-foreground">
                A posição nunca é pública. Somente participantes autenticados daquela viagem ativa
                têm acesso temporário às coordenadas.
              </p>
            </div>

            <div className="rounded-2xl border border-border bg-card p-6 shadow-soft space-y-3">
              <FileCheck2 className="size-6 text-primary" />
              <h3 className="font-display text-base font-bold text-foreground">Limpeza imediata</h3>
              <p className="text-xs leading-relaxed text-muted-foreground">
                Ao concluir, cancelar ou revogar o compartilhamento, os dados de geolocalização são
                imediatamente removidos do banco.
              </p>
            </div>
          </div>

          <div className="mt-8 text-center">
            <Link
              to="/seguranca"
              className="text-xs font-bold text-foreground hover:text-primary transition underline underline-offset-4"
            >
              Conheça nossas diretrizes completas de segurança na plataforma →
            </Link>
          </div>
        </div>
      </section>

      {/* =========================================================================
          7. CHAMADA FINAL EDITORIAL PARA COMEÇAR
      ========================================================================= */}
      <section className="bg-background py-16 sm:py-24">
        <div className="mx-auto max-w-4xl px-4 text-center sm:px-6 lg:px-8">
          <BrandBadge variant="validation" className="mb-4" />

          <h2 className="font-display text-3xl font-extrabold text-foreground sm:text-5xl">
            Pronto para compartilhar caminhos?
          </h2>

          <p className="mx-auto mt-6 max-w-2xl text-base leading-relaxed text-muted-foreground sm:text-lg">
            Seja oferecendo um lugar vazio no carro ou encontrando alguém que já vai pelo mesmo
            caminho, a CARONAA foi feita para tornar sua rota mais conectada, econômica e tranquila.
          </p>

          <div className="mt-8 rounded-3xl border border-border bg-card p-8 shadow-soft sm:p-10 card-hover-lift">
            <h3 className="font-display text-2xl font-bold text-foreground">Comece agora mesmo</h3>
            <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
              Preencha seu trajeto e descubra combinações compatíveis na sua rota.
            </p>

            <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4">
              <Button
                asChild
                variant="strong"
                size="lg"
                className="h-14 w-full sm:w-auto rounded-2xl px-10 text-base font-extrabold shadow-card"
              >
                <Link to="/auth" search={{ mode: "cadastro" }}>
                  🙋 Pedir carona <ArrowRight size={18} className="ml-1" />
                </Link>
              </Button>

              <Button
                asChild
                variant="outline"
                size="lg"
                className="h-14 w-full sm:w-auto rounded-2xl px-10 text-base font-bold shadow-soft"
              >
                <Link to="/auth" search={{ mode: "cadastro" }}>
                  🚗 Oferecer carona
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </section>
    </AppShell>
  );
}
