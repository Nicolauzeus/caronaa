import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, CarFront, MapPin, Sparkles } from "lucide-react";
import { AppShell } from "@/components/caronaa/AppShell";
import { RideCard } from "@/components/caronaa/RideCard";
import { SearchForm, SectionTitle } from "@/components/caronaa/PageParts";
import { Button } from "@/components/ui/button";
import { currentUser, rideService } from "@/mockData";
import { useAuth } from "@/lib/auth-context";

export const Route = createFileRoute("/_authenticated/home")({
  head: () => ({
    meta: [
      { title: "Início — CARONAA" },
      { name: "description", content: "Encontre sugestões de carona no CARONAA." },
    ],
  }),
  component: Home,
});

function Home() {
  const { user } = useAuth();
  const firstName = String(
    user?.user_metadata["full_name"] || user?.user_metadata["name"] || currentUser.firstName,
  ).split(" ")[0];
  const rides = rideService.list();
  return (
    <AppShell>
      <div className="animate-page-in">
        <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="mb-1 text-xs font-bold uppercase tracking-[0.18em] text-primary">
              SUA JORNADA COMEÇA AQUI
            </p>
            <h1 className="font-display text-3xl font-extrabold md:text-4xl">
              Olá, {firstName} 👋
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">Para onde vamos hoje?</p>
          </div>
          <div className="inline-flex items-center gap-2 rounded-full bg-secondary px-3 py-2 text-sm font-semibold text-primary">
            <MapPin size={15} /> {currentUser.city}
          </div>
        </div>
        <SearchForm compact />
        <div className="mt-6 grid gap-6 lg:grid-cols-[.85fr_1.15fr]">
          <section>
            <SectionTitle title="Rotas rápidas" link="Ver todas" to="/buscar" />
            <div className="space-y-2">
              {[
                ["Casa → Unifor", "07:30 · dias úteis"],
                ["Unifor → Casa", "18:10 · hoje"],
                ["Aldeota → Centro", "08:00 · amanhã"],
              ].map(([title, detail], index) => (
                <Link
                  key={title}
                  to="/buscar"
                  className="card-interactive flex items-center justify-between rounded-xl border border-border bg-card px-4 py-3 shadow-soft"
                >
                  <span className="flex items-center gap-3">
                    <span className="flex size-9 items-center justify-center rounded-lg bg-secondary text-primary">
                      <MapPin size={17} />
                    </span>
                    <span>
                      <span className="block text-sm font-bold">{title}</span>
                      <span className="text-xs text-muted-foreground">{detail}</span>
                    </span>
                  </span>
                  <ArrowRight size={16} className="text-muted-foreground" />
                </Link>
              ))}
            </div>
          </section>
          <section>
            <SectionTitle title="Caronas perto de você" link="Ver no mapa" to="/buscar" />
            <div className="relative min-h-48 overflow-hidden rounded-xl border border-border bg-[#dfeadf] shadow-soft">
              <div className="absolute inset-0 opacity-60 [background-image:linear-gradient(28deg,transparent_46%,#fff_47%,#fff_49%,transparent_50%),linear-gradient(110deg,transparent_44%,#fff_45%,#fff_47%,transparent_48%)] [background-size:90px_90px]" />
              <div className="absolute left-1/2 top-1/2 flex size-11 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-4 border-white bg-primary text-primary-foreground shadow-lg">
                <MapPin size={20} />
              </div>
              <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between rounded-lg border border-white/70 bg-white/90 px-3 py-2 text-xs shadow-sm">
                <span className="font-bold">12 caronas próximas</span>
                <span className="text-muted-foreground">Saindo nos próximos 30 min</span>
              </div>
            </div>
          </section>
        </div>
        <section className="mt-7">
          <SectionTitle title="Próximas viagens" link="Ver todas" to="/minhas-caronas" />
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {rides.slice(0, 3).map((ride) => (
              <div key={ride.id} className="card-interactive">
                <RideCard ride={ride} />
              </div>
            ))}
          </div>
        </section>
        <div className="mt-7 flex flex-col gap-3 rounded-xl border border-border bg-card p-4 shadow-soft sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <span className="flex size-10 items-center justify-center rounded-lg bg-secondary text-primary">
              <Sparkles size={19} />
            </span>
            <div>
              <p className="text-sm font-bold">Compartilhe seu caminho</p>
              <p className="text-xs text-muted-foreground">
                Publique uma viagem e encontre pessoas na mesma direção.
              </p>
            </div>
          </div>
          <Button asChild variant="outline" size="sm">
            <Link to="/oferecer">
              Oferecer carona <CarFront size={15} />
            </Link>
          </Button>
        </div>
      </div>
    </AppShell>
  );
}
