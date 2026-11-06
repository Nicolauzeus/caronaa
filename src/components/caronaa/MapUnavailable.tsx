import { MapPin, RotateCw } from "lucide-react";

export function MapUnavailable({ compact = false }: { compact?: boolean }) {
  return (
    <div
      role="alert"
      className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-3 bg-[#121212] px-6 text-center text-white"
    >
      {!compact && (
        <MapPin size={28} className="text-[#FFBB00]" aria-hidden="true" />
      )}
      <p className="text-sm font-semibold">
        Não foi possível carregar o Google Maps
      </p>
      {!compact && (
        <p className="max-w-xs text-xs text-white/75">
          Verifique sua conexão e tente novamente. Você pode continuar pelo
          endereço.
        </p>
      )}
      <button
        type="button"
        onClick={() => window.location.reload()}
        className="flex min-h-11 items-center gap-2 rounded-xl bg-[#FFBB00] px-4 py-2 text-sm font-bold text-[#121212] focus-visible:outline-2 focus-visible:outline-white"
      >
        <RotateCw size={16} aria-hidden="true" /> Recarregar mapa
      </button>
    </div>
  );
}
