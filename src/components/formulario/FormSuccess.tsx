import React from "react";
import { Link } from "@tanstack/react-router";
import { CheckCircle2, MapPin, Calendar, Clock, Car, Users, ArrowRight, ShieldCheck, RefreshCw } from "lucide-react";
import type { CaronaaStsFormData } from "@/lib/formulario/types";
import { getLeadClassification } from "@/lib/formulario/classification";
import { StsBadge } from "@/components/caronaa/BrandElements";

const moneyFormatter = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

type FormSuccessProps = {
  data: CaronaaStsFormData;
  onRestart?: () => void;
};

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
  const classification = getLeadClassification(data);

  return (
    <section className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 py-8 sm:px-6 sm:py-12">
      {/* Header status */}
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
            Perfil 100% preparado • STS 2026
          </div>

          <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">
            🚗 Sua CARONAA começou!
          </h1>

          <p className="mx-auto max-w-lg text-base text-muted-foreground">
            Agora vamos analisar seu trajeto e procurar combinações compatíveis com quem também está saindo do Siará Tech Summit.
          </p>
        </div>
      </div>

      {/* Trajectory Summary Card */}
      <div className="rounded-3xl border border-border bg-card p-6 shadow-md space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-4">
          <div>
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Resumo da sua solicitação
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
                <div className="text-xs text-muted-foreground">Contribuição por passageiro</div>
                <div className="font-semibold text-foreground">
                  {moneyFormatter.format(data.driverPrice)}
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

      {/* Honest MVP Disclaimer Notice */}
      <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4 sm:p-5">
        <div className="flex items-start gap-3">
          <ShieldCheck size={22} className="text-caronaa-primary shrink-0 mt-0.5" />
          <div className="space-y-1.5">
            <p className="text-sm font-bold text-foreground">
              Como funciona o próximo passo?
            </p>
            <p className="text-xs leading-relaxed text-muted-foreground sm:text-sm">
              Seu cadastro foi registrado com sucesso! Vale lembrar que a realização de uma carona
              depende de existir uma combinação compatível de horários e rotas, e de ambas as partes
              concordarem com os detalhes. Se encontramos alguém compatível, entraremos em contato
              para apresentar a oportunidade.
            </p>
          </div>
        </div>
      </div>

      {/* Navigation Buttons */}
      <div className="flex flex-col sm:flex-row gap-3 pt-2">
        <Link
          to="/auth"
          className="inline-flex min-h-12 flex-1 items-center justify-center gap-2 rounded-xl bg-caronaa-primary px-6 py-3 text-sm font-bold text-caronaa-dark shadow-md hover:bg-caronaa-primary-strong transition"
        >
          Acessar minha conta / App
          <ArrowRight size={16} />
        </Link>

        <Link
          to="/"
          className="inline-flex min-h-12 flex-1 items-center justify-center rounded-xl border border-border bg-card px-6 py-3 text-sm font-semibold hover:bg-accent transition"
        >
          Voltar para a página inicial
        </Link>
      </div>

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
