import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowRight,
  ArrowUpRight,
  CarFront,
  HeartHandshake,
  MapPinned,
  ShieldCheck,
} from "lucide-react";
import { AppShell } from "@/components/caronaa/AppShell";
import { Button } from "@/components/ui/button";
import desktopBackground from "@/assets/brand/caronaa-background-desktop.png.asset.json";
import mobileBackground from "@/assets/brand/caronaa-background-mobile.png.asset.json";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "CARONAA — Seu caminho fica melhor junto" },
      {
        name: "description",
        content:
          "Caronas compartilhadas urbanas e intermunicipais. Encontre quem vai pelo mesmo caminho.",
      },
      { property: "og:title", content: "CARONAA — Seu caminho fica melhor junto" },
      {
        property: "og:description",
        content: "Compartilhe trajetos, faça novas conexões e mova-se melhor com a sua comunidade.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Landing,
});

function Landing() {
  return (
    <AppShell publicPage>
      <section className="relative isolate flex min-h-[620px] items-end overflow-hidden bg-foreground md:min-h-[650px] md:items-center">
        <picture className="absolute inset-0 -z-20 size-full">
          <source media="(min-width: 768px)" srcSet={desktopBackground.url} />
          <img
            src={mobileBackground.url}
            alt="Cidade conectada por trajetos de carona"
            className="size-full object-cover"
          />
        </picture>
        <div className="absolute inset-0 -z-10 bg-hero-overlay" />
        <div className="mx-auto w-full max-w-7xl px-5 pb-16 pt-36 md:px-8 md:py-24">
          <div className="max-w-[650px] text-white">
            <span className="mb-5 inline-flex items-center gap-2 rounded-full border border-white/35 bg-white/15 px-3 py-1.5 text-xs font-semibold text-white backdrop-blur-sm">
              <span className="size-2 rounded-full bg-highlight" /> Mobilidade que conecta pessoas
            </span>
            <h1 className="font-display text-4xl font-extrabold leading-[1.08] text-white md:text-6xl">
              CARONAA.
              <br />
              Seu caminho fica melhor junto.
            </h1>
            <p className="mt-5 max-w-lg text-base leading-relaxed text-white md:text-lg">
              Encontre pessoas que vão pelo mesmo caminho. Divida o trajeto, compartilhe bons
              momentos e vá mais longe em comunidade.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button
                asChild
                size="lg"
                className="h-12 bg-primary px-6 font-bold text-white hover:bg-primary/90"
              >
                <Link to="/buscar">
                  Encontrar carona <ArrowRight />
                </Link>
              </Button>
              <Button
                asChild
                size="lg"
                variant="outline"
                className="h-12 border-white/70 bg-transparent px-6 font-bold text-white hover:bg-white/15 hover:text-white"
              >
                <Link to="/oferecer">
                  Oferecer carona <ArrowUpRight />
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </section>
      <section className="mx-auto grid max-w-7xl gap-8 px-5 py-14 md:grid-cols-[.85fr_1.15fr] md:items-center md:gap-16 md:px-8 md:py-20">
        <div>
          <p className="mb-3 text-xs font-bold uppercase tracking-widest text-primary">
            Juntos, a gente chega mais longe
          </p>
          <h2 className="font-display text-3xl font-extrabold leading-tight md:text-4xl">
            O trajeto é seu.
            <br />A companhia também pode ser.
          </h2>
          <p className="mt-4 max-w-md leading-relaxed text-muted-foreground">
            Se você já vai sair, por que não dividir o caminho? O CARONAA aproxima motoristas e
            passageiros com trajetos compatíveis, sem complicação.
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          {[
            {
              icon: MapPinned,
              title: "Ache seu caminho",
              text: "Encontre caronas para viagens pela cidade ou entre municípios.",
            },
            {
              icon: HeartHandshake,
              title: "Conecte-se",
              text: "Conheça pessoas da sua comunidade que vão na mesma direção.",
            },
            {
              icon: ShieldCheck,
              title: "Vá com confiança",
              text: "Veja perfis, avaliações e detalhes antes de combinar sua viagem.",
            },
          ].map(({ icon: Icon, title, text }) => (
            <div key={title} className="border-l-2 border-primary pl-4">
              <Icon className="mb-4 text-primary" size={26} />
              <h3 className="font-bold">{title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{text}</p>
            </div>
          ))}
        </div>
      </section>
      <section className="bg-primary text-primary-foreground">
        <div className="mx-auto flex max-w-7xl flex-col gap-6 px-5 py-10 md:flex-row md:items-center md:justify-between md:px-8">
          <div>
            <p className="mb-2 text-xs font-bold uppercase tracking-widest text-primary-foreground/75">
              Faça parte desde o começo
            </p>
            <h2 className="font-display text-2xl font-extrabold md:text-3xl">
              Ajude a construir a mobilidade que você quer ver.
            </h2>
            <p className="mt-2 text-sm text-primary-foreground/85">
              Sua opinião faz diferença no futuro do CARONAA.
            </p>
          </div>
          <Button
            asChild
            size="lg"
            className="h-12 shrink-0 bg-primary-foreground px-6 font-bold text-primary hover:bg-primary-foreground/90"
          >
            <Link to="/formulario">
              Validação Siará Tech Summit <ArrowUpRight />
            </Link>
          </Button>
        </div>
      </section>
      <footer className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-5 py-8 text-sm text-muted-foreground md:px-8">
        <span className="flex items-center gap-2 font-bold text-foreground">
          <CarFront size={18} className="text-primary" /> CARONAA.
        </span>
        <span>Mais que um caminho. Uma conexão.</span>
      </footer>
    </AppShell>
  );
}
