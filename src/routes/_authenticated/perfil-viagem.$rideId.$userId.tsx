import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { ArrowLeft, MapPin, ShieldCheck, Star } from "lucide-react";
import { AppShell } from "@/components/caronaa/AppShell";
import { PageHeading } from "@/components/caronaa/PageParts";
import { VerificationBadges } from "@/components/caronaa/VerificationBadges";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { getRideParticipantProfile } from "@/lib/rides.functions";
import type { RideVerification } from "@/lib/rides.functions";

type ParticipantProfile = {
  id: string;
  fullName: string;
  avatarUrl: string | null;
  city: string | null;
  memberSince: string;
  verifications: RideVerification[];
  averageRating: number | null;
  ratingCount: number;
  vehicleDescription: string | null;
};

export const Route = createFileRoute("/_authenticated/perfil-viagem/$rideId/$userId")({
  head: () => ({ meta: [{ title: "Perfil da viagem — CARONAA" }] }),
  component: RideParticipantProfilePage,
});

function RideParticipantProfilePage() {
  const { rideId, userId } = Route.useParams();
  const loadProfile = useServerFn(getRideParticipantProfile);
  const [profile, setProfile] = useState<ParticipantProfile | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    void loadProfile({ data: { rideId, userId } })
      .then((result) => {
        if (active) setProfile(result);
      })
      .catch((reason) => {
        if (active)
          setError(
            reason instanceof Error ? reason.message : "Não foi possível carregar o perfil.",
          );
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [loadProfile, rideId, userId]);

  const initials =
    profile?.fullName
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0])
      .join("")
      .toUpperCase() || "CA";

  return (
    <AppShell>
      <PageHeading
        eyebrow="SEGURANÇA DA VIAGEM"
        title="Perfil da outra pessoa"
        description="Informações de apresentação e confiança disponíveis para participantes desta combinação."
      />
      <div className="mx-auto max-w-xl">
        <Button asChild variant="ghost" size="sm" className="mb-4">
          <Link to="/minhas-caronas">
            <ArrowLeft size={16} /> Voltar às viagens
          </Link>
        </Button>
        {loading ? (
          <div className="h-56 animate-pulse rounded-xl border border-border bg-card" />
        ) : error || !profile ? (
          <div
            role="alert"
            className="rounded-xl border border-destructive/30 bg-card p-5 text-sm text-destructive"
          >
            {error || "Perfil não encontrado."}
          </div>
        ) : (
          <section className="rounded-xl border border-border bg-card p-5 shadow-soft sm:p-7">
            <div className="flex items-center gap-4">
              <Avatar className="size-16 shrink-0 sm:size-20">
                {profile.avatarUrl ? (
                  <AvatarImage src={profile.avatarUrl} alt={`Foto de ${profile.fullName}`} />
                ) : null}
                <AvatarFallback>{initials}</AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <h2 className="truncate text-xl font-bold">{profile.fullName}</h2>
                {profile.city ? (
                  <p className="mt-1 flex items-center gap-1.5 text-sm text-foreground/75">
                    <MapPin size={14} />
                    {profile.city}
                  </p>
                ) : null}
                <p className="mt-1 text-xs text-foreground/75">
                  Na CARONAA desde {new Date(profile.memberSince).getFullYear()}
                </p>
              </div>
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <div className="rounded-lg border border-border bg-card p-4">
                <p className="flex items-center gap-2 text-sm font-semibold">
                  <ShieldCheck size={16} className="text-primary" />
                  Verificações
                </p>
                {profile.verifications.length ? (
                  <div className="mt-2">
                    <VerificationBadges verifications={profile.verifications} />
                  </div>
                ) : (
                  <p className="mt-2 text-sm text-muted-foreground">
                    Nenhum selo de verificação concedido.
                  </p>
                )}
                <p className="mt-2 text-xs text-muted-foreground">
                  Os selos indicam apenas os dados efetivamente verificados; não são garantia de
                  segurança.
                </p>
              </div>
              <div className="rounded-lg border border-border bg-card p-4">
                <p className="flex items-center gap-2 text-sm font-semibold">
                  <Star size={16} className="text-primary" />
                  Avaliações
                </p>
                {profile.averageRating == null ? (
                  <p className="mt-2 text-sm text-muted-foreground">Ainda sem avaliações</p>
                ) : (
                  <p className="mt-2 text-sm">
                    <strong>{profile.averageRating.toFixed(2)} / 5</strong>
                    <span className="text-muted-foreground">
                      {" "}
                      · {profile.ratingCount}{" "}
                      {profile.ratingCount === 1 ? "avaliação" : "avaliações"}
                    </span>
                  </p>
                )}
              </div>
            </div>

            {profile.vehicleDescription ? (
              <div className="mt-3 rounded-lg border border-border bg-card p-4">
                <p className="text-sm font-semibold">Veículo informado pelo motorista</p>
                <p className="mt-1 text-sm text-muted-foreground">{profile.vehicleDescription}</p>
              </div>
            ) : null}
            <p className="mt-4 text-xs leading-relaxed text-muted-foreground">
              Por sua segurança, combine detalhes da viagem dentro do fluxo da CARONAA. Este perfil
              não exibe documentos, contato privado, chave Pix, localização ao vivo nem informações
              particulares de formulários.
            </p>
          </section>
        )}
      </div>
    </AppShell>
  );
}
