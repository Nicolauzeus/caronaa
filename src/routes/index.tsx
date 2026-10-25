import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowRight, CarFront, CheckCircle2, Clock3, Leaf, MapPin, Route as RouteIcon, UsersRound, Wallet } from "lucide-react";
import { useEffect, useMemo } from "react";
import { AppShell } from "@/components/caronaa/AppShell";
import { Brand } from "@/components/caronaa/AppShell";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth-context";
import { getCampaignAttribution, trackFunnelEvent } from "@/lib/funnel-events";
import caronaaHeroAsset from "@/assets/caronaa-hero.jpg";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "CARONAA — Mais pessoas na mesma direção" },
      { name: "description", content: "Encontre pessoas com rotas parecidas, compartilhe assentos e divida os custos do seu trajeto com a CARONAA." },
      { property: "og:title", content: "CARONAA — Mais pessoas na mesma direção" },
      { property: "og:description", content: "Peça ou ofereça caronas com pessoas que fazem trajetos parecidos." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: LandingPage,
});

const benefits = [
  { icon: Wallet, title: "Reduza seus custos", description: "Compartilhe as despesas de uma viagem que já faz parte da sua rotina." },
  { icon: UsersRound, title: "Aproveite vagas ociosas", description: "Conecte assentos disponíveis a pessoas que vão na mesma direção." },
  { icon: Clock3, title: "Mais praticidade", description: "Procure trajetos compatíveis com seus horários e pontos de encontro." },
  { icon: Leaf, title: "Menor impacto urbano", description: "Compartilhar veículos pode ajudar a reduzir carros nas ruas." },
];

function LandingPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const attribution = useMemo(
    () => getCampaignAttribution({ defaultSource: "direct", defaultCampaignEvent: "Site" }),
    [],
  );

  useEffect(() => {
    void trackFunnelEvent({
      eventName: "landing_view",
      userId: user?.id ?? null,
      ...attribution,
      metadata: { surface: "home" },
    });
  }, [attribution, user?.id]);

  useEffect(() => {
    if (user) void navigate({ to: "/home" });
  }, [navigate, user]);

  return (
    <AppShell publicPage>
      <section aria-labelledby="landing-heading" className="relative isolate overflow-hidden bg-[#111111] text-white">
        <img src={caronaaHeroAsset} alt="" aria-hidden="true" className="absolute inset-0 -z-20 h-full w-full object-cover opacity-45" />
        <div aria-hidden="true" className="absolute inset-0 -z-10 bg-gradient-to-r from-black/95 via-black/75 to-black/25" />
        <div className="mx-auto max-w-7xl px-5 pb-16 pt-14 sm:px-8 sm:py-20 lg:py-28">
          <div className="max-w-2xl">
            <p className="mb-5 text-xs font-extrabold uppercase tracking-[.2em] text-[#f6be49]">
              Viagens compartilhadas. Mais possibilidades.
            </p>
            <h1 id="landing-heading" className="font-display text-4xl font-black leading-[1.12] tracking-tight sm:text-5xl lg:text-6xl">
              Mais pessoas na mesma direção, <span className="text-[#ffc451]">vamos mais longe.</span>
            </h1>
            <p className="mt-6 max-w-xl text-base leading-7 text-white/85 sm:text-lg">
              Conectamos pessoas com rotas parecidas para tornar o deslocamento mais econômico, humano e sustentável.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Button asChild variant="strong" size="lg" className="min-h-12 rounded-xl px-6 font-bold">
                <Link to="/auth" search={{ mode: "cadastro" }}>Encontrar minha carona <ArrowRight size={18} /></Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="min-h-12 rounded-xl border-white/60 bg-black/50 px-6 font-bold text-white hover:bg-white hover:text-black">
                <a href="#como-funciona">Como funciona</a>
              </Button>
            </div>
            <p className="mt-5 text-sm text-white/70">
              Já tem conta? <Link to="/auth" className="font-bold text-[#ffc451] underline underline-offset-4">Entre aqui</Link>
            </p>
          </div>
        </div>
      </section>

      <section aria-label="Vantagens de compartilhar caronas" id="vantagens" className="relative mx-auto -mt-6 grid max-w-7xl gap-3 px-4 sm:grid-cols-2 sm:px-8 lg:grid-cols-4">
        {benefits.map(({ icon: Icon, title, description }) => (
          <article key={title} className="rounded-2xl border border-border bg-card p-5 shadow-lg">
            <span className="flex size-11 items-center justify-center rounded-xl bg-primary/15 text-primary"><Icon size={23} /></span>
            <h2 className="mt-4 text-base font-extrabold">{title}</h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">{description}</p>
          </article>
        ))}
      </section>

      <section id="como-funciona" aria-labelledby="steps-heading" className="scroll-mt-24 bg-background px-5 py-16 sm:py-24">
        <div className="mx-auto max-w-7xl">
          <p className="text-center text-xs font-extrabold uppercase tracking-widest text-primary">Simples e direto</p>
          <h2 id="steps-heading" className="mt-2 text-center font-display text-3xl font-extrabold sm:text-4xl">Como funciona a CARONAA?</h2>
          <div className="mt-10 grid gap-4 md:grid-cols-3">
            {[
              { n: "01", icon: MapPin, title: "Informe sua rota", description: "Defina origem, destino e o horário em que pretende sair." },
              { n: "02", icon: UsersRound, title: "Encontre pessoas", description: "Veja possibilidades de carona com trajetos e horários compatíveis." },
              { n: "03", icon: CheckCircle2, title: "Confirme e viaje", description: "Solicite ou ofereça a carona, confirme os detalhes e acompanhe o trajeto." },
            ].map(({ n, icon: Icon, title, description }) => (
              <article key={n} className="rounded-2xl border border-border bg-card p-6">
                <div className="flex items-center gap-4"><span className="text-sm font-black text-primary">{n}</span><Icon size={27} className="text-primary" /></div>
                <h3 className="mt-5 text-lg font-extrabold">{title}</h3>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">{description}</p>
              </article>
            ))}
          </div>
          <div className="mt-8 text-center">
            <Link to="/como-funciona" className="inline-flex min-h-11 items-center gap-2 font-bold text-primary underline underline-offset-4">Entenda todos os detalhes <ArrowRight size={16} /></Link>
          </div>
        </div>
      </section>

      <section id="para-voce" aria-label="Para motoristas e passageiros" className="bg-secondary/30 px-5 py-16 sm:py-20">
        <div className="mx-auto grid max-w-7xl gap-5 lg:grid-cols-2">
          <article className="rounded-3xl bg-[#171717] p-7 text-white sm:p-10">
            <CarFront size={29} className="text-[#ffc451]" />
            <p className="mt-5 text-xs font-bold uppercase tracking-widest text-[#ffc451]">Para motoristas</p>
            <h2 className="mt-3 max-w-md text-3xl font-black">Compartilhe seu caminho e seus custos.</h2>
            <p className="mt-4 max-w-md leading-7 text-white/75">Vai dirigir de qualquer forma? Ofereça os lugares disponíveis para pessoas com rotas parecidas.</p>
            <Button asChild variant="strong" className="mt-7 min-h-12 rounded-xl font-bold">
              <Link to="/auth" search={{ mode: "cadastro" }}>Oferecer carona <ArrowRight size={18} /></Link>
            </Button>
          </article>
          <article className="rounded-3xl border border-border bg-card p-7 sm:p-10">
            <UsersRound size={29} className="text-primary" />
            <p className="mt-5 text-xs font-bold uppercase tracking-widest text-primary">Para passageiros</p>
            <h2 className="mt-3 max-w-md text-3xl font-black">Encontre companhia e economize na viagem.</h2>
            <p className="mt-4 max-w-md leading-7 text-muted-foreground">Busque alguém que já vá na sua direção e confira a compatibilidade do trajeto antes de combinar.</p>
            <Button asChild variant="strong" className="mt-7 min-h-12 rounded-xl font-bold">
              <Link to="/auth" search={{ mode: "cadastro" }}>Pedir carona <ArrowRight size={18} /></Link>
            </Button>
          </article>
        </div>
      </section>

      <section id="impacto" className="bg-[#111111] px-5 py-16 text-white sm:py-20">
        <div className="mx-auto flex max-w-7xl flex-col items-start justify-between gap-7 md:flex-row md:items-center">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-[#ffc451]">Mais pessoas. Cidades melhores.</p>
            <h2 className="mt-3 max-w-2xl text-3xl font-black leading-tight sm:text-4xl">Faça parte de uma mobilidade mais <span className="text-[#ffc451]">humana e econômica.</span></h2>
          </div>
          <Button asChild variant="strong" size="lg" className="min-h-12 rounded-xl px-8 font-bold">
            <Link to="/auth" search={{ mode: "cadastro" }}>Criar conta gratuita <ArrowRight size={18} /></Link>
          </Button>
        </div>
      </section>
    </AppShell>
  );
}
