import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { CheckCircle2, LockKeyhole } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Brand } from "@/components/caronaa/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/reset-password")({
  head: () => ({ meta: [
    { title: "Redefinir senha — CARONAA" },
    { name: "description", content: "Crie uma nova senha para sua conta CARONAA." },
    { property: "og:title", content: "Redefinir senha — CARONAA" },
    { property: "og:description", content: "Crie uma nova senha para sua conta CARONAA." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: ResetPassword,
});

function ResetPassword() {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    const isRecoveryLink = window.location.hash.includes("type=recovery") || window.location.search.includes("type=recovery");
    void supabase.auth.getSession().then(({ data }) => setReady(Boolean(data.session) || isRecoveryLink));
    const { data } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") setReady(true);
    });
    return () => data.subscription.unsubscribe();
  }, []);

  async function updatePassword(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (error) toast.error(error.message);
    else setDone(true);
  }

  return <main className="flex min-h-screen items-center justify-center bg-secondary px-5 py-10"><div className="w-full max-w-md rounded-lg border border-border bg-card p-6 shadow-card md:p-8"><Brand/>{done ? <div className="mt-10 text-center"><CheckCircle2 className="mx-auto text-primary" size={44}/><h1 className="mt-4 font-display text-2xl font-extrabold">Senha atualizada</h1><p className="mt-2 text-muted-foreground">Sua nova senha já está pronta para uso.</p><Button className="mt-6 w-full" onClick={() => navigate({ to: "/home" })}>Continuar</Button></div> : ready ? <><h1 className="mt-10 font-display text-2xl font-extrabold">Crie uma nova senha</h1><p className="mt-2 text-sm text-muted-foreground">Use pelo menos 6 caracteres.</p><form onSubmit={updatePassword} className="mt-6 space-y-4"><div className="space-y-2"><Label htmlFor="new-password">Nova senha</Label><div className="relative"><LockKeyhole className="absolute left-3 top-3 text-muted-foreground" size={18}/><Input id="new-password" type="password" className="h-11 pl-10" value={password} onChange={(e) => setPassword(e.target.value)} minLength={6} required autoComplete="new-password"/></div></div><Button type="submit" className="h-11 w-full" disabled={busy}>{busy ? "Atualizando..." : "Atualizar senha"}</Button></form></> : <div className="mt-10 text-center"><h1 className="font-display text-2xl font-extrabold">Link inválido ou expirado</h1><p className="mt-2 text-muted-foreground">Solicite um novo link na tela de acesso.</p><Button asChild variant="outline" className="mt-6 w-full"><Link to="/auth">Voltar para entrar</Link></Button></div>}</div></main>;
}