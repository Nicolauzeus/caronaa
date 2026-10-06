import { ArrowRight, MapPin, Calendar, Clock, Sparkles } from "lucide-react";
import { BrandLogo, StsBadge, UniforHubBadge } from "@/components/caronaa/BrandElements";
import desktopArtwork from "@/assets/summitdesktop.png";
import mobileArtwork from "@/assets/summitmobile.jpeg";

type FormIntroProps = {
  onStart: () => void;
};

export function FormIntro({ onStart }: FormIntroProps) {
  return (
    <section className="relative isolate flex min-h-[calc(100svh-4rem)] overflow-hidden bg-caronaa-dark text-white">
      {/* Background Hero Image */}
      <picture className="absolute inset-0 -z-20 opacity-35">
        <source media="(min-width: 768px)" srcSet={desktopArtwork} />
        <img
          src={mobileArtwork}
          alt=""
          fetchPriority="high"
          decoding="async"
          className="h-full w-full object-cover object-center"
        />
      </picture>

      <div
        aria-hidden="true"
        className="absolute inset-0 -z-10 bg-gradient-to-t from-[#0b0f19] via-[#0b0f19]/85 to-transparent md:bg-gradient-to-r md:from-[#0b0f19] md:via-[#0b0f19]/80 md:to-transparent"
      />

      <div className="mx-auto flex w-full max-w-5xl items-center justify-center px-4 py-8 sm:px-6 md:py-14">
        <div className="w-full max-w-2xl rounded-3xl border border-white/10 bg-[#0b0f19]/80 p-6 sm:p-10 shadow-2xl backdrop-blur-xl">
          {/* Header Institucional com Hierarquia de Marcas:
              1. CARONAA = Marca Principal
              2. Siará Tech Summit = Contexto do evento
              3. Unifor Hub = Ecossistema da startup
              4. Sebrae = Realização do evento
          */}
          <div className="border-b border-white/10 pb-6 space-y-2.5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <BrandLogo size="md" />
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs font-medium text-white/90 shadow-2xs backdrop-blur-md"
                  title="Startup incubada/residente no ecossistema de inovação Unifor Hub"
                >
                  <span className="size-1.5 rounded-full bg-caronaa-primary shrink-0" />
                  <span>Startup do Unifor Hub</span>
                </span>
                <span
                  className="inline-flex items-center gap-1.5 rounded-full border border-cyan-500/30 bg-cyan-950/40 px-3 py-1 text-xs font-semibold text-cyan-300 shadow-2xs backdrop-blur-md"
                  title="Startup expositora oficial no Siará Tech Summit 2026"
                >
                  <span className="relative flex size-1.5 shrink-0">
                    <span className="absolute inline-flex size-full animate-ping rounded-full bg-pink-500 opacity-60" />
                    <span className="relative inline-flex size-1.5 rounded-full bg-cyan-400" />
                  </span>
                  <span>Expositora no Siará Tech Summit 2026</span>
                </span>
              </div>
            </div>
            <div className="flex items-center justify-end">
              <span className="text-[10px] font-medium text-white/50 tracking-wider uppercase">
                Evento realizado pelo Sebrae Ceará
              </span>
            </div>
          </div>

          <div className="mt-6 space-y-4">
            <div className="inline-flex items-center gap-2 rounded-full border border-caronaa-primary/30 bg-caronaa-primary/10 px-3.5 py-1.5 text-xs font-semibold text-caronaa-primary">
              <Sparkles size={14} />
              Validação oficial no Siará Tech Summit 2026
            </div>

            <h1 className="font-display text-3xl font-extrabold tracking-tight sm:text-4xl lg:text-5xl text-white">
              Garanta sua CARONAA no <span className="text-caronaa-primary">Siará Tech Summit</span>{" "}
              🚗
            </h1>

            <p className="text-base leading-relaxed text-white/80 sm:text-lg">
              Estamos testando a CARONAA em situações reais. Conte seu trajeto e veja como podemos
              conectar você a pessoas que vão na mesma direção com conforto e agilidade.
            </p>
          </div>

          {/* Quick Info Grid */}
          <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 p-3.5 backdrop-blur-sm">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-caronaa-primary/20 text-caronaa-primary">
                <MapPin size={18} />
              </span>
              <div>
                <p className="text-[11px] font-medium text-white/60">Ponto de encontro</p>
                <p className="text-xs font-bold text-white">Centro de Eventos do Ceará</p>
              </div>
            </div>

            <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 p-3.5 backdrop-blur-sm">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-event-cyan/20 text-event-cyan">
                <Calendar size={18} />
              </span>
              <div>
                <p className="text-[11px] font-medium text-white/60">Data do evento</p>
                <p className="text-xs font-bold text-white">07 a 09 de outubro</p>
              </div>
            </div>

            <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 p-3.5 backdrop-blur-sm">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-emerald-400/20 text-emerald-400">
                <Clock size={18} />
              </span>
              <div>
                <p className="text-[11px] font-medium text-white/60">Tempo estimado</p>
                <p className="text-xs font-bold text-white">Leva cerca de 1–2 minutos</p>
              </div>
            </div>
          </div>

          {/* Call to Action */}
          <div className="mt-8 space-y-3">
            <button
              type="button"
              onClick={onStart}
              className="group inline-flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl bg-caronaa-primary px-6 py-4 text-base font-bold text-caronaa-dark shadow-lg shadow-caronaa-primary/25 transition-all duration-200 hover:bg-caronaa-primary-strong hover:shadow-xl hover:shadow-caronaa-primary/35 hover:-translate-y-0.5"
            >
              Começar minha CARONAA
              <ArrowRight
                size={18}
                className="transition-transform group-hover:translate-x-1"
                aria-hidden="true"
              />
            </button>

            <p className="text-center text-xs text-white/60">
              Sem burocracia. Suas informações serão analisadas apenas para buscar combinações
              compatíveis durante o evento.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
