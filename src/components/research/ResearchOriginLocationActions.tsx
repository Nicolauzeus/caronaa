import { useEffect, useRef, useState } from "react";
import { Loader2, MapPin, Search } from "lucide-react";
import { reverseGeocodeServerFn } from "@/lib/location.functions";

type Props = {
  currentArea: string;
  onChooseArea: (area: string) => void;
  onSearch: () => void;
};

/** Mobile-first controls for F01 research: only a locality is persisted. */
export function ResearchOriginLocationActions({ currentArea, onChooseArea, onSearch }: Props) {
  const [locating, setLocating] = useState(false);
  const [message, setMessage] = useState<{ type: "error" | "success"; text: string } | null>(null);
  const requestId = useRef(0);
  const previousArea = useRef(currentArea);
  const latestCallback = useRef(onChooseArea);
  latestCallback.current = onChooseArea;

  useEffect(() => {
    // Never overwrite text that someone typed while GPS was resolving.
    if (previousArea.current !== currentArea) {
      previousArea.current = currentArea;
      requestId.current += 1;
      setLocating(false);
    }
  }, [currentArea]);
  useEffect(() => () => { requestId.current += 1; }, []);

  function fail(id: number, text: string) {
    if (id !== requestId.current) return;
    setMessage({ type: "error", text });
    setLocating(false);
  }

  function useCurrentLocation() {
    const id = ++requestId.current;
    if (typeof navigator === "undefined" || !navigator.geolocation ||
        (typeof window !== "undefined" && window.isSecureContext === false)) {
      fail(id, "Localização atual indisponível. Use Buscar localização ou digite o bairro normalmente.");
      return;
    }
    setLocating(true);
    setMessage(null);
    try {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          void (async () => {
            try {
              const location = await reverseGeocodeServerFn({
                data: { lat: position.coords.latitude, lng: position.coords.longitude },
              });
              if (id !== requestId.current) return;
              const area = [location?.neighborhood, location?.city]
                .filter(Boolean).join(" · ").trim().slice(0, 120);
              if (area.length < 2) throw Error("Região aproximada indisponível");
              latestCallback.current(area);
              setMessage({ type: "success", text: "Região aproximada preenchida. Você pode alterá-la." });
              setLocating(false);
            } catch {
              fail(id, "Não foi possível identificar o bairro. Busque ou digite a região manualmente.");
            }
          })();
        },
        () => fail(id, "Sem acesso à localização atual. Você pode buscar ou digitar o bairro normalmente."),
        { enableHighAccuracy: false, timeout: 10000, maximumAge: 60000 },
      );
    } catch {
      fail(id, "Não foi possível obter a localização. Busque ou digite o bairro normalmente.");
    }
  }

  function openSearch() {
    requestId.current += 1;
    setLocating(false);
    setMessage(null);
    onSearch();
  }

  const buttonClass =
    "flex min-h-12 min-w-0 items-center justify-center gap-1.5 rounded-xl border border-primary/50 bg-primary/5 px-2 py-2 text-xs font-semibold leading-tight text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-50";
  return (
    <div role="group" aria-label="Ferramentas de localização" className="min-w-0 space-y-2">
      <div className="grid min-w-0 grid-cols-2 gap-2">
        <button type="button" aria-label="Usar localização atual" className={buttonClass}
          onClick={useCurrentLocation} disabled={locating}>
          {locating
            ? <Loader2 size={16} className="shrink-0 animate-spin" aria-hidden="true" />
            : <MapPin size={16} className="shrink-0" aria-hidden="true" />}
          <span>{locating ? "Localizando…" : "Usar localização atual"}</span>
        </button>
        <button type="button" aria-label="Buscar localização" className={buttonClass} onClick={openSearch}>
          <Search size={16} className="shrink-0" aria-hidden="true" />
          <span>Buscar localização</span>
        </button>
      </div>
      <p className="text-xs leading-5 text-muted-foreground">
        GPS opcional. Informe seu bairro ou região; não precisamos do endereço residencial.
      </p>
      {message && <p role={message.type === "error" ? "alert" : "status"}
        className={"text-xs leading-5 " + (message.type === "error" ? "text-destructive" : "text-emerald-700 dark:text-emerald-400")}>
        {message.text}
      </p>}
    </div>
  );
}
