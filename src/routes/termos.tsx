import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell } from "@/components/caronaa/AppShell";
import { BrandBadge } from "@/components/caronaa/BrandElements";
import { Button } from "@/components/ui/button";
import { FileText, ArrowUpRight } from "lucide-react";

export const Route = createFileRoute("/termos")({
  head: () => ({
    meta: [
      { title: "Termos de Uso — CARONAA" },
      {
        name: "description",
        content: "Termos de uso do MVP e da validação experimental da CARONAA.",
      },
    ],
  }),
  component: TermosPage,
});

function TermosPage() {
  return (
    <AppShell publicPage>
      <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6 sm:py-16">
        <div className="space-y-3">
          <BrandBadge variant="validation" />
          <h1 className="font-display text-3xl font-extrabold text-foreground sm:text-4xl">
            Termos de Uso do MVP CARONAA
          </h1>
          <p className="text-sm text-muted-foreground">
            Última atualização: Outubro de 2026 • Edição Siará Tech Summit 2026
          </p>
        </div>

        <div className="mt-8 space-y-8 rounded-3xl border border-border bg-card p-6 text-sm leading-relaxed text-foreground shadow-soft sm:p-10">
          <section className="space-y-3">
            <h2 className="font-display text-lg font-bold text-foreground">
              1. Natureza do Serviço e Estágio Experimental
            </h2>
            <p className="text-muted-foreground">
              A plataforma CARONAA é um projeto de base tecnológica em fase de MVP (Produto Mínimo Viável)
              e validação de mercado, participante do Programa de Desenvolvimento de Startups do Unifor
              Hub. A plataforma não presta serviços de transporte público nem atua como empresa de táxi
              ou motorista profissional. Seu propósito exclusivo é intermediar o contato entre pessoas com
              rotas semelhantes para o compartilhamento de viagens particulares.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="font-display text-lg font-bold text-foreground">
              2. Participação no Siará Tech Summit 2026
            </h2>
            <p className="text-muted-foreground">
              Os usuários que realizam cadastros durante o evento Siará Tech Summit 2026 concordam em
              participar de uma dinâmica de validação real. As informações submetidas através do formulário
              específico de evento serão utilizadas pela equipe da startup para testar a viabilidade de
              matching de rotas e coletar impressões de usabilidade.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="font-display text-lg font-bold text-foreground">
              3. Responsabilidade das Partes e Caronas Solidárias
            </h2>
            <p className="text-muted-foreground">
              A decisão de oferecer, solicitar, aceitar ou embarcar em uma carona é de inteira
              responsabilidade dos participantes envolvidos. Os motoristas e passageiros devem agir com boa-fé,
              respeitar as leis de trânsito brasileiras e manter conduta ética. A CARONAA não garante a
              disponibilidade contínua de rotas compatíveis nem assume responsabilidade por atrasos ou
              incidentes no trajeto.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="font-display text-lg font-bold text-foreground">
              4. Divisão de Custos
            </h2>
            <p className="text-muted-foreground">
              As caronas facilitadas pelo MVP possuem caráter de cooperação e divisão proporcional de
              despesas (como combustível ou pedágio), sem qualquer finalidade de lucro comercial por parte
              dos condutores particulares, em conformidade com as legislações pertinentes de carona compartilhada.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="font-display text-lg font-bold text-foreground">
              5. Contato e Dúvidas
            </h2>
            <p className="text-muted-foreground">
              Para dúvidas, sugestões ou suporte durante o evento, envie uma mensagem para a equipe no
              stand do Siará Tech Summit ou via e-mail:{" "}
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
              Participar da Validação no STS 2026 <ArrowUpRight size={16} />
            </Link>
          </Button>
        </div>
      </div>
    </AppShell>
  );
}
