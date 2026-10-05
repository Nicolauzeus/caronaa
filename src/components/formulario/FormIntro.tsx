import { ArrowRight, CarFront, Clock3, Route, UsersRound } from "lucide-react";
import desktopArtwork from "@/assets/summitdesktop.png";
import mobileArtwork from "@/assets/summitmobile.jpeg";

type FormIntroProps = {
  onStart: () => void;
};

const benefits = [
  { icon: CarFront, label: "Ofereça lugares no seu carro" },
  { icon: Route, label: "Encontre alguém no seu caminho" },
  { icon: UsersRound, label: "Combine uma rota compatível" },
];

export function FormIntro({ onStart }: FormIntroProps) {
  return (
    <section className="relative isolate flex min-h-[calc(100svh-4rem)] overflow-hidden bg-[#070a25] text-white">
      <picture className="absolute inset-0 -z-20">
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
        className="absolute inset-0 -z-10 bg-[linear-gradient(90deg,rgba(5,8,29,0.12)_0%,rgba(5,8,29,0.2)_38%,rgba(5,8,29,0.8)_100%)] md:bg-[linear-gradient(90deg,rgba(5,8,29,0.04)_0%,rgba(5,8,29,0.04)_43%,rgba(5,8,29,0.62)_62%,rgba(5,8,29,0.88)_100%)]"
      />

      <div className="mx-auto flex w-full max-w-[1280px] items-center justify-center px-4 py-8 sm:px-6 md:justify-end md:px-10 md:py-12 lg:px-14">
        <div className="w-full max-w-xl rounded-[2rem] border border-white/15 bg-[#080b28]/75 p-5 shadow-[0_24px_90px_rgba(0,0,0,0.45)] backdrop-blur-xl sm:p-8 md:bg-[#080b28]/70 md:p-10">
          <div className="inline-flex items-center gap-2 rounded-full border border-fuchsia-300/30 bg-fuchsia-300/10 px-3.5 py-2 text-xs font-semibold tracking-wide text-white shadow-[0_0_28px_rgba(217,70,239,0.14)] sm:text-sm">
            <span
              className="size-2 rounded-full bg-[#20e7ed] shadow-[0_0_12px_#20e7ed]"
              aria-hidden="true"
            />
            Validação ao vivo no Siará Tech Summit 2026
          </div>

          <h1 className="mt-5 font-display text-[2rem] font-extrabold leading-[1.08] tracking-tight sm:mt-6 sm:text-4xl md:text-[2.75rem]">
            Vai sair do STS hoje?
            <span className="mt-1 block bg-gradient-to-r from-[#ffe15b] via-[#ffd12d] to-[#ffb928] bg-clip-text text-transparent">
              Sua carona pode estar aqui.
            </span>
          </h1>

          <p className="mt-4 max-w-lg text-sm leading-6 text-white/85 sm:text-base sm:leading-7">
            A CARONAA conecta quem procura e quem oferece carona com origem, destino e horário
            compatíveis — para você voltar do evento com mais facilidade.
          </p>

          <ul className="mt-5 grid gap-2.5 text-sm text-white/90 sm:mt-6 sm:grid-cols-1">
            {benefits.map(({ icon: Icon, label }) => (
              <li key={label} className="flex items-center gap-3">
                <span className="flex size-8 shrink-0 items-center justify-center rounded-xl border border-[#ffe15b]/20 bg-[#ffe15b]/10 text-[#ffe15b]">
                  <Icon size={16} aria-hidden="true" />
                </span>
                <span>{label}</span>
              </li>
            ))}
          </ul>

          <div className="mt-6 sm:mt-8">
            <button
              type="button"
              onClick={onStart}
              className="group inline-flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-[#ffe15b] to-[#ffc52f] px-5 py-3.5 text-base font-extrabold text-[#19162a] shadow-[0_10px_32px_rgba(255,202,47,0.25)] transition duration-200 hover:-translate-y-0.5 hover:shadow-[0_14px_38px_rgba(255,202,47,0.38)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[#080b28]"
            >
              Quero usar a CARONAA hoje
              <ArrowRight
                size={18}
                className="transition-transform group-hover:translate-x-1"
                aria-hidden="true"
              />
            </button>

            <div className="mt-3 flex items-start justify-center gap-2 text-center text-xs leading-5 text-white/70 sm:text-sm">
              <Clock3 size={15} className="mt-0.5 shrink-0 text-[#20e7ed]" aria-hidden="true" />
              <p>
                Leva cerca de 1 minuto. Seus dados serão usados apenas para tentar encontrar uma
                carona compatível durante o evento.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
