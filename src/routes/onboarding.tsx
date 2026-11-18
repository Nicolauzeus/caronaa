import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowRight, CarFront, Check, UserRound } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth-context";
import { getMyResearchLaunchState } from "@/lib/research-launch";
import { resolvePostOnboardingDestination } from "@/lib/onboarding/research-gate";
import { completeOnboarding, readOnboarding, saveOnboarding, type UsageRole } from "@/lib/onboarding/progressive-onboarding";
import logoAsset from "@/assets/brand/caronaa-logo.png.asset.json";

export const Route = createFileRoute("/onboarding")({ ssr: false, component: OnboardingPage });

type InitialRole = "PASSAGEIRO" | "MOTORISTA";
const isInitialRole = (value: unknown): value is InitialRole =>
  value === "PASSAGEIRO" || value === "MOTORISTA";

function OnboardingPage() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [role, setRole] = useState<InitialRole | null>(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const autoStarted = useRef(false);

  const finish = useCallback(async (selectedRole: InitialRole) => {
    setBusy(true);
    setError("");
    try {
      // Account owner explicitly chose this UX preference. This is not a driver permission.
      const saved = await saveOnboarding({ usage_role: selectedRole as UsageRole, current_step: "ROLE" });
      // Preserve launch-state error handling: a backend failure must not bypass campaign gates.
      await getMyResearchLaunchState();
      await completeOnboarding(saved);
      sessionStorage.removeItem("caronaa:oauth-role-preference");
      await navigate({ to: await resolvePostOnboardingDestination(), replace: true });
    } catch (cause) {
      const text = cause instanceof Error ? cause.message : "Não foi possível concluir seu cadastro.";
      setError(text);
      toast.error(text);
    } finally {
      setBusy(false);
    }
  }, [navigate]);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      void navigate({ to: "/auth", search: { mode: "entrar", redirect: "/onboarding" }, replace: true });
      return;
    }
    if (!user.email_confirmed_at) {
      void navigate({ to: "/auth", search: { mode: "entrar" }, replace: true });
      return;
    }
    let active = true;
    void readOnboarding().then(async progress => {
      if (!active) return;
      if (progress?.status === "BASIC_COMPLETED") {
        await navigate({ to: await resolvePostOnboardingDestination(), replace: true });
        return;
      }
      const metadataRole = user.user_metadata?.initial_usage_role;
      // OAuth preference only, never an authorization/grant or proof of driver readiness.
      const pendingOAuthRole = sessionStorage.getItem("caronaa:oauth-role-preference");
      const chosen = isInitialRole(progress?.usage_role) ? progress.usage_role :
        isInitialRole(metadataRole) ? metadataRole :
        isInitialRole(pendingOAuthRole) ? pendingOAuthRole : null;
      if (!active) return;
      setRole(chosen);
      setLoading(false);
      if (chosen && !autoStarted.current) {
        autoStarted.current = true;
        await finish(chosen);
      }
    }).catch(cause => {
      if (!active) return;
      setError(cause instanceof Error ? cause.message : "Não foi possível verificar seu cadastro.");
      setLoading(false);
    });
    return () => { active = false; };
  }, [authLoading, user?.id, user?.email_confirmed_at, navigate, finish]);

  if (authLoading || loading) return (
    <main className="grid h-[100dvh] place-items-center bg-[#121212] text-white">
      <p role="status" className="animate-pulse text-sm">Preparando seu acesso…</p>
    </main>
  );

  return (
    <main className="flex h-[100dvh] overflow-hidden bg-[#121212] px-4 py-4 font-sans text-white">
      <div className="m-auto w-full max-w-md overflow-y-auto overscroll-contain rounded-3xl border border-white/10 bg-[#191919] p-5 shadow-2xl sm:p-8">
        <img src={logoAsset.url} alt="CARONAA" className="h-12 w-auto object-contain" />
        <div className="mt-6 h-1.5 overflow-hidden rounded-full bg-white/10">
          <div className="h-full w-full rounded-full bg-[#FFBB00]" />
        </div>
        <p className="mt-5 text-xs font-bold uppercase tracking-widest text-[#FFBB00]">Último passo</p>
        <h1 className="mt-2 font-display text-2xl font-bold">Como você quer começar?</h1>
        <p className="mt-2 text-sm leading-relaxed text-white/65">
          Uma conta para pedir e oferecer caronas. Você poderá mudar de atividade quando quiser.
        </p>
        <div className="mt-6 grid gap-3" role="group" aria-label="Escolha como usar a CARONAA">
          {([
            { id: "PASSAGEIRO" as const, title: "Passageiro", text: "Quero encontrar ou solicitar viagens.", Icon: UserRound },
            { id: "MOTORISTA" as const, title: "Motorista", text: "Quero oferecer caronas ou solicitar habilitação profissional.", Icon: CarFront },
          ]).map(item => (
            <button key={item.id} type="button" aria-pressed={role === item.id}
              onClick={() => setRole(item.id)}
              className={`flex min-h-20 w-full items-center gap-3 rounded-2xl border p-4 text-left transition focus-visible:outline-2 focus-visible:outline-[#FFBB00] ${role === item.id ? "border-[#FFBB00] bg-[#FFBB00]/10" : "border-white/15 bg-white/[0.04]"}`}>
              <item.Icon size={26} className="shrink-0 text-[#FFBB00]" />
              <span className="flex-1"><strong className="block text-sm">{item.title}</strong><span className="block text-xs text-white/60">{item.text}</span></span>
              {role === item.id && <Check size={20} className="text-[#FFBB00]" />}
            </button>
          ))}
        </div>
        {error && <p role="alert" className="mt-4 rounded-xl border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-200">{error}</p>}
        <button type="button" disabled={!role || busy} onClick={() => role && void finish(role)}
          className="mt-6 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#FFBB00] px-4 font-bold text-[#121212] disabled:opacity-50">
          {busy ? "Concluindo…" : "Começar a usar"} <ArrowRight size={18} />
        </button>
        <p className="mt-4 text-center text-xs text-white/50">
          Região, universidade e veículo poderão ser informados quando forem necessários. O uso profissional exige autorização.
        </p>
      </div>
    </main>
  );
}
