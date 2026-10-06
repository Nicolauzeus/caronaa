import React from "react";
import { Link } from "@tanstack/react-router";
import {
  CheckCircle2,
  MapPin,
  Calendar,
  Clock,
  Car,
  Users,
  ArrowRight,
  ShieldCheck,
  RefreshCw,
  UserCheck,
} from "lucide-react";
import type { CaronaaStsFormData } from "@/lib/formulario/types";
import { StsBadge } from "@/components/caronaa/BrandElements";
import { useAuth } from "@/lib/auth-context";
import { trackFunnelEvent } from "@/lib/funnel-events";
import { saveFormConversionDraft } from "@/lib/formulario/conversion";

const moneyFormatter = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

type FormSuccessProps = {
  data: CaronaaStsFormData;
  onRestart?: () => void;
};

function getIntentBadge(intent: CaronaaStsFormData["intent"]) {
  switch (intent) {
    case "MOTORISTA":
      return "🚗 Motorista cadastrado • STS 2026";
    case "PASSAGEIRO":
      return "🙋 Passageiro cadastrado • STS 2026";
    case "AMBOS":
      return "🔄 Motorista & Passageiro • STS 2026";
    default:
      return "Participante CARONAA • STS 2026";
  }
}

function getIntentTitle(intent: CaronaaStsFormData["intent"]) {
  switch (intent) {
    case "MOTORISTA":
      return "🚗 Oferta de carona registrada!";
    case "PASSAGEIRO":
      return "🙋 Interesse em carona registrado!";
    case "AMBOS":
      return "🔄 Disponibilidade registrada!";
    default:
      return "🚗 Cadastro concluído!";
  }
}

function getIntentSubtitle(intent: CaronaaStsFormData["intent"]) {
  switch (intent) {
    case "MOTORISTA":
      return "Recebemos sua oferta de carona! Mapearemos passageiros cujo trajeto e horário coincidam com os seus para que você possa avaliar as solicitações.";
    case "PASSAGEIRO":
      return "Recebemos sua solicitação de carona! Mapearemos motoristas credenciados que estejam fazendo o mesmo percurso para apresentar opções compatíveis.";
    case "AMBOS":
      return "Recebemos seu interesse duplo! Analisaremos tanto oportunidades para você pegar carona quanto passageiros interessados no seu trajeto, dando a você máxima flexibilidade.";
    default:
      return "Recebemos seu trajeto! Analisaremos participantes com caminhos e horários compatíveis no Siará Tech Summit.";
  }
}

function getIntentDisclaimer(intent: CaronaaStsFormData["intent"]) {
  switch (intent) {
    case "MOTORISTA":
      return "Seu cadastro como motorista foi registrado com sucesso. Vale lembrar: não prometemos carona confirmada ou garantida. Quando identificarmos passageiros com percurso e horário compatíveis, entraremos em contato para que você analise o perfil e aprove a carona antes de qualquer confirmação.";
    case "PASSAGEIRO":
      return "Seu pedido de carona foi registrado com sucesso. Vale lembrar: não prometemos carona encontrada, confirmada ou garantida. Havendo motoristas disponíveis na mesma rota e horário, notificaremos você para que ambos combinem e concordem com os detalhes da viagem.";
    case "AMBOS":
      return "Seu cadastro flexível foi registrado com sucesso. A realização de qualquer carona depende da existência de trajetos compatíveis com outros participantes e de confirmação mútua antecipada. Nenhuma viagem é agendada automaticamente.";
    default:
      return "Seu cadastro foi registrado com sucesso. A realização de qualquer carona depende de haver participantes compatíveis no mesmo horário e rota, com confirmação mútua prévia.";
  }
}

function getIntentLabel(intent: CaronaaStsFormData["intent"]) {
  switch (intent) {
    case "MOTORISTA":
      return "Motorista (Oferecer lugares)";
    case "PASSAGEIRO":
      return "Passageiro (Pegar carona)";
    case "AMBOS":
      return "Ambos (Oferecer ou pegar carona)";
    default:
      return "Participante CARONAA";
  }
}

function getDepartureLabel(departureWindow: CaronaaStsFormData["departureWindow"]) {
  switch (departureWindow) {
    case "ANTES_18":
      return "Antes das 18h";
    case "18_19":
      return "18h – 19h";
    case "19_20":
      return "19h – 20h";
    case "20_21":
      return "20h – 21h";
    case "21_22":
      return "21h – 22h";
    case "APOS_22":
      return "Depois das 22h";
    default:
      return "Horário flexível";
  }
}

export function FormSuccess({ data, onRestart }: FormSuccessProps) {
  const { user } = useAuth();

  React.useEffect(() => {
    // Save draft for pre-filling /auth
    saveFormConversionDraft(data);

    void trackFunnelEvent({
      eventName: "form_success",
      userId: user?.id ?? null,
      submissionId: data.submissionId ?? null,
      source: data.source || "sts2026",
      campaign: data.campaign ?? null,
      campaignEvent: data.campaignEvent || "Siará Tech Summit 2026",
      metadata: {
        intent: data.intent ?? null,
        authenticated: Boolean(user),
      },
    });

    if (user) {
      void trackFunnelEvent({
        eventName: "form_to_account_conversion",
        userId: user.id,
        submissionId: data.submissionId ?? null,
        source: data.source || "sts2026",
        campaign: data.campaign ?? null,
        campaignEvent: data.campaignEvent || "Siará Tech Summit 2026",
        metadata: {
          conversionType: "already_authenticated",
          intent: data.intent ?? null,
        },
      });
    }
  }, [data, user]);

  const handleCtaClick = (action: "continue_to_app" | "signup" | "login") => {
    void trackFunnelEvent({
      eventName: "account_cta_clicked",
      userId: user?.id ?? null,
      submissionId: data.submissionId ?? null,
      source: data.source || "sts2026",
      campaign: data.campaign ?? null,
      campaignEvent: data.campaignEvent || "Siará Tech Summit 2026",
      metadata: {
        action,
        intent: data.intent ?? null,
      },
    });
  };

  return (
    <section className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 py-8 sm:px-6 sm:py-12">
      {/* Header institucional com Hierarquia de Marcas */}
      <div className="flex flex-wrap items-center justify-center gap-2 rounded-2xl border border-border/80 bg-secondary/50 px-4 py-2 text-xs text-muted-foreground shadow-2xs backdrop-blur-xs">
        <span className="font-extrabold text-foreground">CARONAA</span>
        <span className="text-border">•</span>
        <span className="font-medium text-foreground/80">Startup do Unifor Hub</span>
        <span className="text-border">•</span>
        <span className="inline-flex items-center gap-1 font-semibold text-cyan-600 dark:text-cyan-400">
          <span className="size-1.5 rounded-full bg-cyan-400" />
          Expositora no Siará Tech Summit 2026
        </span>
      </div>

      {/* Header status específico por perfil */}
      <div className="flex flex-col items-center text-center">
        <div
          className="flex h-20 w-20 items-center justify-center rounded-3xl bg-caronaa-primary/20 text-caronaa-primary ring-8 ring-caronaa-primary/10 shadow-lg"
          aria-hidden="true"
        >
          <CheckCircle2 size={44} className="text-emerald-500" />
        </div>

        <div className="mt-6 space-y-2">
          <div className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-50 dark:bg-emerald-950/40 px-3.5 py-1 text-xs font-semibold text-emerald-700 dark:text-emerald-300">
            <span className="size-2 rounded-full bg-emerald-500 animate-pulse" />
            {getIntentBadge(data.intent)}
          </div>

          <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">
            {getIntentTitle(data.intent)}
          </h1>

          <p className="mx-auto max-w-lg text-base text-muted-foreground">
            {getIntentSubtitle(data.intent)}
          </p>
        </div>
      </div>

      {/* Trajectory Summary Card */}
      <div className="rounded-3xl border border-border bg-card p-6 shadow-md space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-4">
          <div>
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Resumo da sua participação
            </span>
            <p className="text-base font-bold text-foreground mt-0.5">
              {getIntentLabel(data.intent)}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <StsBadge />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
          <div className="flex items-start gap-3 rounded-2xl bg-muted/40 p-3.5">
            <MapPin size={20} className="text-caronaa-primary shrink-0 mt-0.5" />
            <div>
              <div className="text-xs text-muted-foreground">Origem do evento</div>
              <div className="font-semibold text-foreground">
                {data.originNeighborhood || "Centro de Eventos do Ceará"}
              </div>
            </div>
          </div>

          <div className="flex items-start gap-3 rounded-2xl bg-muted/40 p-3.5">
            <MapPin size={20} className="text-event-magenta shrink-0 mt-0.5" />
            <div>
              <div className="text-xs text-muted-foreground">Destino pretendido</div>
              <div className="font-semibold text-foreground">
                {data.destinationNeighborhood || "Fortaleza / Região Metropolitana"}
              </div>
            </div>
          </div>

          <div className="flex items-start gap-3 rounded-2xl bg-muted/40 p-3.5">
            <Clock size={20} className="text-event-cyan shrink-0 mt-0.5" />
            <div>
              <div className="text-xs text-muted-foreground">Janela de saída</div>
              <div className="font-semibold text-foreground">
                {getDepartureLabel(data.departureWindow)}
              </div>
            </div>
          </div>

          <div className="flex items-start gap-3 rounded-2xl bg-muted/40 p-3.5">
            <Calendar size={20} className="text-primary shrink-0 mt-0.5" />
            <div>
              <div className="text-xs text-muted-foreground">Datas do STS</div>
              <div className="font-semibold text-foreground">07 a 09 de outubro de 2026</div>
            </div>
          </div>

          {data.driverPrice !== undefined && (
            <div className="flex items-start gap-3 rounded-2xl bg-muted/40 p-3.5">
              <Car size={20} className="text-caronaa-primary shrink-0 mt-0.5" />
              <div>
                <div className="text-xs text-muted-foreground">Compensação por passageiro</div>
                <div className="font-semibold text-foreground">
                  {moneyFormatter.format(data.driverPrice)}
                </div>
              </div>
            </div>
          )}

          {data.passengerFairPrice !== undefined && (
            <div className="flex items-start gap-3 rounded-2xl bg-muted/40 p-3.5">
              <Car size={20} className="text-caronaa-primary shrink-0 mt-0.5" />
              <div>
                <div className="text-xs text-muted-foreground">Valor sugerido de referência</div>
                <div className="font-semibold text-foreground">
                  {moneyFormatter.format(data.passengerFairPrice)}
                </div>
              </div>
            </div>
          )}

          {data.passengerCount !== undefined && (
            <div className="flex items-start gap-3 rounded-2xl bg-muted/40 p-3.5">
              <Users size={20} className="text-primary shrink-0 mt-0.5" />
              <div>
                <div className="text-xs text-muted-foreground">Passageiros no grupo</div>
                <div className="font-semibold text-foreground">{data.passengerCount} pessoa(s)</div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Honest MVP Disclaimer Notice por perfil */}
      <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4 sm:p-5">
        <div className="flex items-start gap-3">
          <ShieldCheck size={22} className="text-caronaa-primary shrink-0 mt-0.5" />
          <div className="space-y-1.5">
            <p className="text-sm font-bold text-foreground">Como funciona o próximo passo?</p>
            <p className="text-xs leading-relaxed text-muted-foreground sm:text-sm">
              {getIntentDisclaimer(data.intent)}
            </p>
          </div>
        </div>
      </div>

      {/* Auth Account Association / Conversion Actions */}
      {user ? (
        <div className="space-y-4 pt-2">
          <div className="flex items-center gap-3.5 rounded-2xl border border-emerald-500/20 bg-emerald-50/50 p-4 dark:bg-emerald-950/20">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <UserCheck size={22} />
            </div>
            <div>
              <p className="text-sm font-bold text-foreground">
                Seu cadastro foi associado à sua conta CARONAA.
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Você já está autenticado e seu trajeto foi vinculado ao seu perfil.
              </p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <Link
              to="/home"
              onClick={() => handleCtaClick("continue_to_app")}
              className="inline-flex min-h-12 flex-1 items-center justify-center gap-2 rounded-xl bg-caronaa-primary px-6 py-3 text-sm font-bold text-caronaa-dark shadow-md hover:bg-caronaa-primary-strong transition"
            >
              Continuar no aplicativo
              <ArrowRight size={16} />
            </Link>

            <Link
              to="/"
              className="inline-flex min-h-12 items-center justify-center rounded-xl border border-border bg-card px-6 py-3 text-sm font-semibold hover:bg-accent transition sm:flex-none"
            >
              Voltar ao início
            </Link>
          </div>
        </div>
      ) : (
        <div className="space-y-3 pt-2">
          <div className="flex flex-col sm:flex-row gap-3">
            <Link
              to="/auth"
              search={{
                mode: "cadastro",
                submissionId: data.submissionId ?? undefined,
              }}
              onClick={() => handleCtaClick("signup")}
              className="inline-flex min-h-12 flex-1 items-center justify-center gap-2 rounded-xl bg-caronaa-primary px-6 py-3 text-sm font-bold text-caronaa-dark shadow-md hover:bg-caronaa-primary-strong transition"
            >
              Quero criar minha conta
              <ArrowRight size={16} />
            </Link>

            <Link
              to="/auth"
              search={{
                mode: "entrar",
                submissionId: data.submissionId ?? undefined,
              }}
              onClick={() => handleCtaClick("login")}
              className="inline-flex min-h-12 flex-1 items-center justify-center rounded-xl border border-border bg-card px-6 py-3 text-sm font-semibold hover:bg-accent transition"
            >
              Já tenho uma conta
            </Link>
          </div>

          <div className="flex justify-center">
            <Link
              to="/"
              className="text-xs font-medium text-muted-foreground hover:text-foreground transition underline underline-offset-4 py-1"
            >
              Voltar ao início
            </Link>
          </div>
        </div>
      )}

      {onRestart && (
        <div className="text-center pt-2">
          <button
            type="button"
            onClick={onRestart}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition underline underline-offset-4"
          >
            <RefreshCw size={13} />
            Preencher outro trajeto ou simulação
          </button>
        </div>
      )}
    </section>
  );
}
