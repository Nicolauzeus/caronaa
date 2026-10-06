import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { ArrowRight, CarFront, MapPin, Sparkles } from "lucide-react";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/caronaa/AppShell";
import { RideCard } from "@/components/caronaa/RideCard";
import { SearchForm, SectionTitle } from "@/components/caronaa/PageParts";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth-context";
import { getCurrentProfile, getHomeRides, type RideSummary } from "@/lib/rides.functions";

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
  const loadProfile = useServerFn(getCurrentProfile);
  const loadRides = useServerFn(getHomeRides);
  const [profile, setProfile] = useState<{
    fullName: string;
    city: string | null;
  } | null>(null);
  const [rides, setRides] = useState<RideSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    void Promise.all([loadProfile(), loadRides()])
      .then(([profileData, rideData]) => {
        if (!active) return;
        setProfile(profileData);
        setRides(rideData);
      })
      .catch((loadError) => {
        if (!active) return;
        setError(
          loadError instanceof Error ? loadError.message : "Não foi possível carregar a home.",
        );
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [loadProfile, loadRides]);

  const firstName = String(
    profile?.fullName ||
      user?.user_metadata["full_name"] ||
      user?.user_metadata["name"] ||
      user?.email ||
      "Usuário",
  ).split(" ")[0];

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
          {profile?.city ? (
            <div className="inline-flex items-center gap-2 rounded-full bg-secondary px-3 py-2 text-sm font-semibold text-primary">
              <MapPin size={15} /> {profile.city}
            </div>
          ) : null}
        </div>
        <SearchForm compact />
        <div className="mt-6 grid gap-6 lg:grid-cols-[.85fr_1.15fr]">
          <section>
            <SectionTitle title="Comece pelo trajeto" link="Buscar" to="/buscar" />
            <div className="rounded-xl border border-border bg-card p-4 shadow-soft">
              <p className="text-sm font-bold">Informe origem, destino, data e horário</p>
              <p className="mt-1 text-sm text-muted-foreground">
                A busca usa ofertas reais disponíveis no CARONAA.
              </p>
              <Button asChild className="mt-4" variant="outline" size="sm">
                <Link to="/buscar">
                  Buscar carona <ArrowRight size={15} />
                </Link>
              </Button>
            </div>
          </section>
          <section>
            <SectionTitle title="Caronas disponíveis" link="Ver lista" to="/buscar" />
            <div className="relative min-h-48 overflow-hidden rounded-xl border border-border bg-card shadow-soft">
              <div className="absolute inset-0 opacity-60 [background-image:linear-gradient(28deg,transparent_46%,#fff_47%,#fff_49%,transparent_50%),linear-gradient(110deg,transparent_44%,#fff_45%,#fff_47%,transparent_48%)] [background-size:90px_90px]" />
              <div className="absolute left-1/2 top-1/2 flex size-11 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-4 border-white bg-primary text-primary-foreground shadow-lg">
                <MapPin size={20} />
              </div>
              <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between rounded-lg border border-white/70 bg-white/90 px-3 py-2 text-xs shadow-sm">
                <span className="font-bold">
                  {loading ? "Carregando..." : `${rides.length} ofertas disponíveis`}
                </span>
                <span className="text-muted-foreground">Dados reais</span>
              </div>
            </div>
          </section>
        </div>
        <section className="mt-7">
          <SectionTitle title="Caronas disponíveis" link="Ver todas" to="/buscar" />
          {loading ? (
            <div className="rounded-lg border border-border bg-card p-8 text-center text-sm text-muted-foreground shadow-soft">
              Carregando caronas disponíveis...
            </div>
          ) : error ? (
            <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-8 text-center text-sm text-destructive">
              {error}
            </div>
          ) : rides.length ? (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {rides.map((ride) => (
                <div key={ride.id} className="card-interactive">
                  <RideCard ride={ride} />
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-lg border border-dashed border-border p-8 text-center">
              <p className="font-bold">Ainda não encontramos caronas disponíveis para você.</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Você pode buscar outro trajeto ou oferecer uma carona.
              </p>
            </div>
          )}
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
