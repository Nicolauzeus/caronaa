import { AlertTriangle, ShieldCheck } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { getDepartmentOfPath } from "@/lib/admin/module-navigation";
import { AdminAccessProvider, EMPTY_ADMIN_SCOPE, parseAdminScope } from "@/lib/admin/access";
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
  const [scope, setScope] = useState(EMPTY_ADMIN_SCOPE);
  const pathname = useRouterState({ select: (state) => state.location.pathname });

  useEffect(() => {
    let active = true;
    setAccessError(false);
    setScope(EMPTY_ADMIN_SCOPE);
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
      .then(async ({ isAdmin }) => {
        if (isAdmin) return { isAdmin, resolved: EMPTY_ADMIN_SCOPE };
        const scopeResponse = await supabase.rpc("get_my_admin_scope" as never);
        if (scopeResponse.error) throw scopeResponse.error;
        return { isAdmin, resolved: parseAdminScope(scopeResponse.data) };
      })
      .then(({ isAdmin, resolved }) => {
        // A global grant is always verified independently by the original admin check.
        const effectiveScope = { ...resolved, isGlobalAdmin: isAdmin };
        const hasAccess = isAdmin || resolved.departments.length > 0;
        if (active) {
          setCheckedUserId(user.id);
          setScope(effectiveScope);
          setAuthorized(hasAccess);
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

  const department = getDepartmentOfPath(pathname);
  const isOverview = pathname === "/admin" || pathname === "/admin/";
  const isDepartmentDirectory = pathname.startsWith("/admin/departamentos") && !department;
  if ((isOverview || isDepartmentDirectory) && !scope.isGlobalAdmin ||
      (department && !scope.isGlobalAdmin && !scope.departments.some((d) => d.id === department))) {
    return <div role="alert" className="mx-auto max-w-lg p-8 text-center">
      <h1 className="text-2xl font-bold">Acesso não autorizado</h1>
      <p className="mt-3">Esta área não faz parte das suas permissões administrativas.</p>
      <Link to="/home" className="mt-4 inline-block underline">Voltar ao aplicativo</Link>
    </div>;
  }
  return <AdminAccessProvider value={scope}>{children}</AdminAccessProvider>;
}
