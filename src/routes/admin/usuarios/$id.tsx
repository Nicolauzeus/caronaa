import {
  AlertTriangle,
  CalendarClock,
  CarFront,
  CheckCircle2,
  Mail,
  Phone,
  Shield,
  Star,
  UserCog,
} from "lucide-react";
import { createFileRoute } from "@tanstack/react-router";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { adminService } from "@/mockData";

export const Route = createFileRoute("/admin/usuarios/$id")({
  component: UserDetailPage,
});

function UserDetailPage() {
  const { id } = Route.useParams();
  const user = adminService.getUser(id);

  if (!user) {
    return (
      <div className="rounded-2xl border border-border bg-card p-8 text-center shadow-soft">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-primary">
          Usuário não encontrado
        </p>
        <p className="mt-3 text-muted-foreground">Não há registro para este identificador.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-border bg-card p-5 shadow-soft">
        <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-2xl border border-border bg-secondary">
              <img src={user.avatar} alt={user.name} className="h-full w-full object-cover" />
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.22em] text-primary">
                #{user.id}
              </p>
              <h1 className="mt-2 font-display text-3xl font-extrabold">{user.name}</h1>
              <div className="mt-2 flex flex-wrap gap-2 text-sm text-muted-foreground">
                <span className="rounded-full bg-primary/10 px-2.5 py-1 font-medium text-primary">
                  {user.status}
                </span>
                <span className="rounded-full bg-secondary px-2.5 py-1 font-medium">
                  {user.profile}
                </span>
                <span className="rounded-full bg-secondary px-2.5 py-1 font-medium">
                  {user.verification}
                </span>
              </div>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline">
              Suspender
            </Button>
            <Button type="button" variant="outline">
              Bloquear
            </Button>
            <Button type="button">Adicionar observação</Button>
          </div>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <div className="space-y-6">
          <Card className="border border-border bg-card shadow-soft">
            <CardHeader>
              <CardTitle className="font-display text-2xl font-extrabold">Resumo</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
              <div className="rounded-xl border border-border bg-secondary/30 p-3">
                <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Contato</p>
                <p className="mt-2 flex items-center gap-2 font-medium">
                  <Mail size={14} className="text-primary" /> {user.email}
                </p>
                <p className="mt-2 flex items-center gap-2 font-medium">
                  <Phone size={14} className="text-primary" /> {user.phone}
                </p>
              </div>
              <div className="rounded-xl border border-border bg-secondary/30 p-3">
                <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Cadastro</p>
                <p className="mt-2 flex items-center gap-2 font-medium">
                  <CalendarClock size={14} className="text-primary" /> {user.joinedAt}
                </p>
                <p className="mt-2 flex items-center gap-2 font-medium">
                  <Star size={14} className="text-primary" /> Nota {user.reputation.toFixed(1)}
                </p>
              </div>
            </CardContent>
          </Card>

          <Card className="border border-border bg-card shadow-soft">
            <CardHeader>
              <CardTitle className="font-display text-2xl font-extrabold">Atividade</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between rounded-xl border border-border bg-secondary/30 p-3">
                <span className="font-medium">Caronas oferecidas</span>
                <span className="font-bold text-foreground">{user.ridesOffered}</span>
              </div>
              <div className="flex items-center justify-between rounded-xl border border-border bg-secondary/30 p-3">
                <span className="font-medium">Caronas utilizadas</span>
                <span className="font-bold text-foreground">{user.ridesTaken}</span>
              </div>
              <div className="flex items-center justify-between rounded-xl border border-border bg-secondary/30 p-3">
                <span className="font-medium">Última atividade</span>
                <span className="font-bold text-foreground">{user.lastActive}</span>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="border border-border bg-card shadow-soft">
            <CardHeader>
              <CardTitle className="font-display text-2xl font-extrabold">Segurança</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between rounded-xl border border-border bg-secondary/30 p-3">
                <span className="flex items-center gap-2 font-medium">
                  <Shield size={14} className="text-primary" /> Verificação
                </span>
                <span className="font-bold text-foreground">{user.verification}</span>
              </div>
              <div className="flex items-center justify-between rounded-xl border border-border bg-secondary/30 p-3">
                <span className="flex items-center gap-2 font-medium">
                  <AlertTriangle size={14} className="text-primary" /> Denúncias
                </span>
                <span className="font-bold text-foreground">0</span>
              </div>
              <div className="flex items-center justify-between rounded-xl border border-border bg-secondary/30 p-3">
                <span className="flex items-center gap-2 font-medium">
                  <CheckCircle2 size={14} className="text-primary" /> Reputação
                </span>
                <span className="font-bold text-foreground">{user.reputation.toFixed(1)}/5</span>
              </div>
            </CardContent>
          </Card>

          <Card className="border border-border bg-card shadow-soft">
            <CardHeader>
              <CardTitle className="font-display text-2xl font-extrabold">Perfil</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between rounded-xl border border-border bg-secondary/30 p-3">
                <span className="flex items-center gap-2 font-medium">
                  <UserCog size={14} className="text-primary" /> Tipo
                </span>
                <span className="font-bold text-foreground">{user.profile}</span>
              </div>
              <div className="flex items-center justify-between rounded-xl border border-border bg-secondary/30 p-3">
                <span className="flex items-center gap-2 font-medium">
                  <CarFront size={14} className="text-primary" /> Cidade
                </span>
                <span className="font-bold text-foreground">{user.city}</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

export default UserDetailPage;
