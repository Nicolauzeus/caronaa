import { useEffect, useRef, useState } from "react";
import { Download, Share2, PlusSquare, X, Smartphone } from "lucide-react";
import { toast } from "sonner";
import logoAsset from "@/assets/brand/caronaa-logo.png.asset.json";

interface InstallPrompt extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

// Reappear after the user temporarily dismisses the invitation.
const DISPLAY_DELAY_MS = 30_000;
const REMIND_AFTER_DISMISS_MS = 30_000;
const ELIGIBILITY_CHECK_MS = 5_000;

function installed() {
  return window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true;
}

function eligibleRoute() {
  // An invitation must never obscure onboarding, payment or a running ride.
  return window.location.pathname === "/" || window.location.pathname === "/home";
}

export function PwaInstallNotice() {
  const [prompt, setPrompt] = useState<InstallPrompt | null>(null);
  const [visible, setVisible] = useState(false);
  const [ios, setIos] = useState(false);
  const [safari, setSafari] = useState(false);
  const [busy, setBusy] = useState(false);
  const lastDismissedAt = useRef(0);
  const promptRef = useRef<InstallPrompt | null>(null);
  const installedRef = useRef(false);

  useEffect(() => {
    if (installed()) return;
    const isIos = /iPhone|iPad|iPod/.test(navigator.userAgent) ||
      (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
    const isSafari = /Safari/i.test(navigator.userAgent) &&
      !/CriOS|FxiOS|EdgiOS|OPiOS/i.test(navigator.userAgent);
    setIos(isIos);
    setSafari(isSafari);

    // Both landing (signed out) and Home (signed in) stay eligible.
    // Do not gate on viewport size, login state, or a seven-day dismissal.
    const startedAt = Date.now();
    const checkEligibility = () => {
      const canShow = !installedRef.current &&
        !installed() && eligibleRoute() && !document.hidden &&
        window.isSecureContext &&
        Date.now() - startedAt >= DISPLAY_DELAY_MS &&
        Date.now() - lastDismissedAt.current >= REMIND_AFTER_DISMISS_MS;
      setVisible(canShow);
    };
    // Route changes in TanStack Router use pushState, which does not emit
    // popstate. Periodic checks also cover logged-in/logged-out Home changes.
    const eligibilityTimer = window.setInterval(checkEligibility, ELIGIBILITY_CHECK_MS);

    const beforeInstall = (event: Event) => {
      event.preventDefault();
      promptRef.current = event as InstallPrompt;
      setPrompt(event as InstallPrompt);
      checkEligibility();
    };
    const onInstalled = () => {
      installedRef.current = true;
      setVisible(false);
      promptRef.current = null;
      setPrompt(null);
    };
    const onNavigation = () => { checkEligibility(); };
    window.addEventListener("beforeinstallprompt", beforeInstall);
    window.addEventListener("appinstalled", onInstalled);
    window.addEventListener("popstate", onNavigation);
    window.addEventListener("hashchange", onNavigation);
    document.addEventListener("visibilitychange", onNavigation);
    window.addEventListener("focus", onNavigation);
    const displayMode = window.matchMedia("(display-mode: standalone)");
    displayMode.addEventListener?.("change", onNavigation);
    checkEligibility();
    return () => {
      window.removeEventListener("beforeinstallprompt", beforeInstall);
      window.removeEventListener("appinstalled", onInstalled);
      window.removeEventListener("popstate", onNavigation);
      window.removeEventListener("hashchange", onNavigation);
      document.removeEventListener("visibilitychange", onNavigation);
      window.removeEventListener("focus", onNavigation);
      window.clearInterval(eligibilityTimer);
      displayMode.removeEventListener?.("change", onNavigation);
    };
  }, []);

  function dismiss() {
    lastDismissedAt.current = Date.now();
    setVisible(false);
  }

  async function install() {
    if (!prompt || busy) return;
    setBusy(true);
    try {
      await prompt.prompt();
      const choice = await prompt.userChoice;
      // Some browsers report acceptance before the appinstalled event fires.
      // Never mark installation complete without the browser confirmation.
      dismiss();
      if (choice.outcome === "accepted") {
        promptRef.current = null;
      }
    } catch {
      toast.error("Não foi possível abrir a instalação. Tente pelo menu do navegador.");
    } finally {
      promptRef.current = null;
      setPrompt(null);
      setBusy(false);
    }
  }

  if (!visible) return null;

  return (
    <aside
      role="region"
      aria-label="Instalar CARONAA"
      className="fixed inset-x-3 bottom-[calc(env(safe-area-inset-bottom,0px)+12px)] z-50 mx-auto max-h-[min(85dvh,560px)] max-w-sm overflow-y-auto rounded-[24px] border border-white/15 bg-[#121212] p-5 text-white shadow-[0_18px_70px_rgba(0,0,0,.42)]"
    >
      <div className="flex items-start gap-3">
        <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-[#FFBB00] p-1.5">
          <img src={logoAsset.url} alt="Logotipo oficial do CARONAA" className="h-full w-full object-contain" />
        </div>
        <div className="min-w-0 flex-1 pt-1">
          <p className="font-['Sora'] text-base font-bold tracking-tight">CARONAA</p>
          <p className="mt-1 text-xs text-white/65">Seu próximo destino começa aqui.</p>
        </div>
        <button type="button" onClick={dismiss} aria-label="Fechar aviso de instalação" title="Fechar aviso de instalação" className="flex size-11 shrink-0 items-center justify-center rounded-full text-white/70 transition-colors hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#FFBB00]">
          <X size={20} aria-hidden="true" />
        </button>
      </div>

      <h2 className="mt-5 font-['Sora'] text-xl font-bold leading-snug">
        {ios ? "Instale o CARONAA no seu iPhone" : "Instale a CARONAA"}
      </h2>
      <p className="mt-2 text-sm leading-relaxed text-white/75">
        {ios
          ? "Adicione o CARONAA à sua Tela de Início e acesse suas caronas com um toque."
          : "Leve o CARONAA com você! Suas caronas sempre a um toque de distância."}
      </p>

      {ios ? (
        <div className="mt-4 space-y-2" aria-label="Como instalar no iPhone">
          {!safari && (
            <p className="rounded-xl bg-white/10 px-3 py-2 text-xs leading-relaxed text-white/85">
              Abra esta página no Safari para seguir as etapas de instalação.
            </p>
          )}
          <div className="flex items-center gap-3 rounded-xl bg-white/10 p-3">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-[#FFBB00] text-sm font-extrabold text-[#121212]">1</span>
            <p className="min-w-0 flex-1 text-sm">Toque em <strong>Compartilhar</strong> no Safari</p>
            <Share2 className="shrink-0 text-[#FFBB00]" size={22} aria-hidden="true" />
          </div>
          <div className="flex items-center gap-3 rounded-xl bg-white/10 p-3">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-[#FFBB00] text-sm font-extrabold text-[#121212]">2</span>
            <p className="min-w-0 flex-1 text-sm">Selecione <strong>Adicionar à Tela de Início</strong> e confirme</p>
            <PlusSquare className="shrink-0 text-[#FFBB00]" size={22} aria-hidden="true" />
          </div>
        </div>
      ) : prompt ? (
        <button type="button" disabled={busy} onClick={() => void install()} className="mt-5 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#FFBB00] px-4 text-base font-bold text-[#121212] transition-colors hover:bg-[#ffd04d] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white disabled:opacity-60">
          <Download size={20} aria-hidden="true" />
          {busy ? "Aguarde..." : "Instalar"}
        </button>
      ) : (
        <p className="mt-4 rounded-xl bg-white/10 p-3 text-sm text-white/85">
          Para instalar, abra o menu do navegador e escolha <strong>Instalar aplicativo</strong> ou <strong>Adicionar à tela inicial</strong>, se disponível.
        </p>
      )}
      <div className="mt-4 flex items-center justify-center gap-2 text-center text-[11px] text-white/55">
        <Smartphone size={13} aria-hidden="true" />
        <span>Gratuito · Acesso rápido · Sem loja de aplicativos</span>
      </div>
    </aside>
  );
}
