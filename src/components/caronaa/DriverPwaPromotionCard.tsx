import { useEffect, useState } from "react";
import { Download, PlusSquare, Share2, Smartphone } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { getInstallPrompt, isIosDevice, isStandaloneApp, onInstallPromptChange, setInstallPrompt } from "@/lib/push/install-prompt";

/** Driver-only install invitation. Hidden entirely when already running as an installed app. */
export function DriverPwaPromotionCard() {
  const [show, setShow] = useState(false);
  const [ios, setIos] = useState(false);
  const [hasPrompt, setHasPrompt] = useState(false);
  const [guide, setGuide] = useState(false);

  useEffect(() => {
    if (isStandaloneApp()) return;
    setShow(true); setIos(isIosDevice()); setHasPrompt(Boolean(getInstallPrompt()));
    const off = onInstallPromptChange(() => setHasPrompt(Boolean(getInstallPrompt())));
    const installed = () => setShow(false);
    window.addEventListener("appinstalled", installed);
    return () => { off(); window.removeEventListener("appinstalled", installed); };
  }, []);
  if (!show) return null;

  const install = async () => {
    const prompt = getInstallPrompt();
    if (prompt && !ios) {
      await prompt.prompt();
      const { outcome } = await prompt.userChoice.catch(() => ({ outcome: "dismissed" as const }));
      setInstallPrompt(null);
      if (outcome === "accepted") setShow(false);
      return;
    }
    setGuide(true);
  };

  return <>
    <div role="region" aria-label="Instalar app CARONAA"
      className="rounded-2xl border border-primary/60 bg-primary/10 p-3 text-foreground">
      <div className="flex items-start gap-3">
        <Smartphone className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden />
        <div className="min-w-0 flex-1">
          <p className="font-bold leading-tight" style={{ fontFamily: "Sora, sans-serif" }}>
            Instale o app para não perder chamados
          </p>
          <p className="mt-1 text-xs leading-snug text-muted-foreground">
            Instalando na sua tela inicial, o app mantém a tela ativa no suporte e você recebe alertas sonoros com o celular bloqueado.
          </p>
          <button type="button" onClick={() => void install()}
            className="mt-2 inline-flex min-h-10 items-center gap-2 rounded-xl bg-primary px-4 text-sm font-bold text-primary-foreground">
            <Download className="size-4" aria-hidden /> {hasPrompt && !ios ? "Instalar agora" : "Como instalar"}
          </button>
        </div>
      </div>
    </div>
    <Dialog open={guide} onOpenChange={setGuide}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Adicionar à Tela de Início</DialogTitle>
          <DialogDescription>
            {ios ? "No Safari, siga estes dois passos:" : "No menu do navegador, siga estes passos:"}
          </DialogDescription>
        </DialogHeader>
        <ol className="space-y-3 text-sm">
          <li className="flex items-center gap-3"><Share2 className="size-5 text-primary" aria-hidden />
            1. Toque em <b>{ios ? "Compartilhar" : "⋮ Menu"}</b></li>
          <li className="flex items-center gap-3"><PlusSquare className="size-5 text-primary" aria-hidden />
            2. Escolha <b>{ios ? "Adicionar à Tela de Início" : "Instalar app"}</b></li>
        </ol>
        {ios && <p className="text-xs text-muted-foreground">Abra o CARONAA pelo ícone novo para receber os alertas.</p>}
      </DialogContent>
    </Dialog>
  </>;
}
