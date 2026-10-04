import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowRight, Eye, EyeOff, LockKeyhole, Mail, MapPinned, ShieldCheck, UserRound, UsersRound } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { Brand } from "@/components/caronaa/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { lovable } from "@/integrations/lovable";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import desktopBackground from "@/assets/brand/caronaa-background-desktop.png.asset.json";
import mobileBackground from "@/assets/brand/caronaa-background-mobile.png.asset.json";
import logoAsset from "@/assets/brand/caronaa-logo.png.asset.json";
import { ThemeToggle } from "@/components/caronaa/ThemeToggle";

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

  return <AuthFrame><div className="mb-6 flex items-start justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-widest text-primary">{mode === "cadastro" ? "VENHA COM A GENTE" : "BEM-VINDO DE VOLTA"}</p><h1 className="mt-2 font-display text-3xl font-extrabold md:text-4xl">{mode === "cadastro" ? "Crie sua conta" : "Entre na Caronaa"}</h1><p className="mt-1 text-sm text-muted-foreground">{mode === "cadastro" ? "Comece a compartilhar caminhos." : "Continue de onde parou."}</p></div><ThemeToggle className="shrink-0"/></div><Button type="button" variant="outline" className="h-12 w-full font-bold" onClick={continueWithGoogle} disabled={busy}><span className="text-lg font-extrabold text-primary">G</span> Continuar com Google</Button><div className="my-6 flex items-center gap-4 text-xs text-muted-foreground"><span className="h-px flex-1 bg-border"/>ou use seu e-mail<span className="h-px flex-1 bg-border"/></div><form onSubmit={submit} className="space-y-4">{mode === "cadastro" && <div className="space-y-2"><Label htmlFor="name">Nome completo</Label><div className="relative"><UserRound className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" size={18}/><Input id="name" value={name} onChange={(e) => setName(e.target.value)} className="h-13 bg-auth-field pl-11" autoComplete="name" required/></div></div>}<div className="space-y-2"><Label htmlFor="email">E-mail</Label><div className="relative"><Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" size={18}/><Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="h-13 bg-auth-field pl-11" autoComplete="email" required/></div></div><div className="space-y-2"><Label htmlFor="password">Senha</Label><div className="relative"><LockKeyhole className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" size={18}/><Input id="password" type={showPassword ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} className="h-13 bg-auth-field px-11" autoComplete={mode === "cadastro" ? "new-password" : "current-password"} minLength={6} required/><Button type="button" variant="ghost" size="icon" className="absolute right-1 top-1 size-11" onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}>{showPassword ? <EyeOff size={18}/> : <Eye size={18}/>}</Button></div></div><Button type="submit" className="h-13 w-full text-base font-extrabold" disabled={busy}>{busy ? "Aguarde..." : mode === "cadastro" ? "Criar minha conta" : <>Entrar na Caronaa <ArrowRight size={18}/></>}</Button>{mode === "entrar" && <Button type="button" variant="link" className="mx-auto flex h-auto p-0 text-sm" onClick={sendReset}>Esqueci minha senha</Button>}</form><div className="mt-6 border-t border-border pt-5 text-center text-sm text-muted-foreground">{mode === "entrar" ? "Ainda não tem conta?" : "Já tem uma conta?"} <Button type="button" variant="link" className="h-auto p-0 font-bold" onClick={() => setMode(mode === "entrar" ? "cadastro" : "entrar")}>{mode === "entrar" ? "Cadastre-se" : "Entre"}</Button></div></AuthFrame>;
}

function AuthFrame({ children }: { children: React.ReactNode }) {
  const features = [{ icon: UsersRound, text: "Encontre caronas" }, { icon: MapPinned, text: "Compartilhe trajetos" }, { icon: ShieldCheck, text: "Viaje com segurança" }];
  return <main className="relative grid min-h-screen bg-background lg:grid-cols-[1.12fr_.88fr]"><section className="relative hidden min-h-screen overflow-hidden px-10 py-9 text-primary-foreground lg:flex lg:flex-col lg:justify-between xl:px-14 xl:py-12"><img src={desktopBackground.url} alt="Cidade conectada pelos trajetos da Caronaa" className="absolute inset-0 size-full object-cover"/><div className="absolute inset-0 bg-hero-overlay"/><div className="relative z-10"><Brand light/></div><div className="relative z-10 max-w-xl"><p className="text-sm font-bold uppercase tracking-widest text-primary">SUA CIDADE, SEU CAMINHO</p><h2 className="mt-4 font-display text-5xl font-extrabold leading-[1.08] xl:text-6xl">Seu caminho<br/>pode levar<br/><span className="text-primary">alguém junto.</span></h2><p className="mt-6 max-w-lg text-lg leading-relaxed text-primary-foreground/80">Encontre pessoas indo para a mesma direção, compartilhe o trajeto e transforme deslocamentos em conexões.</p><div className="mt-10 grid grid-cols-3 gap-3">{features.map(({icon: Icon, text}) => <div key={text} className="flex min-h-20 items-center gap-3 rounded-lg border border-primary-foreground/25 bg-primary-foreground/5 px-4 backdrop-blur-sm"><Icon className="shrink-0 text-primary" size={25}/><span className="text-sm font-semibold">{text}</span></div>)}</div></div><p className="relative z-10 flex items-center gap-4 text-sm text-primary-foreground/65"><span className="h-px w-10 bg-primary-foreground/60"/>Juntos chegamos mais longe.</p></section><section className="relative flex min-h-screen items-center justify-center overflow-hidden px-5 py-8 md:px-10"><picture className="absolute inset-0 lg:hidden"><img src={mobileBackground.url} alt="" className="size-full object-cover"/></picture><div className="absolute inset-0 bg-background/88 backdrop-blur-sm lg:hidden"/><div className="relative z-10 w-full max-w-lg rounded-lg border border-border bg-card/95 p-6 shadow-card md:p-9"><div className="mb-7 flex items-center justify-between"><img src={logoAsset.url} alt="CARONAA" className="h-14 w-auto object-contain"/><span className="lg:hidden"><ThemeToggle/></span></div>{children}</div></section></main>;
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