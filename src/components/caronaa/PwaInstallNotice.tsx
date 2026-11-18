import { useEffect, useRef, useState } from "react";
import { Download, Share2, PlusSquare, X, Smartphone } from "lucide-react";
import { toast } from "sonner";
import logoAsset from "@/assets/brand/caronaa-logo.png.asset.json";

interface InstallPrompt extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const DISMISS_KEY = "caronaa-install-dismissed-until";
const DISMISS_DURATION_MS = 7 * 24 * 60 * 60 * 1000;

function installed() {
  return window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true;
}

function eligibleRoute() {
  // An invitation must never obscure onboarding, payment or a running ride.
  return window.location.pathname === "/" || window.location.pathname === "/home";
}

function isDismissed() {
  try {
    return Number(localStorage.getItem(DISMISS_KEY) ?? 0) > Date.now() ||
      sessionStorage.getItem("caronaa-install-dismissed") === "1";
  } catch {
    return false;
  }
}

export function PwaInstallNotice() {
  const [prompt, setPrompt] = useState<InstallPrompt | null>(null);
  const [visible, setVisible] = useState(false);
  const [ios, setIos] = useState(false);
  const [safari, setSafari] = useState(false);
  const [busy, setBusy] = useState(false);
  const dismissedRef = useRef(false);

  useEffect(() => {
    if (installed()) return;
    const mobile = window.matchMedia("(max-width: 767px)");
    const isIos = /iPhone|iPad|iPod/.test(navigator.userAgent) ||
      (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
    const isSafari = /Safari/i.test(navigator.userAgent) &&
      !/CriOS|FxiOS|EdgiOS|OPiOS/i.test(navigator.userAgent);
    dismissedRef.current = isDismissed();
    setIos(isIos);
    setSafari(isSafari);

    if (isIos && mobile.matches && window.isSecureContext && !dismissedRef.current && eligibleRoute()) {
      setVisible(true);
    }

    const beforeInstall = (event: Event) => {
      event.preventDefault();
      setPrompt(event as InstallPrompt);
      if (mobile.matches && !dismissedRef.current && !installed() && eligibleRoute()) {
        setVisible(true);
      }
    };
    const onInstalled = () => {
      setVisible(false);
      setPrompt(null);
    };
    const onNavigation = () => {
      if (!eligibleRoute() || installed()) setVisible(false);
    };

    window.addEventListener("beforeinstallprompt", beforeInstall);
    window.addEventListener("appinstalled", onInstalled);
    window.addEventListener("popstate", onNavigation);
    window.addEventListener("hashchange", onNavigation);
    const displayMode = window.matchMedia("(display-mode: standalone)");
    displayMode.addEventListener?.("change", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", beforeInstall);
      window.removeEventListener("appinstalled", onInstalled);
      window.removeEventListener("popstate", onNavigation);
      window.removeEventListener("hashchange", onNavigation);
      displayMode.removeEventListener?.("change", onInstalled);
    };
  }, []);

  function dismiss() {
    dismissedRef.current = true;
    setVisible(false);
    try {
      sessionStorage.setItem("caronaa-install-dismissed", "1");
      localStorage.setItem(DISMISS_KEY, String(Date.now() + DISMISS_DURATION_MS));
    } catch { /* Private browsing may disable storage. */ }
  }

  async function install() {
    if (!prompt || busy) return;
    setBusy(true);
    try {
      await prompt.prompt();
      const choice = await prompt.userChoice;
      if (choice.outcome === "accepted") dismiss();
      else dismiss();
    } catch {
      toast.error("Não foi possível abrir a instalação. Tente pelo menu do navegador.");
    } finally {
      setPrompt(null);
      setBusy(false);
    }
  }

  if (!visible || (!ios && !prompt)) return null;

  return (
    <aside
      role="region"
      aria-label="Instalar CARONAA"
      className="fixed inset-x-3 bottom-[calc(env(safe-area-inset-bottom,0px)+12px)] z-50 mx-auto max-h-[min(85dvh,560px)] max-w-sm overflow-y-auto rounded-[24px] border border-white/15 bg-[#121212] p-5 text-white shadow-[0_18px_70px_rgba(0,0,0,.42)] md:hidden"
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
      ) : (
        <button type="button" disabled={busy} onClick={() => void install()} className="mt-5 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#FFBB00] px-4 text-base font-bold text-[#121212] transition-colors hover:bg-[#ffd04d] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white disabled:opacity-60">
          <Download size={20} aria-hidden="true" />
          {busy ? "Aguarde..." : "Instalar"}
        </button>
      )}
      <div className="mt-4 flex items-center justify-center gap-2 text-center text-[11px] text-white/55">
        <Smartphone size={13} aria-hidden="true" />
        <span>Gratuito · Acesso rápido · Sem loja de aplicativos</span>
      </div>
    </aside>
  );
}
