import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell } from "@/components/caronaa/AppShell";
import { BrandBadge } from "@/components/caronaa/BrandElements";
import { Button } from "@/components/ui/button";
import {
  Shield,
  ShieldCheck,
  AlertTriangle,
  UsersRound,
  CheckCircle2,
  MapPin,
  ArrowUpRight,
} from "lucide-react";

export const Route = createFileRoute("/seguranca")({
  head: () => ({
    meta: [
      { title: "Segurança e Responsabilidades — CARONAA" },
      {
        name: "description",
        content:
          "Diretrizes de confiança, transparência e responsabilidades comunitárias na CARONAA durante o STS 2026.",
      },
    ],
  }),
  component: SegurancaPage,
});

function SegurancaPage() {
  return (
    <AppShell publicPage>
      <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6 sm:py-16">
        <div className="text-center">
          <BrandBadge variant="community" className="mb-4" />
          <h1 className="font-display text-3xl font-extrabold text-foreground sm:text-5xl">
            Segurança e Responsabilidades
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-base leading-relaxed text-muted-foreground sm:text-lg">
            A CARONAA é construída sobre transparência, respeito mútuo e comunidade. Conheça as
            nossas diretrizes e o funcionamento do MVP.
          </p>
        </div>

        {/* Aviso de Transparência e Limites */}
        <div className="mt-12 rounded-3xl border border-warning/30 bg-warning/5 p-6 sm:p-8">
          <div className="flex items-start gap-3.5">
            <AlertTriangle className="size-6 shrink-0 text-warning" />
            <div>
              <h2 className="font-display text-lg font-bold text-foreground">
                Fase de Validação Experimental
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                A CARONAA é uma iniciativa em estágio inicial de ideação e teste do ecossistema Unifor
                Hub. <strong>Não fazemos afirmações de segurança absoluta</strong> e não atuamos como
                empresa de transporte remunerado privado. A plataforma facilita o encontro entre pessoas
                com rotas compatíveis para compartilhamento comunitário.
              </p>
            </div>
          </div>
        </div>

        {/* Pilares de Boas Práticas */}
        <div className="mt-12 space-y-6">
          <h2 className="font-display text-2xl font-bold">Diretrizes para Motoristas e Passageiros</h2>

          <div className="grid gap-6 sm:grid-cols-2">
            <div className="rounded-2xl border border-border bg-card p-6 shadow-soft">
              <div className="flex size-10 items-center justify-center rounded-xl bg-primary/15 text-primary">
                <UsersRound size={20} />
              </div>
              <h3 className="mt-4 font-bold text-base">Identificação Clara</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                Compartilhe nome, WhatsApp verificado e detalhes claros do ponto de encontro antes
                de embarcar.
              </p>
            </div>

            <div className="rounded-2xl border border-border bg-card p-6 shadow-soft">
              <div className="flex size-10 items-center justify-center rounded-xl bg-primary/15 text-primary">
                <MapPin size={20} />
              </div>
              <h3 className="mt-4 font-bold text-base">Pontos de Encontro Públicos</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                No Siará Tech Summit, priorize as áreas designadas do Centro de Eventos do Ceará e
                locais bem iluminados para o embarque e desembarque.
              </p>
            </div>

            <div className="rounded-2xl border border-border bg-card p-6 shadow-soft">
              <div className="flex size-10 items-center justify-center rounded-xl bg-primary/15 text-primary">
                <CheckCircle2 size={20} />
              </div>
              <h3 className="mt-4 font-bold text-base">Acordo Prévio e Respeito</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                Confirme horário, tempo de tolerância e eventuais divisões justas de combustível
                diretamente antes do início da viagem.
              </p>
            </div>

            <div className="rounded-2xl border border-border bg-card p-6 shadow-soft">
              <div className="flex size-10 items-center justify-center rounded-xl bg-primary/15 text-primary">
                <ShieldCheck size={20} />
              </div>
              <h3 className="mt-4 font-bold text-base">Autonomia de Decisão</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                Tanto o passageiro quanto o motorista têm total liberdade para aceitar ou recusar
                uma combinação caso não se sintam confortáveis.
              </p>
            </div>
          </div>
        </div>

        {/* CTA */}
        <div className="mt-14 rounded-3xl border border-border bg-secondary/50 p-8 text-center sm:p-10">
          <h2 className="font-display text-2xl font-bold">Faça parte da validação no STS 2026</h2>
          <p className="mx-auto mt-2 max-w-lg text-sm text-muted-foreground">
            Sua participação nos ajuda a desenhar processos cada vez mais seguros e eficientes para
            toda a comunidade.
          </p>
          <div className="mt-6 flex justify-center">
            <Button asChild variant="strong" size="lg">
              <Link to="/formulario">
                🚗 Garantir minha CARONAA no Siará <ArrowUpRight size={16} />
              </Link>
            </Button>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
