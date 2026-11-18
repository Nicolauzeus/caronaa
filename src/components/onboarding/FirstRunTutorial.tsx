import { useEffect, useState } from "react";
import { ArrowRight, CarFront, Check, ChevronRight, MapPin, Pause, Play, Route as RouteIcon, ShieldCheck, SkipForward, UserRound, X } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { readOnboarding, markIntroSeen } from "@/lib/onboarding/progressive-onboarding";
import { getMyResearchLaunchState } from "@/lib/research-launch";
import { toast } from "sonner";

type InitialRole = "PASSAGEIRO" | "MOTORISTA";
const slides = {
  PASSAGEIRO: [
    { icon: MapPin, title: "Escolha seu caminho", body: "Informe de onde sai e aonde quer chegar. Você pode digitar o endereço sem ativar o GPS.", step: "Origem e destino" },
    { icon: RouteIcon, title: "Encontre sua viagem", body: "Compare opções de carona compartilhada ou escolha Viajar Agora quando estiver disponível.", step: "Escolher modalidade" },
    { icon: ShieldCheck, title: "Peça e acompanhe", body: "Revise o embarque e o preço antes de pedir. Acompanhe sua solicitação na área de viagens.", step: "Confirmar e acompanhar" },
  ],
  MOTORISTA: [
    { icon: CarFront, title: "Escolha seu veículo", body: "Ao oferecer a primeira carona, informe se vai usar carro ou moto. Você não precisa criar outra conta.", step: "Carro ou moto" },
    { icon: RouteIcon, title: "Ofereça sua carona", body: "Cadastre seu trajeto e vagas. Para atuar profissionalmente, solicite a autorização específica.", step: "Oferta ou habilitação" },
    { icon: ShieldCheck, title: "Gerencie suas viagens", body: "Acompanhe pedidos e confirmações. O transporte profissional só funciona após aprovação e regras operacionais.", step: "Gerenciar solicitações" },
  ],
} as const;

export function FirstRunTutorial() {
  const { user } = useAuth();
  const [role, setRole] = useState<InitialRole | null>(null);
  const [open, setOpen] = useState(false);
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReducedMotion(media.matches);
    const update = () => setReducedMotion(media.matches);
    media.addEventListener?.("change", update);
    return () => media.removeEventListener?.("change", update);
  }, []);

  useEffect(() => {
    if (!user?.id || !user.email_confirmed_at) return;
    let active = true;
    void Promise.all([readOnboarding(), getMyResearchLaunchState()]).then(([progress, launch]) => {
      if (!active || launch.locked || progress?.status !== "BASIC_COMPLETED") return;
      const candidate = progress.usage_role === "MOTORISTA" ? "MOTORISTA" : "PASSAGEIRO";
      setRole(candidate);
      if (progress.tutorial_eligible === true && !progress.tutorial_seen_at) {
        setOpen(true);
      }
    }).catch(() => {
      // Tutorial is optional; never block access when this data is unavailable.
    });
    return () => { active = false; };
  }, [user?.id, user?.email_confirmed_at]);

  useEffect(() => {
    const replay = () => {
      if (!role) return;
      setIndex(0);
      setPaused(false);
      setOpen(true);
    };
    window.addEventListener("caronaa:replay-intro", replay);
    return () => window.removeEventListener("caronaa:replay-intro", replay);
  }, [role]);

  const currentSlides = role ? slides[role] : slides.PASSAGEIRO;
  useEffect(() => {
    if (!open || paused || reducedMotion || index >= currentSlides.length - 1) return;
    const timer = window.setTimeout(() => setIndex(value => value + 1), 4800);
    return () => window.clearTimeout(timer);
  }, [open, paused, reducedMotion, index, currentSlides.length]);

  async function dismiss() {
    if (saving) return;
    setSaving(true);
    try {
      // Idempotent visual preference; never changes account rights.
      await markIntroSeen();
      setOpen(false);
    } catch {
      // Failure to save should be visible; leave the tutorial for retry.
      toast.error("Não foi possível salvar que o tutorial foi visto. Tente novamente.");
    } finally {
      setSaving(false);
    }
  }

  if (!open || !role) return null;
  const current = currentSlides[index];
  const Icon = current.icon;
  return (
    <div className="fixed inset-0 z-[100] grid h-[100dvh] place-items-center overflow-y-auto bg-[#050505]/90 p-4 backdrop-blur-md"
      role="dialog" aria-modal="true" aria-labelledby="caronaa-intro-heading">
      <div className="my-auto w-full max-w-md overflow-hidden rounded-3xl border border-[#FFBB00]/25 bg-[#171717] p-5 text-white shadow-2xl sm:p-7">
        <div className="flex items-center justify-between">
          <span className="text-sm font-black tracking-wider text-[#FFBB00]">CARONAA · PRIMEIROS PASSOS</span>
          <button type="button" aria-label="Pular tutorial" disabled={saving} onClick={() => void dismiss()}
            className="flex size-11 items-center justify-center rounded-xl text-white/75 hover:bg-white/10"><X size={20}/></button>
        </div>
        <p className="mt-3 text-xs text-white/60">{role === "MOTORISTA" ? "Guia para motoristas" : "Guia para passageiros"} · {index + 1} de {currentSlides.length}</p>
        <div className="mt-3 grid grid-cols-3 gap-2">
          {currentSlides.map((slide, position) => (
            <div key={slide.step} aria-hidden="true" className={`h-1.5 rounded-full ${position <= index ? "bg-[#FFBB00]" : "bg-white/15"}`} />
          ))}
        </div>
        <div key={index} className="flex min-h-64 flex-col items-center justify-center py-7 text-center motion-safe:animate-in motion-safe:fade-in motion-safe:duration-300">
          <div className="relative mb-6 flex size-28 items-center justify-center rounded-3xl border border-[#FFBB00]/30 bg-[#FFBB00]/10">
            <Icon size={55} strokeWidth={1.6} className="text-[#FFBB00] motion-safe:animate-pulse" aria-hidden="true"/>
          </div>
          <p className="text-xs font-bold uppercase tracking-widest text-[#FFBB00]">{current.step}</p>
          <h2 id="caronaa-intro-heading" className="mt-2 font-display text-2xl font-bold">{current.title}</h2>
          <p className="mt-3 max-w-sm text-sm leading-6 text-white/70">{current.body}</p>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => setPaused(value => !value)} aria-label={paused ? "Reproduzir animação" : "Pausar animação"}
            className="flex size-12 shrink-0 items-center justify-center rounded-xl border border-white/20 text-white/80">
            {paused ? <Play size={19}/> : <Pause size={19}/>}
          </button>
          <button type="button" onClick={() => void dismiss()} disabled={saving}
            className="min-h-12 px-3 text-sm text-white/70 underline underline-offset-4">
            Pular
          </button>
          {index < currentSlides.length - 1 ? (
            <button type="button" onClick={() => setIndex(value => Math.min(value + 1, currentSlides.length - 1))}
              className="ml-auto flex min-h-12 flex-1 items-center justify-center gap-2 rounded-xl bg-[#FFBB00] px-3 font-bold text-[#121212]">
              Próximo <ChevronRight size={18}/>
            </button>
          ) : (
            <button type="button" onClick={() => void dismiss()} disabled={saving}
              className="ml-auto flex min-h-12 flex-1 items-center justify-center gap-2 rounded-xl bg-[#FFBB00] px-3 font-bold text-[#121212]">
              {saving ? "Salvando…" : "Começar a usar"} <ArrowRight size={18}/>
            </button>
          )}
        </div>
        <p className="mt-3 text-center text-xs text-white/45">Você poderá rever este guia no Perfil.</p>
      </div>
    </div>
  );
}
