import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { CarFront, Eye, EyeOff, LockKeyhole, Mail, UserRound } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { Brand } from "@/components/caronaa/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { lovable } from "@/integrations/lovable";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";

const authSearchSchema = z.object({
  redirect: z.string().optional().catch(undefined),
});

export const Route = createFileRoute("/auth")({
  validateSearch: authSearchSchema,
  head: () => ({ meta: [
    { title: "Entrar ou criar conta — CARONAA" },
    { name: "description", content: "Entre ou crie sua conta no CARONAA para compartilhar seus caminhos." },
    { property: "og:title", content: "Entrar ou criar conta — CARONAA" },
    { property: "og:description", content: "Acesse o CARONAA e compartilhe seus caminhos." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const search = Route.useSearch();
  const { user, loading } = useAuth();
  const [mode, setMode] = useState("entrar");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [confirmationSent, setConfirmationSent] = useState(false);

  const destination = search.redirect?.startsWith("/") && !search.redirect.startsWith("//")
    ? search.redirect
    : "/home";

  useEffect(() => {
    if (!loading && user) void navigate({ to: destination });
  }, [destination, loading, navigate, user]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      if (mode === "cadastro") {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: window.location.origin, data: { full_name: name.trim() } },
        });
        if (error) throw error;
        if (!data.session) {
          setConfirmationSent(true);
          return;
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
      await navigate({ to: destination });
    } catch (error) {
      toast.error(authErrorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  async function continueWithGoogle() {
    setBusy(true);
    const result = await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin });
    if (result.error) {
      toast.error("Não foi possível entrar com Google. Tente novamente.");
      setBusy(false);
      return;
    }
    if (!result.redirected) await navigate({ to: destination });
  }

  async function sendReset() {
    if (!email) {
      toast.error("Informe seu e-mail primeiro.");
      return;
    }
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/reset-password` });
    if (error) toast.error(authErrorMessage(error));
    else toast.success("Enviamos o link para redefinir sua senha.");
  }

  if (confirmationSent) return <AuthFrame><div className="text-center"><span className="mx-auto flex size-14 items-center justify-center rounded-lg bg-secondary text-primary"><Mail size={26}/></span><h1 className="mt-5 font-display text-2xl font-extrabold">Confirme seu e-mail</h1><p className="mt-3 leading-relaxed text-muted-foreground">Enviamos um link para <strong className="text-foreground">{email}</strong>. Abra-o para ativar sua conta.</p><Button variant="outline" className="mt-6 w-full" onClick={() => { setConfirmationSent(false); setMode("entrar"); }}>Voltar para entrar</Button></div></AuthFrame>;

  return <AuthFrame><div className="mb-6"><p className="text-xs font-bold uppercase tracking-widest text-primary">Sua conta CARONAA</p><h1 className="mt-2 font-display text-3xl font-extrabold">Boas-vindas</h1><p className="mt-2 text-sm text-muted-foreground">Entre para organizar seus trajetos e conexões.</p></div><Tabs value={mode} onValueChange={setMode}><TabsList className="grid h-11 w-full grid-cols-2"><TabsTrigger value="entrar">Entrar</TabsTrigger><TabsTrigger value="cadastro">Criar conta</TabsTrigger></TabsList><TabsContent value={mode} className="mt-6"><form onSubmit={submit} className="space-y-4">{mode === "cadastro" && <div className="space-y-2"><Label htmlFor="name">Nome completo</Label><div className="relative"><UserRound className="absolute left-3 top-3 text-muted-foreground" size={18}/><Input id="name" value={name} onChange={(e) => setName(e.target.value)} className="h-11 pl-10" autoComplete="name" required/></div></div>}<div className="space-y-2"><Label htmlFor="email">E-mail</Label><div className="relative"><Mail className="absolute left-3 top-3 text-muted-foreground" size={18}/><Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="h-11 pl-10" autoComplete="email" required/></div></div><div className="space-y-2"><Label htmlFor="password">Senha</Label><div className="relative"><LockKeyhole className="absolute left-3 top-3 text-muted-foreground" size={18}/><Input id="password" type={showPassword ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} className="h-11 px-10" autoComplete={mode === "cadastro" ? "new-password" : "current-password"} minLength={6} required/><Button type="button" variant="ghost" size="icon" className="absolute right-0 top-0 size-11" onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}>{showPassword ? <EyeOff size={18}/> : <Eye size={18}/>}</Button></div></div>{mode === "entrar" && <Button type="button" variant="link" className="h-auto p-0 text-sm" onClick={sendReset}>Esqueci minha senha</Button>}<Button type="submit" className="h-11 w-full font-bold" disabled={busy}>{busy ? "Aguarde..." : mode === "cadastro" ? "Criar minha conta" : "Entrar"}</Button></form><div className="my-5 flex items-center gap-3 text-xs text-muted-foreground"><span className="h-px flex-1 bg-border"/>ou<span className="h-px flex-1 bg-border"/></div><Button type="button" variant="outline" className="h-11 w-full font-semibold" onClick={continueWithGoogle} disabled={busy}><span className="font-bold text-primary">G</span> Continuar com Google</Button><p className="mt-6 text-center text-xs leading-relaxed text-muted-foreground">Ao continuar, você concorda em participar de uma comunidade baseada em respeito e confiança.</p></TabsContent></Tabs></AuthFrame>;
}

function AuthFrame({ children }: { children: React.ReactNode }) {
  return <main className="grid min-h-screen bg-background lg:grid-cols-[1fr_480px]"><section className="relative hidden overflow-hidden bg-primary p-12 text-primary-foreground lg:flex lg:flex-col lg:justify-between"><Brand light/><div className="relative z-10 max-w-lg"><CarFront size={44}/><h2 className="mt-6 font-display text-4xl font-extrabold leading-tight">Seu caminho fica melhor junto.</h2><p className="mt-4 text-lg text-primary-foreground/85">Conecte-se com pessoas que seguem na mesma direção.</p></div><p className="relative z-10 text-sm text-primary-foreground/70">Mais que um caminho. Uma conexão.</p></section><section className="flex items-center justify-center px-5 py-10"><div className="w-full max-w-sm"><div className="mb-8 lg:hidden"><Brand/></div>{children}<p className="mt-8 text-center text-sm text-muted-foreground"><Link to="/" className="font-semibold text-primary">Voltar à página inicial</Link></p></div></section></main>;
}

function authErrorMessage(error: unknown) {
  const message = error instanceof Error ? error.message.toLowerCase() : "";
  if (message.includes("invalid login credentials")) return "E-mail ou senha incorretos.";
  if (message.includes("email not confirmed")) return "Confirme seu e-mail antes de entrar.";
  if (message.includes("user already registered")) return "Este e-mail já possui uma conta. Entre com sua senha.";
  if (message.includes("password")) return "Use uma senha mais segura, com pelo menos 6 caracteres.";
  if (message.includes("rate limit")) return "Muitas tentativas. Aguarde alguns minutos e tente novamente.";
  if (message.includes("database error")) return "Não foi possível criar a conta agora. Tente novamente em instantes.";
  return "Não foi possível continuar. Verifique os dados e tente novamente.";
}