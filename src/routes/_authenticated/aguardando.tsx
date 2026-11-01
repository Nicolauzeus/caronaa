import { createFileRoute, Link, useNavigate, useRouter } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  CalendarClock,
  Clock3,
  LockKeyhole,
  MapPin,
  RefreshCw,
  UserRound,
  ArrowRight,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { getMyResearchLaunchState, type ResearchLaunchState } from "@/lib/research-launch";

export const Route = createFileRoute("/_authenticated/aguardando")({
  head: () => ({
    meta: [
      { title: "Aguardando lançamento — CARONAA" },
      {
        name: "description",
        content:
          "Sua participação está registrada. O CARONAA abre para seu grupo na data definida pela organização.",
      },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: ResearchWaitingRoom,
});

function launchDate(iso?: string) {
  if (!iso || !Number.isFinite(Date.parse(iso))) return "em breve";
  return new Intl.DateTimeFormat("pt-BR", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "America/Fortaleza",
  }).format(new Date(iso));
}

function countdown(iso: string | undefined, now: number) {
  if (!iso || !Number.isFinite(Date.parse(iso))) return "Consultando data…";
  const total = Math.max(0, Math.ceil((Date.parse(iso) - now) / 60000));
  if (total === 0) return "Abertura em andamento";
  const days = Math.floor(total / 1440),
    hours = Math.floor((total % 1440) / 60),
    minutes = total % 60;
  return [days ? days + "d" : null, hours ? hours + "h" : null, minutes + "min"]
    .filter(Boolean)
    .join(" ");
}

function ResearchWaitingRoom() {
  const navigate = useNavigate();
  const router = useRouter();
  const [state, setState] = useState<ResearchLaunchState | null>(null);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState("");
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    let mounted = true;
    async function refresh() {
      setNow(Date.now());
      try {
        const result = await getMyResearchLaunchState();
        if (!mounted) return;
        setState(result);
        setError("");
        // Established accounts can follow campaigns without losing their
        // normal app access. Redirect only when there is nothing to follow.
        if (!result.locked && result.launches.length === 0) {
          await router.invalidate();
          if (mounted) void navigate({ to: "/home", replace: true });
        }
      } catch {
        if (mounted) setError("Não foi possível verificar sua liberação. Tente novamente.");
      } finally {
        if (mounted) setBusy(false);
      }
    }
    void refresh();
    const id = window.setInterval(() => void refresh(), 60000);
    const onFocus = () => void refresh();
    window.addEventListener("focus", onFocus);
    return () => {
      mounted = false;
      window.clearInterval(id);
      window.removeEventListener("focus", onFocus);
    };
  }, [navigate, router]);

  const launches = state?.launches ?? [];

  function previewKind(kind?: string) {
    return kind === "PEDIDO"
      ? "Pedido planejado"
      : kind === "OFERTA"
        ? "Oferta planejada"
        : kind === "AMBOS"
          ? "Pedido e oferta planejados"
          : "Participação registrada";
  }

  return (
    <main
      className="min-h-[100dvh] w-full bg-[#111111] text-white"
      aria-label="Aguardando lançamento CARONAA"
    >
      <div className="mx-auto flex min-h-[100dvh] w-full max-w-5xl flex-col justify-between gap-3 px-4 pb-[max(16px,env(safe-area-inset-bottom))] pt-[max(16px,env(safe-area-inset-top))] sm:gap-5 sm:px-6">
        <header className="flex min-h-9 shrink-0 items-center justify-between gap-3">
          <span className="font-display text-lg font-black tracking-[.12em] text-[#ffc451]">
            CARONAA
          </span>
          <span className="max-w-[58%] truncate rounded-full border border-white/20 px-3 py-1.5 text-[11px] font-semibold text-white/80">
            {launches.length > 1
              ? `${launches.length} lançamentos`
              : (state?.institution ?? "Pré-lançamento")}
          </span>
        </header>
        <div className="flex min-h-0 flex-1 flex-col justify-center gap-3 sm:gap-5">
          <div className="space-y-2">
            <p className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-[#ffc451]">
              <CalendarClock size={16} aria-hidden="true" /> {launches.length > 1 ? "Próxima abertura" : "Abertura"}: {launchDate(state?.launchAt)}
            </p>
            <h1 className="font-display text-[clamp(1.65rem,5vw,2.4rem)] font-black leading-tight">
              {launches.length > 1 ? "Seus lançamentos, em um só lugar." : "Seu caminho começa em breve."}
            </h1>
            <p className="text-sm leading-5 text-white/70">
              Acompanhe {launches.length > 1 ? "todas as campanhas" : "sua campanha"} de que
              você participa, com datas e contagens regressivas independentes.
              {state?.locked
                ? " Pedidos, ofertas e reservas serão liberados conforme a programação."
                : " Seu acesso habitual ao aplicativo permanece disponível."}
            </p>
          </div>
          {busy && (
            <p role="status" className="text-sm text-white/70">
              Consultando suas participações…
            </p>
          )}
          {error && (
            <p role="alert" className="text-sm text-amber-300">
              {error}
            </p>
          )}
          {!busy && !error && launches.length > 0 && (
            <div
              role="list"
              aria-label="Lançamentos de pesquisas vinculados à conta"
              className={`grid grid-cols-1 gap-3 ${launches.length > 1 ? "md:grid-cols-2" : ""}`}
            >
              {launches.map((launch) => (
              <section
                key={launch.formId}
                role="listitem"
                aria-label={`Lançamento ${launch.title} · ${launch.formCode}`}
                className="space-y-2 rounded-2xl border border-[#ffc451]/35 bg-white/[.06] p-3.5 sm:p-5"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs font-bold uppercase tracking-wide text-[#ffc451]">
                      {launch.institution}
                    </p>
                    <p className="mt-1 text-sm font-semibold leading-snug text-white">
                      {launch.title}
                    </p>
                    <p className="mt-1 text-xs text-white/55">
                      Pesquisa {launch.formCode} · Abertura: {launchDate(launch.launchAt)}
                    </p>
                  </div>
                  <LockKeyhole
                    size={16}
                    aria-hidden="true"
                    className="mt-1 shrink-0 text-[#ffc451]"
                  />
                </div>
                <p className="inline-flex items-center gap-1 text-[11px] font-bold uppercase tracking-wide text-[#ffc451]">
                  <LockKeyhole size={12} aria-hidden="true" /> SOMENTE VISUALIZAÇÃO
                </p>
                <p className="text-xl font-extrabold">{previewKind(launch.preview?.kind)}</p>
                {launch.preview ? (
                  <>
                    <p className="flex min-w-0 items-start gap-2 text-xs leading-5 text-white/70">
                      <MapPin size={15} aria-hidden="true" className="mt-0.5 shrink-0" />
                      <span className="min-w-0 break-words">
                        {launch.preview.origin || "Origem a confirmar"} →{" "}
                        {launch.preview.destination || "Destino a confirmar"}
                      </span>
                    </p>
                    {launch.preview.departureTime && (
                      <p className="text-xs text-white/65">
                        Horário de interesse: {launch.preview.departureTime}
                      </p>
                    )}
                  </>
                ) : (
                  <p className="text-xs leading-5 text-white/60">
                    Seu vínculo foi identificado. A prévia será exibida quando houver dados
                    suficientes do trajeto.
                  </p>
                )}
                <p className="text-xs text-white/55">
                  Esta prévia não representa uma corrida publicada nem uma reserva.
                </p>
                <div className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/[.04] px-3 py-2">
                  <div>
                    <p className="text-[11px] uppercase tracking-wide text-white/50">
                      Contagem regressiva
                    </p>
                    <p className="text-lg font-extrabold tabular-nums text-[#ffc451]">
                      {countdown(launch.launchAt, now)}
                    </p>
                  </div>
                  <Clock3 aria-hidden="true" size={22} className="text-[#ffc451]" />
                </div>
              </section>
              ))}
            </div>
          )}
          {!busy && !error && launches.length > 0 && (
            <p className="text-center text-xs leading-5 text-white/60">
              Não aparece alguma pesquisa? Atualize a página para sincronizar as participações.
              Se continuar ausente, entre em contato com o suporte.
            </p>
          )}
          {!state?.locked && launches.length > 0 && (
            <Link
              to="/home"
              className="flex min-h-12 w-full items-center justify-center rounded-xl border border-white/25 px-4 text-sm font-semibold text-white transition hover:bg-white/10"
            >
              Ir ao aplicativo
              <ArrowRight size={17} aria-hidden="true" />
            </Link>
          )}
          <Link
            to="/perfil"
            className="flex min-h-14 w-full items-center justify-center gap-2 rounded-xl bg-[#ffc451] px-4 py-3 text-sm font-extrabold text-[#141414] shadow-lg transition-colors hover:bg-[#ffd886] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#ffc451]"
          >
            <UserRound size={19} aria-hidden="true" />
            Personalizar meu perfil
            <ArrowRight size={17} aria-hidden="true" />
          </Link>
          <p className="text-center text-xs leading-5 text-white/65">
            Sua foto, informações pessoais, veículo e preferências já podem ser configurados.
          </p>
          {error && (
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="inline-flex min-h-10 items-center gap-2 self-start rounded-lg border border-white/30 px-4 text-sm"
            >
              <RefreshCw size={15} /> Tentar novamente
            </button>
          )}
        </div>
        <footer className="flex shrink-0 items-center justify-between gap-3 border-t border-white/10 pt-2 text-[11px] leading-4 text-white/50">
          <p>
            {state?.locked
              ? "O acesso abre na data programada ou quando a organização liberar."
              : "Acompanhar uma campanha não restringe seu acesso atual."}
          </p>
          <button
            type="button"
            className="min-h-9 shrink-0 rounded-lg border border-white/25 px-3 font-semibold text-white/85"
            onClick={async () => {
              await supabase.auth.signOut();
              void navigate({ to: "/auth", replace: true });
            }}
          >
            Sair
          </button>
        </footer>
      </div>
    </main>
  );
}
