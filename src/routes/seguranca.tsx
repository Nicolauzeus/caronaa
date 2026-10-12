import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell } from "@/components/caronaa/AppShell";
import { BrandBadge } from "@/components/caronaa/BrandElements";
import { Button } from "@/components/ui/button";
import { ChangePasswordForm } from "@/components/caronaa/ChangePasswordForm";
import { useAuth } from "@/lib/auth-context";
import {
  ShieldCheck,
  ShieldAlert,
  AlertTriangle,
  UserCheck,
  MapPin,
  Clock,
  Lock,
  PhoneCall,
  CheckCircle2,
  Car,
  Scale,
  ArrowRight,
  ExternalLink,
  Info,
  Sparkles,
} from "lucide-react";

export const Route = createFileRoute("/seguranca")({
  head: () => ({
    meta: [
      { property: "og:title", content: "Segurança começa antes da carona — CARONAA" },
      {
        property: "og:description",
        content:
          "Diretrizes e mecanismos da CARONAA para tomada de decisões conscientes e seguras no compartilhamento de trajetos.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { title: "Segurança começa antes da carona — CARONAA" },
      {
        name: "description",
        content:
          "Diretrizes e mecanismos da CARONAA para tomada de decisões conscientes e seguras no compartilhamento de trajetos.",
      },
    ],
  }),
  component: SegurancaPage,
});

function SegurancaPage() {
  const { user } = useAuth();

  return (
    <AppShell publicPage={!user}>
      <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 sm:py-14 space-y-8">
        {/* Bloco de Alterar Senha para Usuário Autenticado */}
        {user && <ChangePasswordForm id="alterar-senha" />}

        {/* Cabeçalho */}
        <div className="space-y-4 text-center sm:text-left">
          <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
            <BrandBadge variant="community" />
          </div>

          <h1 className="font-display text-3xl font-extrabold tracking-tight text-foreground sm:text-5xl">
            Segurança começa antes da carona.
          </h1>

          <p className="mx-auto sm:mx-0 max-w-2xl text-base leading-relaxed text-muted-foreground sm:text-lg">
            A CARONAA está criando mecanismos para ajudar pessoas a tomar decisões mais conscientes
            antes de compartilhar um trajeto. Compartilhar caminhos é um ato de confiança que exige
            cuidado mútuo, clareza e bom senso.
          </p>
        </div>

        {/* Bloco de Clareza e Limites de Atuação */}
        <div className="mt-8 rounded-3xl border border-primary/20 bg-primary/5 p-6 sm:p-8 space-y-4">
          <div className="flex items-start gap-3.5">
            <Info className="size-6 shrink-0 text-caronaa-primary mt-0.5" />
            <div className="space-y-2">
              <h2 className="font-display text-lg font-bold text-foreground">
                O papel e os limites da plataforma CARONAA
              </h2>
              <p className="text-sm leading-relaxed text-muted-foreground">
                Para que a experiência seja transparente e segura para todos, é fundamental
                compreender a natureza da nossa atuação:
              </p>
              <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs sm:text-sm text-foreground pt-1">
                <li className="flex items-start gap-2 rounded-xl bg-card/60 p-2.5 border border-border/50">
                  <CheckCircle2 size={16} className="text-caronaa-primary shrink-0 mt-0.5" />
                  <span>
                    A CARONAA é uma <strong>plataforma tecnológica de conexão</strong> entre pessoas
                    com trajetos convergentes.
                  </span>
                </li>
                <li className="flex items-start gap-2 rounded-xl bg-card/60 p-2.5 border border-border/50">
                  <CheckCircle2 size={16} className="text-caronaa-primary shrink-0 mt-0.5" />
                  <span>
                    <strong>Não é transportadora</strong> e não opera frotas de transporte público
                    ou particular.
                  </span>
                </li>
                <li className="flex items-start gap-2 rounded-xl bg-card/60 p-2.5 border border-border/50">
                  <CheckCircle2 size={16} className="text-caronaa-primary shrink-0 mt-0.5" />
                  <span>
                    <strong>Não fornece motoristas</strong> nem contrata condutores de veículos.
                  </span>
                </li>
                <li className="flex items-start gap-2 rounded-xl bg-card/60 p-2.5 border border-border/50">
                  <CheckCircle2 size={16} className="text-caronaa-primary shrink-0 mt-0.5" />
                  <span>
                    <strong>Não garante que um usuário será confiável</strong> em todas as
                    circunstâncias.
                  </span>
                </li>
                <li className="flex items-start gap-2 rounded-xl bg-card/60 p-2.5 border border-border/50">
                  <CheckCircle2 size={16} className="text-caronaa-primary shrink-0 mt-0.5" />
                  <span>
                    <strong>Não garante que uma viagem ocorrerá</strong> (o matching depende de
                    mútua concordância).
                  </span>
                </li>
                <li className="flex items-start gap-2 rounded-xl bg-card/60 p-2.5 border border-border/50">
                  <CheckCircle2 size={16} className="text-caronaa-primary shrink-0 mt-0.5" />
                  <span>
                    <strong>Não substitui cuidados pessoais</strong>, legislação de trânsito ou bom
                    senso individual.
                  </span>
                </li>
              </ul>
              <p className="text-xs text-muted-foreground pt-1">
                A CARONAA disponibiliza ferramentas de apoio e verificação, mas{" "}
                <strong>não promete segurança absoluta</strong>. A prudência e a decisão final de
                ingressar em qualquer viagem cabem a cada participante.
              </p>
            </div>
          </div>
        </div>

        {/* 7 Seções Práticas de Segurança */}
        <div className="mt-12 space-y-6">
          <div className="border-b border-border pb-3">
            <h2 className="font-display text-2xl font-bold text-foreground">
              Como cuidar da sua segurança em cada etapa
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
              Siga estas boas práticas antes, durante e depois de qualquer deslocamento
              compartilhado.
            </p>
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            {/* 1. Conheça antes de combinar */}
            <div className="rounded-2xl border border-border bg-card p-6 shadow-soft space-y-2.5">
              <div className="flex size-11 items-center justify-center rounded-xl bg-caronaa-primary/15 text-caronaa-primary">
                <UserCheck size={22} />
              </div>
              <h3 className="font-display font-bold text-base text-foreground">
                1. Conheça antes de combinar
              </h3>
              <p className="text-sm leading-relaxed text-muted-foreground">
                Antes de fechar qualquer trajeto, troque mensagens pelos canais indicados na
                plataforma. Alinhe expectativas, pergunte sobre o percurso e converse brevemente
                para ter clareza sobre com quem você compartilhará o carro.
              </p>
            </div>

            {/* 2. Confira o perfil */}
            <div className="rounded-2xl border border-border bg-card p-6 shadow-soft space-y-2.5">
              <div className="flex size-11 items-center justify-center rounded-xl bg-caronaa-primary/15 text-caronaa-primary">
                <ShieldCheck size={22} />
              </div>
              <h3 className="font-display font-bold text-base text-foreground">
                2. Confira o perfil
              </h3>
              <p className="text-sm leading-relaxed text-muted-foreground">
                Examine as informações disponíveis no aplicativo: nome, validação de canais de
                contato, modelo do veículo (se motorista), preferências declaradas e avaliações de
                outros usuários. Quanto mais informações alinhadas, mais tranquila será a viagem.
              </p>
            </div>

            {/* 3. Confirme origem, destino e horário */}
            <div className="rounded-2xl border border-border bg-card p-6 shadow-soft space-y-2.5">
              <div className="flex size-11 items-center justify-center rounded-xl bg-caronaa-primary/15 text-caronaa-primary">
                <Clock size={22} />
              </div>
              <h3 className="font-display font-bold text-base text-foreground">
                3. Confirme origem, destino e horário
              </h3>
              <p className="text-sm leading-relaxed text-muted-foreground">
                Defina com exatidão onde o encontro acontecerá, onde será o desembarque e qual é o
                tempo máximo de tolerância para atrasos. Evite alterações bruscas de trajeto no meio
                do caminho sem que ambas as partes concordem antecipadamente.
              </p>
            </div>

            {/* 4. Não compartilhe informações desnecessárias */}
            <div className="rounded-2xl border border-border bg-card p-6 shadow-soft space-y-2.5">
              <div className="flex size-11 items-center justify-center rounded-xl bg-caronaa-primary/15 text-caronaa-primary">
                <Lock size={22} />
              </div>
              <h3 className="font-display font-bold text-base text-foreground">
                4. Não compartilhe informações desnecessárias
              </h3>
              <p className="text-sm leading-relaxed text-muted-foreground">
                Para combinar uma carona, são necessários apenas o ponto de encontro e o horário.
                Nunca divulgue dados bancários confidenciais, senhas, número de documentos sensíveis
                ou detalhes desnecessários da sua rotina pessoal ou domiciliar.
              </p>
            </div>

            {/* 5. Combine em local adequado */}
            <div className="rounded-2xl border border-border bg-card p-6 shadow-soft space-y-2.5">
              <div className="flex size-11 items-center justify-center rounded-xl bg-caronaa-primary/15 text-caronaa-primary">
                <MapPin size={22} />
              </div>
              <h3 className="font-display font-bold text-base text-foreground">
                5. Combine em local adequado
              </h3>
              <p className="text-sm leading-relaxed text-muted-foreground">
                Marque embarques e desembarques sempre em pontos públicos, movimentados e bem
                iluminados (como entradas principais de eventos, postos conhecidos, shoppings ou
                estações de transporte).
              </p>
            </div>

            {/* 6. Se algo parecer errado, não continue */}
            <div className="rounded-2xl border border-border bg-card p-6 shadow-soft space-y-2.5">
              <div className="flex size-11 items-center justify-center rounded-xl bg-destructive/10 text-destructive">
                <ShieldAlert size={22} />
              </div>
              <h3 className="font-display font-bold text-base text-foreground">
                6. Se algo parecer errado, não continue
              </h3>
              <p className="text-sm leading-relaxed text-muted-foreground">
                Você tem autonomia absoluta para desistir ou recusar o embarque a qualquer momento
                se notar comportamento suspeito, divergência nos dados do condutor/veículo ou
                simplesmente não se sentir confortável. Respeite sua intuição e comunique
                cancelamento na plataforma.
              </p>
            </div>
          </div>

          {/* 7. Respeite as regras de trânsito (Largura total) */}
          <div className="rounded-2xl border border-border bg-card p-6 shadow-soft space-y-2.5">
            <div className="flex items-center gap-3">
              <div className="flex size-11 items-center justify-center rounded-xl bg-caronaa-primary/15 text-caronaa-primary shrink-0">
                <Car size={22} />
              </div>
              <h3 className="font-display font-bold text-base text-foreground">
                7. Respeite as regras de trânsito
              </h3>
            </div>
            <p className="text-sm leading-relaxed text-muted-foreground">
              A segurança viária é responsabilidade direta de quem conduz e deve ser exigida por
              quem pega carona:
            </p>
            <ul className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs text-muted-foreground pt-1">
              <li className="rounded-xl bg-muted/40 p-3">
                <strong className="text-foreground block">Cinto de segurança:</strong> Uso
                obrigatório e individual por todos os passageiros nos bancos dianteiros e traseiros.
              </li>
              <li className="rounded-xl bg-muted/40 p-3">
                <strong className="text-foreground block">Tolerância zero ao álcool:</strong> Nunca
                dirija ou embarque com alguém que ingeriu bebidas alcoólicas ou substâncias
                entorpecentes.
              </li>
              <li className="rounded-xl bg-muted/40 p-3">
                <strong className="text-foreground block">Atenção e velocidade:</strong> Não
                manuseie o celular enquanto dirige e respeite os limites de velocidade das vias
                urbanas e rodovias.
              </li>
            </ul>
          </div>
        </div>

        {/* Bloco Obrigatório de Situação de Risco ou Emergência */}
        <div className="mt-12 rounded-3xl border border-destructive/30 bg-destructive/5 p-6 sm:p-8">
          <div className="flex items-start gap-4">
            <div className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-destructive/15 text-destructive">
              <PhoneCall size={26} />
            </div>
            <div className="space-y-3">
              <h2 className="font-display text-lg font-bold text-destructive">
                Situações de Risco ou Emergência
              </h2>
              <p className="text-sm font-semibold text-foreground leading-relaxed">
                &ldquo;Em caso de situação de risco ou emergência, procure imediatamente os serviços
                públicos de emergência apropriados.&rdquo;
              </p>
              <p className="text-xs text-muted-foreground leading-relaxed">
                A CARONAA não é um canal de socorro policial ou médico. Diante de qualquer ameaça
                iminente à sua integridade ou de terceiros, acione diretamente as autoridades
                competentes:
              </p>
              <div className="flex flex-wrap gap-2 pt-1 text-xs font-bold">
                <span className="inline-flex items-center gap-1.5 rounded-lg border border-destructive/20 bg-card px-3 py-1.5 text-foreground">
                  <PhoneCall size={14} className="text-destructive" /> Polícia Militar: 190
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-lg border border-destructive/20 bg-card px-3 py-1.5 text-foreground">
                  <PhoneCall size={14} className="text-destructive" /> SAMU: 192
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-lg border border-destructive/20 bg-card px-3 py-1.5 text-foreground">
                  <PhoneCall size={14} className="text-destructive" /> Corpo de Bombeiros: 193
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Links Obrigatórios: Termos, Privacidade, Entrar na CARONAA, Participar da Validação */}
        <div className="mt-12 rounded-3xl border border-border bg-card p-6 sm:p-8 shadow-soft space-y-6">
          <div className="text-center sm:text-left space-y-1">
            <h2 className="font-display text-xl font-bold text-foreground">
              Acesso rápido e documentação completa
            </h2>
            <p className="text-xs sm:text-sm text-muted-foreground">
              Conheça os termos legais da plataforma ou dê o próximo passo na sua jornada com a
              CARONAA.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            {/* Termos de Uso */}
            <Link
              to="/termos"
              className="flex items-center justify-between rounded-2xl border border-border bg-muted/20 p-4 hover:bg-muted/50 hover:border-caronaa-primary/40 transition group"
            >
              <div>
                <p className="font-bold text-sm text-foreground group-hover:text-caronaa-primary-strong transition">
                  Termos de Uso
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Regras gerais, direitos, deveres e limites da intermediação.
                </p>
              </div>
              <ArrowRight
                size={18}
                className="text-muted-foreground group-hover:text-caronaa-primary group-hover:translate-x-1 transition shrink-0 ml-2"
              />
            </Link>

            {/* Política de Privacidade */}
            <Link
              to="/privacidade"
              className="flex items-center justify-between rounded-2xl border border-border bg-muted/20 p-4 hover:bg-muted/50 hover:border-caronaa-primary/40 transition group"
            >
              <div>
                <p className="font-bold text-sm text-foreground group-hover:text-caronaa-primary-strong transition">
                  Política de Privacidade
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Tratamento de dados, conformidade com a LGPD e seus direitos.
                </p>
              </div>
              <ArrowRight
                size={18}
                className="text-muted-foreground group-hover:text-caronaa-primary group-hover:translate-x-1 transition shrink-0 ml-2"
              />
            </Link>

            {/* Entrar na CARONAA */}
            <Link
              to="/auth"
              className="flex items-center justify-between rounded-2xl border border-border bg-muted/20 p-4 hover:bg-muted/50 hover:border-caronaa-primary/40 transition group"
            >
              <div>
                <p className="font-bold text-sm text-foreground group-hover:text-caronaa-primary-strong transition">
                  Entrar na CARONAA
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Acesse sua conta ou cadastre-se para compartilhar caminhos.
                </p>
              </div>
              <ArrowRight
                size={18}
                className="text-muted-foreground group-hover:text-caronaa-primary group-hover:translate-x-1 transition shrink-0 ml-2"
              />
            </Link>

            {/* Participar da validação */}
            <Link
              to="/auth"
              search={{ mode: "cadastro" }}
              className="flex items-center justify-between rounded-2xl border border-caronaa-primary/30 bg-caronaa-primary/10 p-4 hover:bg-caronaa-primary/20 transition group"
            >
              <div>
                <p className="font-bold text-sm text-caronaa-dark dark:text-caronaa-primary font-extrabold">
                  Participar da validação
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Crie sua conta para compartilhar caminhos na CARONAA.
                </p>
              </div>
              <ArrowRight
                size={18}
                className="text-caronaa-dark dark:text-caronaa-primary group-hover:translate-x-1 transition shrink-0 ml-2"
              />
            </Link>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
