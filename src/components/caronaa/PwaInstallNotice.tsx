import { useEffect, useRef, useState } from "react";
import { Download, X } from "lucide-react";
import { toast } from "sonner";
import logoAsset from "@/assets/brand/caronaa-logo.png.asset.json";

interface InstallPrompt extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export function PwaInstallNotice() {
  const [prompt, setPrompt] = useState<InstallPrompt | null>(null);
  const [visible, setVisible] = useState(false);
  const [ios, setIos] = useState(false);
  const [busy, setBusy] = useState(false);
  const dismissedRef = useRef(false);

  useEffect(() => {
    const standalone = window.matchMedia("(display-mode: standalone)");
    const isInstalled = () => standalone.matches ||
      (navigator as Navigator & { standalone?: boolean }).standalone === true;
    if (isInstalled()) return;
    const mobile = window.matchMedia("(max-width: 767px)");
    let dismissed = false;
    try { dismissed = sessionStorage.getItem("caronaa-install-dismissed") === "1"; } catch { /* Storage can be disabled. */ }
    dismissedRef.current = dismissed;
    const isIos = /iPhone|iPad|iPod/.test(navigator.userAgent) ||
      (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
    setIos(isIos);
    if (isIos && mobile.matches && window.isSecureContext && !dismissed) setVisible(true);
    const beforeInstall = (event: Event) => {
      event.preventDefault();
      setPrompt(event as InstallPrompt);
      if (mobile.matches && !dismissedRef.current && !isInstalled()) setVisible(true);
    };
    const installed = () => { setVisible(false); setPrompt(null); };
    window.addEventListener("beforeinstallprompt", beforeInstall);
    window.addEventListener("appinstalled", installed);
    standalone.addEventListener("change", installed);
    return () => {
      window.removeEventListener("beforeinstallprompt", beforeInstall);
      window.removeEventListener("appinstalled", installed);
      standalone.removeEventListener("change", installed);
    };
  }, []);

  function dismiss() {
    dismissedRef.current = true;
    setVisible(false);
    try { sessionStorage.setItem("caronaa-install-dismissed", "1"); } catch { /* Keep dismissal in memory. */ }
  }

  async function install() {
    if (!prompt || busy) return;
    setBusy(true);
    try {
      await prompt.prompt();
      await prompt.userChoice;
      dismiss();
    } catch {
      toast.error("Não foi possível abrir a instalação. Tente pelo menu do navegador.");
    } finally {
      setPrompt(null);
      setBusy(false);
    }
  }

  if (!visible) return null;
  return (
    <aside role="region" aria-label="Instalar CARONAA" className="fixed inset-x-3 top-20 z-50 rounded-lg border border-border bg-background p-4 text-foreground shadow-lg md:hidden">
      <div className="flex items-start gap-3">
        <img src={logoAsset.url} alt="CARONAA" className="h-12 w-12 shrink-0 object-contain" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold">Instale a CARONAA</p>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            {ios ? "No Safari, toque em Compartilhar e em Adicionar à Tela de Início." : "Tenha a CARONAA na tela inicial do seu celular."}
          </p>
          {!ios && prompt && <button type="button" disabled={busy} onClick={install} className="mt-3 inline-flex min-h-11 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-bold text-primary-foreground disabled:opacity-50">
            <Download size={16} aria-hidden="true" /> {busy ? "Aguarde..." : "Instalar"}
          </button>}
        </div>
        <button type="button" onClick={dismiss} aria-label="Fechar aviso de instalação" title="Fechar aviso de instalação" className="flex size-11 shrink-0 items-center justify-center rounded-lg hover:bg-muted"><X size={18} /></button>
      </div>
    </aside>
  );
}
