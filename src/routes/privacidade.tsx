import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell } from "@/components/caronaa/AppShell";
import { BrandBadge } from "@/components/caronaa/BrandElements";
import { Button } from "@/components/ui/button";
import { Lock, ArrowUpRight } from "lucide-react";

export const Route = createFileRoute("/privacidade")({
  head: () => ({
    meta: [
      { title: "Política de Privacidade — CARONAA" },
      {
        name: "description",
        content:
          "Política de privacidade e proteção de dados da CARONAA em conformidade com a LGPD.",
      },
    ],
  }),
  component: PrivacidadePage,
});

function PrivacidadePage() {
  return (
    <AppShell publicPage>
      <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6 sm:py-16">
        <div className="space-y-3">
          <BrandBadge variant="community" />
          <h1 className="font-display text-3xl font-extrabold text-foreground sm:text-4xl">
            Política de Privacidade (LGPD)
          </h1>
          <p className="text-sm text-muted-foreground">
            Última atualização: Outubro de 2026 • CARONAA MVP
          </p>
        </div>

        <div className="mt-8 space-y-8 rounded-3xl border border-border bg-card p-6 text-sm leading-relaxed text-foreground shadow-soft sm:p-10">
          <section className="space-y-3">
            <h2 className="font-display text-lg font-bold text-foreground">
              1. Quais dados coletamos
            </h2>
            <p className="text-muted-foreground">
              Durante o formulário de validação no Siará Tech Summit e no uso da plataforma, coletamos
              apenas os dados estritamente necessários para viabilizar as simulações de rotas e contato:
            </p>
            <ul className="list-disc pl-5 space-y-1.5 text-muted-foreground">
              <li>Nome ou apelido informado;</li>
              <li>Número de WhatsApp e/ou endereço de e-mail;</li>
              <li>Bairros e referências de origem e destino (sem exigência de endereços residenciais exatos);</li>
              <li>Janela de horário e preferências de transporte;</li>
              <li>Informações anônimas de navegação e atribuição de campanha do evento.</li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="font-display text-lg font-bold text-foreground">
              2. Finalidade do uso dos dados
            </h2>
            <p className="text-muted-foreground">
              Os dados são utilizados exclusivamente para:
            </p>
            <ul className="list-disc pl-5 space-y-1.5 text-muted-foreground">
              <li>Testar a viabilidade algorítmica de combinações de trajetos em Fortaleza;</li>
              <li>Entrar em contato via WhatsApp durante o evento para informar caso seja identificada uma conexão compatível;</li>
              <li>Pesquisa estatística agregada e aprimoramento da solução na pré-aceleração do Unifor Hub.</li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="font-display text-lg font-bold text-foreground">
              3. Compartilhamento e Sigilo
            </h2>
            <p className="text-muted-foreground">
              Não vendemos nem comercializamos dados com terceiros. As informações de contato só são
              apresentadas entre motoristas e passageiros após aprovação mútua de interesse para a realização
              do trajeto compartilhado.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="font-display text-lg font-bold text-foreground">
              4. Seus Direitos e Exclusão
            </h2>
            <p className="text-muted-foreground">
              De acordo com a Lei Geral de Proteção de Dados (LGPD - Lei nº 13.709/2018), você pode
              solicitar a confirmação, correção ou exclusão imediata dos seus dados a qualquer momento
              enviando mensagem para{" "}
              <a href="mailto:contato@caronaa.com.br" className="font-semibold text-primary underline">
                contato@caronaa.com.br
              </a>
              .
            </p>
          </section>
        </div>

        <div className="mt-8 flex justify-center">
          <Button asChild variant="strong" size="lg">
            <Link to="/formulario">
              Concordar e Participar da Validação <ArrowUpRight size={16} />
            </Link>
          </Button>
        </div>
      </div>
    </AppShell>
  );
}
