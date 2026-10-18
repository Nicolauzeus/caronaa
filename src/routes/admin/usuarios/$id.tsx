import { CalendarClock, CheckCircle2, Mail, MapPin, Shield, UserCog } from "lucide-react";
import { createFileRoute, Link } from "@tanstack/react-router";

import { VerificationBadges } from "@/components/caronaa/VerificationBadges";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getAdminUsers, type AdminUser } from "@/lib/admin.functions";

export const Route = createFileRoute("/admin/usuarios/$id")({
  head: () => ({ meta: [{ title: "Detalhes do usuário — CARONAA" },{ name: "description", content: "Informações e acompanhamento de detalhes do usuário." },{ property: "og:title", content: "Detalhes do usuário — CARONAA" },
{ property: "og:description", content: "Informações e acompanhamento de detalhes do usuário." },
{ property: "og:type", content: "website" },
{ name: "twitter:card", content: "summary" }] }),
  loader: async () => {
    return getAdminUsers();
  },

  component: UserDetailPage,
});

function getDisplayName(user: AdminUser) {
  const fullName = user.fullName.trim();

  if (fullName) {
    return fullName;
  }

  const emailName = user.email.split("@")[0]?.trim();

  return emailName || "Usuário CARONAA";
}

function getInitials(user: AdminUser) {
  const name = getDisplayName(user);

  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0))
    .join("")
    .toUpperCase();

  return initials || "CA";
}

function getRoleLabel(user: AdminUser) {
  if (user.roles.includes("admin")) {
    return "Administrador";
  }

  if (user.roles.includes("moderator")) {
    return "Moderador";
  }

  return "Usuário";
}

function formatDate(value: string | null) {
  if (!value) {
    return "—";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(date);
}

function formatDateTime(value: string | null) {
  if (!value) {
    return "Nunca";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function UserDetailPage() {
  const { id } = Route.useParams();
  const users = Route.useLoaderData() as AdminUser[];

  const user = users.find((item) => item.id === id) ?? null;

  if (!user) {
    return (
      <div className="space-y-5">
        <Button asChild variant="outline">
          <Link to="/admin/usuarios">Voltar para usuários</Link>
        </Button>

        <div className="rounded-2xl border border-border bg-card p-8 text-center shadow-soft">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-primary">
            Usuário não encontrado
          </p>

          <p className="mt-3 text-muted-foreground">Não há registro para este identificador.</p>
        </div>
      </div>
    );
  }

  const name = getDisplayName(user);
  const hasVerification = user.verifications.some(
    (verification) => verification.status === "VERIFIED",
  );

  return (
    <div className="space-y-6">
      <div>
        <Button asChild variant="outline" size="sm">
          <Link to="/admin/usuarios">Voltar para usuários</Link>
        </Button>
      </div>

      <div className="rounded-2xl border border-border bg-card p-5 shadow-soft">
        <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
          <div className="flex min-w-0 items-center gap-4">
            <Avatar className="h-20 w-20 rounded-2xl">
              {user.avatarUrl ? (
                <AvatarImage src={user.avatarUrl} alt={name} className="object-cover" />
              ) : null}

              <AvatarFallback className="rounded-2xl text-xl font-bold">
                {getInitials(user)}
              </AvatarFallback>
            </Avatar>

            <div className="min-w-0">
              <p className="truncate text-xs font-bold uppercase tracking-[0.22em] text-primary">
                {user.id}
              </p>

              <h1 className="mt-2 truncate font-display text-3xl font-extrabold">{name}</h1>

              <div className="mt-3 flex flex-wrap items-center gap-2">
                <span className="rounded-md border border-border/70 bg-muted/60 px-2.5 py-1 text-sm font-medium text-foreground">
                  {getRoleLabel(user)}
                </span>

                {user.emailConfirmed ? (
                  <span className="rounded-full bg-primary/10 px-2.5 py-1 text-sm font-medium text-primary">
                    E-mail confirmado
                  </span>
                ) : (
                  <span className="rounded-md border border-border/70 bg-muted/60 px-2.5 py-1 text-sm font-medium text-muted-foreground">
                    E-mail não confirmado
                  </span>
                )}
              </div>
            </div>
          </div>

          {hasVerification ? (
            <VerificationBadges verifications={user.verifications} />
          ) : (
            <span className="text-sm text-muted-foreground">Sem vínculo verificado</span>
          )}
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <div className="space-y-6">
          <Card className="border border-border bg-card shadow-soft">
            <CardHeader>
              <CardTitle className="font-display text-2xl font-extrabold">Cadastro</CardTitle>
            </CardHeader>

            <CardContent className="grid gap-4 md:grid-cols-2">
              <div className="rounded-xl border border-border bg-secondary/30 p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">E-mail</p>

                <p className="mt-2 flex items-center gap-2 break-all font-medium">
                  <Mail size={15} className="shrink-0 text-primary" />
                  {user.email || "Não informado"}
                </p>
              </div>

              <div className="rounded-xl border border-border bg-secondary/30 p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Cidade</p>

                <p className="mt-2 flex items-center gap-2 font-medium">
                  <MapPin size={15} className="shrink-0 text-primary" />
                  {user.city || "Não informada"}
                </p>
              </div>

              <div className="rounded-xl border border-border bg-secondary/30 p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Cadastro</p>

                <p className="mt-2 flex items-center gap-2 font-medium">
                  <CalendarClock size={15} className="shrink-0 text-primary" />
                  {formatDate(user.createdAt)}
                </p>
              </div>

              <div className="rounded-xl border border-border bg-secondary/30 p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                  Último acesso
                </p>

                <p className="mt-2 flex items-center gap-2 font-medium">
                  <CalendarClock size={15} className="shrink-0 text-primary" />
                  {formatDateTime(user.lastSignInAt)}
                </p>
              </div>
            </CardContent>
          </Card>

          <Card className="border border-border bg-card shadow-soft">
            <CardHeader>
              <CardTitle className="font-display text-2xl font-extrabold">
                Vínculos verificados
              </CardTitle>
            </CardHeader>

            <CardContent>
              {hasVerification ? (
                <div className="space-y-3">
                  {user.verifications.map((verification) => (
                    <div
                      key={verification.id}
                      className="rounded-xl border border-border bg-secondary/30 p-4"
                    >
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                          <p className="font-semibold text-foreground">
                            {verification.type === "UNIFOR" ? "UNIFOR" : "STS 2026"}
                          </p>

                          <p className="mt-1 text-sm text-muted-foreground">
                            {verification.type === "UNIFOR"
                              ? "Vínculo verificado por domínio institucional de e-mail."
                              : "Participação registrada através do formulário oficial do CARONAA no contexto do Siará Tech Summit 2026."}
                          </p>

                          {verification.verifiedEmail ? (
                            <p className="mt-2 text-xs text-muted-foreground">
                              E-mail associado: {verification.verifiedEmail}
                            </p>
                          ) : null}
                        </div>

                        <span className="shrink-0 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary">
                          Verificado
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="rounded-xl border border-dashed border-border p-6 text-center">
                  <p className="font-medium text-foreground">Sem vínculo verificado</p>

                  <p className="mt-2 text-sm text-muted-foreground">
                    Este usuário continua podendo usar o CARONAA normalmente.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="border border-border bg-card shadow-soft">
            <CardHeader>
              <CardTitle className="font-display text-2xl font-extrabold">Segurança</CardTitle>
            </CardHeader>

            <CardContent className="space-y-3">
              <div className="flex items-center justify-between gap-4 rounded-xl border border-border bg-secondary/30 p-4">
                <span className="flex items-center gap-2 font-medium">
                  <Shield size={15} className="text-primary" />
                  E-mail
                </span>

                <span className="text-right font-bold text-foreground">
                  {user.emailConfirmed ? "Confirmado" : "Não confirmado"}
                </span>
              </div>

              <div className="flex items-center justify-between gap-4 rounded-xl border border-border bg-secondary/30 p-4">
                <span className="flex items-center gap-2 font-medium">
                  <CheckCircle2 size={15} className="text-primary" />
                  Vínculos
                </span>

                <span className="text-right font-bold text-foreground">
                  {user.verifications.length}
                </span>
              </div>
            </CardContent>
          </Card>

          <Card className="border border-border bg-card shadow-soft">
            <CardHeader>
              <CardTitle className="font-display text-2xl font-extrabold">Acesso</CardTitle>
            </CardHeader>

            <CardContent>
              <div className="flex items-center justify-between gap-4 rounded-xl border border-border bg-secondary/30 p-4">
                <span className="flex items-center gap-2 font-medium">
                  <UserCog size={15} className="text-primary" />
                  Função
                </span>

                <span className="text-right font-bold text-foreground">{getRoleLabel(user)}</span>
              </div>

              <p className="mt-4 text-xs leading-relaxed text-muted-foreground">
                Esta tela exibe somente dados efetivamente persistidos pelo CARONAA. Ações de
                suspensão, bloqueio ou alteração administrativa não são exibidas enquanto não houver
                um modelo persistente e auditável para essas operações.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
