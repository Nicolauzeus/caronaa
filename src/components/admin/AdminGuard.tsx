import { AlertTriangle, ShieldCheck } from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";

import { Button } from "@/components/ui/button";
import { getAdminAccess } from "@/lib/admin.functions";
import { useAuth } from "@/lib/auth-context";

export function AdminGuard({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const checkAdmin = useServerFn(getAdminAccess);
  const [authorized, setAuthorized] = useState<boolean | null>(null);
  const [checkedUserId, setCheckedUserId] = useState<string | null>(null);
  const [accessError, setAccessError] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    setAccessError(false);
    if (loading)
      return () => {
        active = false;
      };
    if (!user) {
      setAuthorized(false);
      return () => {
        active = false;
      };
    }
    setAuthorized(null);
    void checkAdmin()
      .then(({ isAdmin }) => {
        if (active) {
          setCheckedUserId(user.id);
          setAuthorized(isAdmin);
        }
      })
      .catch(() => {
        if (active) {
          setCheckedUserId(user.id);
          setAuthorized(false);
          setAccessError(true);
        }
      });
    return () => {
      active = false;
    };
  }, [attempt, checkAdmin, loading, user]);

  if (loading || (user && (authorized === null || checkedUserId !== user.id))) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <div className="rounded-xl border border-border bg-card p-6 text-center shadow-soft">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-secondary text-primary">
            <ShieldCheck size={22} />
          </div>
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-muted-foreground">
            Verificando acesso
          </p>
        </div>
      </div>
    );
  }

  if (!user || !authorized) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <div className="w-full max-w-lg rounded-2xl border border-border bg-card p-8 text-center shadow-soft">
          <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10 text-destructive">
            <AlertTriangle size={28} />
          </div>
          {!accessError && (
            <p className="text-xs font-bold uppercase tracking-[0.26em] text-primary">403</p>
          )}
          <h1 className="mt-4 font-display text-3xl font-extrabold text-foreground">
            {accessError ? "Verificação de acesso indisponível" : "Acesso restrito"}
          </h1>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">
            {accessError
              ? "Não foi possível confirmar sua autorização agora. Tente novamente."
              : "Esta área do CARONAA é exclusiva para administradores autorizados."}
          </p>
          <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
            {accessError && (
              <Button onClick={() => setAttempt((value) => value + 1)}>Tentar novamente</Button>
            )}
            {!user && (
              <Button asChild>
                <Link to="/auth" search={{ redirect: "/admin" }}>
                  Entrar como administrador
                </Link>
              </Button>
            )}
            <Button asChild variant="outline">
              <Link to="/home">Voltar ao app</Link>
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
