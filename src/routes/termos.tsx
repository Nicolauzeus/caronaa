import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell } from "@/components/caronaa/AppShell";
import { BrandBadge, StsBadge } from "@/components/caronaa/BrandElements";
import { Button } from "@/components/ui/button";
import {
  FileText,
  AlertTriangle,
  Sparkles,
  ShieldCheck,
  Scale,
  CheckCircle2,
  Car,
  Users,
  Lock,
  ArrowRight,
  ExternalLink,
  Info,
} from "lucide-react";

export const Route = createFileRoute("/termos")({
  head: () => ({
    meta: [
      { title: "Termos de Uso — CARONAA" },
      {
        name: "description",
        content:
          "Termos de Uso da CARONAA. Conheça as diretrizes, responsabilidades e limites de atuação da nossa plataforma de caronas colaborativas.",
      },
    ],
  }),
  component: TermosPage,
});

const SECOES = [
  { id: "secao-1", numero: "1", titulo: "Quem somos" },
  { id: "secao-2", numero: "2", titulo: "O que é a CARONAA" },
  { id: "secao-3", numero: "3", titulo: "Plataforma de conexão" },
  { id: "secao-4", numero: "4", titulo: "Como funciona" },
  { id: "secao-5", numero: "5", titulo: "Responsabilidades do usuário" },
  { id: "secao-6", numero: "6", titulo: "Responsabilidades de motoristas" },
  { id: "secao-7", numero: "7", titulo: "Responsabilidades de passageiros" },
  { id: "secao-8", numero: "8", titulo: "Segurança e verificação" },
  { id: "secao-9", numero: "9", titulo: "Combinação e confirmação de caronas" },
  { id: "secao-10", numero: "10", titulo: "Pagamentos e valores" },
  { id: "secao-11", numero: "11", titulo: "Cancelamentos" },
  { id: "secao-12", numero: "12", titulo: "Conteúdo e avaliações" },
  { id: "secao-13", numero: "13", titulo: "Condutas proibidas" },
  { id: "secao-14", numero: "14", titulo: "Acidentes, danos e incidentes" },
  { id: "secao-15", numero: "15", titulo: "Limitações da plataforma" },
  { id: "secao-16", numero: "16", titulo: "Proteção de dados" },
  { id: "secao-17", numero: "17", titulo: "Propriedade intelectual" },
  { id: "secao-18", numero: "18", titulo: "Alterações dos termos" },
  { id: "secao-19", numero: "19", titulo: "Contato" },
];

function TermosPage() {
  return (
    <AppShell publicPage>
      <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 sm:py-14">
        {/* Header da Página */}
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <BrandBadge variant="validation" />
            <StsBadge />
          </div>

          <h1 className="font-display text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl">
            Termos de Uso da CARONAA
          </h1>

          <p className="text-sm text-muted-foreground">
            Versão de referência: <strong className="text-foreground">sts_2026_v1</strong> • Última
            atualização: Outubro de 2026
          </p>
        </div>

        {/* Destaque Obrigatório: Versão Inicial / Validação Real */}
        <div className="mt-6 rounded-2xl border border-caronaa-primary/30 bg-caronaa-primary/10 p-4 sm:p-5">
          <div className="flex items-start gap-3">
            <Sparkles className="size-5 shrink-0 text-caronaa-primary mt-0.5" />
            <div className="space-y-1">
              <p className="text-sm font-bold text-foreground">
                Versão Experimental e Validação de Mercado
              </p>
              <p className="text-sm font-semibold text-foreground/90">
                &ldquo;Você está utilizando uma versão inicial da CARONAA, criada para validar a
                solução em situações reais.&rdquo;
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                A CARONAA está em fase inicial (Produto Mínimo Viável - MVP) e seus recursos, fluxos
                e ferramentas podem evoluir continuamente com base na experiência e no feedback dos
                participantes.
              </p>
            </div>
          </div>
        </div>

        {/* Aviso Legal Obrigatório */}
        <div className="mt-4 rounded-2xl border border-amber-500/30 bg-amber-50/50 dark:bg-amber-950/20 p-4 sm:p-5">
          <div className="flex items-start gap-3">
            <AlertTriangle className="size-5 shrink-0 text-amber-600 dark:text-amber-400 mt-0.5" />
            <div className="space-y-1">
              <p className="text-xs font-bold uppercase tracking-wider text-amber-800 dark:text-amber-300">
                Aviso Importante
              </p>
              <p className="text-xs sm:text-sm text-amber-900/90 dark:text-amber-200/90 leading-relaxed">
                &ldquo;Os Termos de Uso não substituem aconselhamento jurídico. A versão publicada
                deverá ser revisada juridicamente antes do lançamento público definitivo.&rdquo;
              </p>
            </div>
          </div>
        </div>

        {/* Sumário Rápido de Navegação */}
        <nav
          aria-label="Sumário dos termos"
          className="mt-8 rounded-2xl border border-border bg-card p-5 shadow-sm"
        >
          <div className="flex items-center gap-2 pb-3 border-b border-border">
            <FileText size={18} className="text-caronaa-primary" />
            <h2 className="text-sm font-bold text-foreground">Sumário de Seções</h2>
          </div>
          <ol className="mt-3 grid grid-cols-1 gap-2 text-xs sm:grid-cols-2 md:grid-cols-3">
            {SECOES.map((secao) => (
              <li key={secao.id}>
                <a
                  href={`#${secao.id}`}
                  className="flex items-center gap-2 rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition"
                >
                  <span className="font-bold text-caronaa-primary">{secao.numero}.</span>
                  <span className="truncate">{secao.titulo}</span>
                </a>
              </li>
            ))}
          </ol>
        </nav>

        {/* Conteúdo das 19 Seções */}
        <div className="mt-8 space-y-8 rounded-3xl border border-border bg-card p-6 text-sm leading-relaxed text-foreground shadow-soft sm:p-10">
          {/* 1. Quem somos */}
          <section id="secao-1" className="scroll-mt-20 space-y-3">
            <h2 className="font-display text-lg font-bold text-foreground flex items-center gap-2">
              <span className="flex size-7 items-center justify-center rounded-lg bg-caronaa-primary/10 text-xs font-bold text-caronaa-primary">
                1
              </span>
              Quem somos
            </h2>
            <p className="text-muted-foreground">
              A <strong>CARONAA</strong> é uma iniciativa de base tecnológica concebida para
              incentivar a mobilidade compartilhada, sustentável e colaborativa em Fortaleza e na
              Região Metropolitana do Ceará. Nascida no ecossistema de inovação acadêmico e
              empreendedor, a iniciativa integra o Programa de Desenvolvimento de Startups do{" "}
              <strong>Unifor Hub</strong>. Atuamos como desenvolvedores e mantenedores do software,
              interfaces digitais e ferramentas que viabilizam o contato entre pessoas que
              compartilham caminhos semelhantes.
            </p>
          </section>

          {/* 2. O que é a CARONAA */}
          <section id="secao-2" className="scroll-mt-20 space-y-3">
            <h2 className="font-display text-lg font-bold text-foreground flex items-center gap-2">
              <span className="flex size-7 items-center justify-center rounded-lg bg-caronaa-primary/10 text-xs font-bold text-caronaa-primary">
                2
              </span>
              O que é a CARONAA
            </h2>
            <p className="text-muted-foreground">
              A CARONAA é uma aplicação tecnológica que aproxima pessoas interessadas em realizar
              trajetos convergentes no mesmo horário. Seu objetivo primordial é conectar motoristas
              que já realizariam um trajeto habitual a passageiros que buscam o mesmo destino,
              permitindo o aproveitamento de assentos ociosos em veículos particulares, a redução de
              veículos em circulação nas vias públicas, a economia compartilhada de custos de viagem
              e a promoção de conexões humanas na cidade.
            </p>
          </section>

          {/* 3. Plataforma de conexão */}
          <section id="secao-3" className="scroll-mt-20 space-y-3">
            <h2 className="font-display text-lg font-bold text-foreground flex items-center gap-2">
              <span className="flex size-7 items-center justify-center rounded-lg bg-caronaa-primary/10 text-xs font-bold text-caronaa-primary">
                3
              </span>
              Plataforma de conexão (Natureza Jurídica)
            </h2>
            <div className="rounded-xl border border-primary/20 bg-muted/40 p-4 space-y-2 text-foreground">
              <p className="font-semibold text-sm">
                A CARONAA declara e estabelece de forma categórica que:
              </p>
              <ul className="list-disc pl-5 space-y-1.5 text-xs sm:text-sm text-muted-foreground">
                <li>
                  <strong>Não é empresa de transporte</strong>, operadora de transporte público,
                  concessionária, cooperativa de táxis ou serviço de transporte remunerado privativo
                  individual;
                </li>
                <li>
                  <strong>Não realiza diretamente as viagens</strong>, itinerários ou traslados;
                </li>
                <li>
                  <strong>Não fornece motorista</strong>, nem mantém qualquer vínculo de emprego,
                  subordinação ou representação com condutores cadastrados;
                </li>
                <li>
                  <strong>Não fornece veículo</strong>, nem realiza locação, homologação ou
                  manutenção mecânica de frotas automotivas;
                </li>
                <li>
                  <strong>
                    Atua estritamente como plataforma tecnológica de conexão e comunicação
                  </strong>{" "}
                  entre pessoas físicas particulares interessadas em compartilhar trajetos de forma
                  espontânea e voluntária.
                </li>
              </ul>
            </div>
          </section>

          {/* 4. Como funciona */}
          <section id="secao-4" className="scroll-mt-20 space-y-3">
            <h2 className="font-display text-lg font-bold text-foreground flex items-center gap-2">
              <span className="flex size-7 items-center justify-center rounded-lg bg-caronaa-primary/10 text-xs font-bold text-caronaa-primary">
                4
              </span>
              Como funciona
            </h2>
            <p className="text-muted-foreground">
              O fluxo de operação baseia-se na inclusão de informações de itinerário fornecidas
              espontaneamente pelos usuários (bairro ou ponto de origem, bairro ou polo de destino e
              janela de horários pretendida). Nossos sistemas de processamento aplicam filtros de
              compatibilidade para apresentar potenciais combinações (&ldquo;matches&rdquo;) entre
              itinerários. A partir dessa visualização, cabe única e exclusivamente aos usuários
              decidir se desejam estabelecer contato, combinar os detalhes específicos e efetivar a
              carona.
            </p>
          </section>

          {/* 5. Responsabilidades do usuário */}
          <section id="secao-5" className="scroll-mt-20 space-y-3">
            <h2 className="font-display text-lg font-bold text-foreground flex items-center gap-2">
              <span className="flex size-7 items-center justify-center rounded-lg bg-caronaa-primary/10 text-xs font-bold text-caronaa-primary">
                5
              </span>
              Responsabilidades do usuário
            </h2>
            <p className="text-muted-foreground">
              Qualquer pessoa que acesse ou utilize a CARONAA (seja motorista ou passageiro) assume
              os seguintes deveres:
            </p>
            <ul className="list-disc pl-5 space-y-1 text-muted-foreground text-xs sm:text-sm">
              <li>Fornecer dados cadastrais estritamente verdadeiros, exatos e atualizados;</li>
              <li>Manter a segurança e sigilo de seus dados de contato e credenciais;</li>
              <li>
                Tratar todos os participantes com urbanidade, respeito e dignidade, sem tolerância a
                preconceitos de qualquer ordem;
              </li>
              <li>
                <strong>Avaliar criteriosamente todas as informações disponíveis</strong> antes de
                solicitar ou aceitar uma viagem;
              </li>
              <li>
                Cumprir a legislação brasileira vigente, em especial as normas civis e os
                regulamentos de trânsito.
              </li>
            </ul>
          </section>

          {/* 6. Responsabilidades de motoristas */}
          <section id="secao-6" className="scroll-mt-20 space-y-3">
            <h2 className="font-display text-lg font-bold text-foreground flex items-center gap-2">
              <span className="flex size-7 items-center justify-center rounded-lg bg-caronaa-primary/10 text-xs font-bold text-caronaa-primary">
                6
              </span>
              Responsabilidades de motoristas
            </h2>
            <p className="text-muted-foreground">
              Os usuários que se cadastram na condição de motoristas declaram e assumem
              expressamente a responsabilidade por:
            </p>
            <ul className="list-disc pl-5 space-y-1 text-muted-foreground text-xs sm:text-sm">
              <li>
                <strong>
                  Possuir documentação e Carteira Nacional de Habilitação (CNH) válida
                </strong>{" "}
                e compatível com a categoria do veículo utilizado, sem suspensões ou cassações
                administrativas ou judiciais;
              </li>
              <li>
                <strong>Conduzir veículo devidamente regularizado</strong>, licenciado perante os
                órgãos de trânsito competentes e com todos os encargos legais em dia;
              </li>
              <li>
                Garantir que o veículo se encontre em perfeitas condições mecânicas, de conservação,
                limpeza e segurança (incluindo pneus, freios, luzes e estepe);
              </li>
              <li>
                Exigir e assegurar o uso individual do cinto de segurança por todos os ocupantes do
                veículo;
              </li>
              <li>
                Respeitar escrupulosamente os limites de velocidade e as normas do Código de
                Trânsito Brasileiro (CTB), sendo vedada qualquer condução sob influência de álcool
                ou substâncias psicoativas;
              </li>
              <li>
                Não desvirtuar a plataforma para fins de transporte remunerado privativo contínuo
                com objetivo de lucro comercial desvinculado da carona solidária.
              </li>
            </ul>
          </section>

          {/* 7. Responsabilidades de passageiros */}
          <section id="secao-7" className="scroll-mt-20 space-y-3">
            <h2 className="font-display text-lg font-bold text-foreground flex items-center gap-2">
              <span className="flex size-7 items-center justify-center rounded-lg bg-caronaa-primary/10 text-xs font-bold text-caronaa-primary">
                7
              </span>
              Responsabilidades de passageiros
            </h2>
            <p className="text-muted-foreground">
              Os passageiros que solicitam ou embarcam em caronas comprometem-se a agir de forma
              responsável:
            </p>
            <ul className="list-disc pl-5 space-y-1 text-muted-foreground text-xs sm:text-sm">
              <li>Comparecer com pontualidade no local e horário de encontro combinados;</li>
              <li>Utilizar obrigatoriamente o cinto de segurança durante todo o trajeto;</li>
              <li>
                Portar documento oficial com foto para identificação mútua no momento do embarque;
              </li>
              <li>
                Zelar pela conservação e limpeza do veículo, respeitando as regras razoáveis de
                convivência definidas pelo motorista (ex.: restrição a cigarros ou alimentos);
              </li>
              <li>
                Efetuar de boa-fé a contribuição acordada para compensação do custo do trajeto
                compartilhado, quando aplicável.
              </li>
            </ul>
          </section>

          {/* 8. Segurança e verificação */}
          <section id="secao-8" className="scroll-mt-20 space-y-3">
            <h2 className="font-display text-lg font-bold text-foreground flex items-center gap-2">
              <span className="flex size-7 items-center justify-center rounded-lg bg-caronaa-primary/10 text-xs font-bold text-caronaa-primary">
                8
              </span>
              Segurança e verificação
            </h2>
            <p className="text-muted-foreground">
              A CARONAA implementa e aprimora mecanismos de confiança, tais como verificação de
              canais de contato (WhatsApp/e-mail), perfis de usuários, preferências de viagem e
              sistemas de avaliação entre participantes.
            </p>
            <div className="rounded-xl border border-border bg-muted/30 p-3.5 space-y-1.5 text-xs text-muted-foreground">
              <p className="font-bold text-foreground text-xs sm:text-sm">
                Limites dos mecanismos de segurança:
              </p>
              <p>
                <strong>A CARONAA não promete nem garante segurança absoluta.</strong> A plataforma
                disponibiliza recursos de apoio e transparência, mas não pode garantir
                infalivelmente o comportamento de terceiros, a idoneidade moral permanente dos
                usuários ou a ausência de imprevistos externos. Cada usuário deve adotar medidas
                prudenciais de autocuidado e compartilhar detalhes da viagem com amigos ou
                familiares de sua confiança.
              </p>
            </div>
          </section>

          {/* 9. Combinação e confirmação de caronas */}
          <section id="secao-9" className="scroll-mt-20 space-y-3">
            <h2 className="font-display text-lg font-bold text-foreground flex items-center gap-2">
              <span className="flex size-7 items-center justify-center rounded-lg bg-caronaa-primary/10 text-xs font-bold text-caronaa-primary">
                9
              </span>
              Combinação e confirmação de caronas
            </h2>
            <div className="rounded-xl border border-caronaa-primary/20 bg-caronaa-primary/5 p-4 space-y-2">
              <p className="text-sm font-bold text-foreground">
                Regra Fundamental de Consentimento Mútuo:
              </p>
              <p className="text-xs sm:text-sm text-foreground/90">
                <strong>
                  Uma combinação ou compatibilidade exibida pela plataforma não significa que uma
                  viagem esteja automaticamente confirmada.
                </strong>
              </p>
              <p className="text-xs text-muted-foreground">
                Nenhuma viagem deve ou pode acontecer sem que as partes envolvidas concordem
                expressamente entre si com todos os termos do trajeto (horário exato, local de
                encontro, paradas e contribuição). O usuário tem a faculdade e o dever de avaliar as
                informações disponíveis no aplicativo antes de aceitar qualquer solicitação ou
                convite.
              </p>
            </div>
          </section>

          {/* 10. Pagamentos e valores */}
          <section id="secao-10" className="scroll-mt-20 space-y-3">
            <h2 className="font-display text-lg font-bold text-foreground flex items-center gap-2">
              <span className="flex size-7 items-center justify-center rounded-lg bg-caronaa-primary/10 text-xs font-bold text-caronaa-primary">
                10
              </span>
              Pagamentos e valores (Divisão de Custos)
            </h2>
            <p className="text-muted-foreground">
              As caronas intermediadas através da CARONAA pautam-se pela{" "}
              <strong>divisão colaborativa de despesas reais do deslocamento</strong> (como
              combustível, pedágio ou manutenção proporcional), respeitando o conceito de carona
              solidária.
            </p>
            <p className="text-muted-foreground">
              Os valores sugeridos ou definidos têm o intuito exclusivo de compensar o motorista
              pelo lugar compartilhado no percurso que ele já executaria por interesse próprio. A
              CARONAA não estabelece tarifa de transporte público e poderá cobrar taxa de
              intermediação tecnológica transparente para manutenção da plataforma digital.
            </p>
          </section>

          {/* 11. Cancelamentos */}
          <section id="secao-11" className="scroll-mt-20 space-y-3">
            <h2 className="font-display text-lg font-bold text-foreground flex items-center gap-2">
              <span className="flex size-7 items-center justify-center rounded-lg bg-caronaa-primary/10 text-xs font-bold text-caronaa-primary">
                11
              </span>
              Cancelamentos
            </h2>
            <p className="text-muted-foreground">
              Tanto o motorista quanto o passageiro podem cancelar uma carona previamente combinada,
              desde que o façam com a maior antecedência viável, comunicando a outra parte com
              clareza. Cancelamentos recorrentes sem justificativa ou ausências injustificadas no
              ponto de encontro comprometem a confiabilidade da rede e poderão ensejar suspensão
              preventiva do perfil.
            </p>
          </section>

          {/* 12. Conteúdo e avaliações */}
          <section id="secao-12" className="scroll-mt-20 space-y-3">
            <h2 className="font-display text-lg font-bold text-foreground flex items-center gap-2">
              <span className="flex size-7 items-center justify-center rounded-lg bg-caronaa-primary/10 text-xs font-bold text-caronaa-primary">
                12
              </span>
              Conteúdo e avaliações
            </h2>
            <p className="text-muted-foreground">
              Os participantes podem registrar impressões e avaliações sobre as viagens
              compartilhadas. As avaliações devem refletir experiências reais, pautadas na verdade,
              na urbanidade e no respeito. É expressamente proibida a publicação de termos
              difamatórios, injuriosos, caluniosos ou com teor de intimidação. A CARONAA reserva-se
              o direito de remover comentários em desacordo com as diretrizes da comunidade.
            </p>
          </section>

          {/* 13. Condutas proibidas */}
          <section id="secao-13" className="scroll-mt-20 space-y-3">
            <h2 className="font-display text-lg font-bold text-foreground flex items-center gap-2">
              <span className="flex size-7 items-center justify-center rounded-lg bg-caronaa-primary/10 text-xs font-bold text-caronaa-primary">
                13
              </span>
              Condutas proibidas
            </h2>
            <p className="text-muted-foreground">
              São condutas terminantemente vedadas a qualquer participante da CARONAA:
            </p>
            <ul className="list-disc pl-5 space-y-1 text-muted-foreground text-xs sm:text-sm">
              <li>
                Transportar armas, materiais explosivos, inflamáveis ou substâncias entorpecentes
                ilícitas;
              </li>
              <li>Praticar qualquer ato de importunação, assédio verbal, moral ou sexual;</li>
              <li>
                Realizar manifestações discriminatórias por motivo de raça, gênero, orientação
                sexual, crença, deficiência ou origem;
              </li>
              <li>
                Utilizar a plataforma para atividades ilícitas, golpes ou fraudes de pagamento;
              </li>
              <li>Cadastrar-se com identidade falsa ou dados de titularidade de terceiros.</li>
            </ul>
          </section>

          {/* 14. Acidentes, danos e incidentes */}
          <section id="secao-14" className="scroll-mt-20 space-y-3">
            <h2 className="font-display text-lg font-bold text-foreground flex items-center gap-2">
              <span className="flex size-7 items-center justify-center rounded-lg bg-caronaa-primary/10 text-xs font-bold text-caronaa-primary">
                14
              </span>
              Acidentes, danos e incidentes
            </h2>
            <p className="text-muted-foreground">
              Em caso de incidentes de trânsito, avarias materiais, furtos ou colisões durante o
              trajeto, aplicam-se integralmente as normas da legislação civil brasileira e do Código
              de Trânsito Brasileiro. O motorista do veículo, na condição de proprietário e condutor
              do automóvel, responde pela condução segura e pela ativação de suas apólices
              securitárias veiculares obrigatórias ou facultativas. A CARONAA prestará a cooperação
              necessária às autoridades legais no limite das informações cadastrais registradas no
              sistema.
            </p>
          </section>

          {/* 15. Limitações da plataforma */}
          <section id="secao-15" className="scroll-mt-20 space-y-3">
            <h2 className="font-display text-lg font-bold text-foreground flex items-center gap-2">
              <span className="flex size-7 items-center justify-center rounded-lg bg-caronaa-primary/10 text-xs font-bold text-caronaa-primary">
                15
              </span>
              Limitações da plataforma (Deveres Legais e Limites de Atuação)
            </h2>
            <p className="text-muted-foreground">
              A CARONAA atua como intermediadora de software e explica com clareza os limites de sua
              operação, em conformidade com o Marco Civil da Internet (Lei nº 12.965/2014) e o
              ordenamento jurídico nacional:
            </p>
            <ul className="list-disc pl-5 space-y-1 text-muted-foreground text-xs sm:text-sm">
              <li>
                A CARONAA não garante a disponibilidade ininterrupta do serviço, nem assegura que
                sempre haverá motoristas ou passageiros disponíveis para qualquer rota ou horário
                solicitado;
              </li>
              <li>
                A plataforma não se responsabiliza por atrasos decorrentes de congestionamentos,
                condições meteorológicas adversas, obras viárias ou imprevistos do trânsito;
              </li>
              <li>
                A CARONAA não responde por perdas indiretas ou lucros cessantes decorrentes do
                cancelamento de viagens ou de atrasos em compromissos pessoais ou profissionais dos
                usuários;
              </li>
              <li>
                <strong>
                  Nenhuma cláusula destes Termos tem por objeto ou efeito excluir responsabilidades
                  legais que, por força de lei imperativa, não possam ser excluídas.
                </strong>
              </li>
            </ul>
          </section>

          {/* 16. Proteção de dados */}
          <section id="secao-16" className="scroll-mt-20 space-y-3">
            <h2 className="font-display text-lg font-bold text-foreground flex items-center gap-2">
              <span className="flex size-7 items-center justify-center rounded-lg bg-caronaa-primary/10 text-xs font-bold text-caronaa-primary">
                16
              </span>
              Proteção de dados (LGPD)
            </h2>
            <p className="text-muted-foreground">
              O tratamento de dados pessoais coletados na plataforma obedece rigorosamente à Lei
              Geral de Proteção de Dados Pessoais (Lei nº 13.709/2018 - LGPD). Informações de
              localização aproximada, contato e trajeto são tratadas com a finalidade de viabilizar
              a conexão entre usuários, aprimorar a segurança e gerenciar a plataforma. Para
              informações completas sobre direitos do titular, armazenamento e compartilhamento,
              consulte nossa{" "}
              <Link
                to="/privacidade"
                className="font-semibold text-caronaa-primary-strong underline hover:text-caronaa-primary"
              >
                Política de Privacidade
              </Link>
              .
            </p>
          </section>

          {/* 17. Propriedade intelectual */}
          <section id="secao-17" className="scroll-mt-20 space-y-3">
            <h2 className="font-display text-lg font-bold text-foreground flex items-center gap-2">
              <span className="flex size-7 items-center justify-center rounded-lg bg-caronaa-primary/10 text-xs font-bold text-caronaa-primary">
                17
              </span>
              Propriedade intelectual
            </h2>
            <p className="text-muted-foreground">
              A marca nominativa e figurativa CARONAA, slogans, logotipos, telas, bancos de dados,
              algoritmos de matching e softwares associados são de titularidade exclusiva de seus
              fundadores e criadores. É vedada a cópia, reprodução, engenharia reversa ou exploração
              desautorizada de qualquer elemento protegido por propriedade industrial ou direitos
              autorais.
            </p>
          </section>

          {/* 18. Alterações dos termos */}
          <section id="secao-18" className="scroll-mt-20 space-y-3">
            <h2 className="font-display text-lg font-bold text-foreground flex items-center gap-2">
              <span className="flex size-7 items-center justify-center rounded-lg bg-caronaa-primary/10 text-xs font-bold text-caronaa-primary">
                18
              </span>
              Alterações dos termos
            </h2>
            <p className="text-muted-foreground">
              À medida que a CARONAA evolui da fase inicial para versões subsequentes, estes Termos
              de Uso poderão ser atualizados. Notificaremos os usuários sobre revisões relevantes
              por meio da plataforma ou dos canais cadastrados. A utilização contínua da aplicação
              após a divulgação de nova versão implicará aceitação dos novos termos.
            </p>
          </section>

          {/* 19. Contato */}
          <section id="secao-19" className="scroll-mt-20 space-y-3 border-t border-border pt-6">
            <h2 className="font-display text-lg font-bold text-foreground flex items-center gap-2">
              <span className="flex size-7 items-center justify-center rounded-lg bg-caronaa-primary/10 text-xs font-bold text-caronaa-primary">
                19
              </span>
              Contato
            </h2>
            <p className="text-muted-foreground">
              Para esclarecer dúvidas, enviar sugestões, reportar condutas inadequadas ou exercer
              seus direitos, entre em contato através dos nossos canais oficiais:
            </p>
            <div className="rounded-2xl bg-muted/40 p-4 space-y-2 text-xs sm:text-sm">
              <p>
                <strong>E-mail de suporte e assuntos jurídicos:</strong>{" "}
                <a
                  href="mailto:contato@caronaa.com.br"
                  className="font-semibold text-caronaa-primary-strong underline hover:text-caronaa-primary"
                >
                  contato@caronaa.com.br
                </a>
              </p>
              <p>
                <strong>Ecossistema de Inovação:</strong> Unifor Hub • Universidade de Fortaleza
              </p>
              <p>
                <strong>Presença em eventos:</strong> Stand da CARONAA no Siará Tech Summit 2026 •
                Centro de Eventos do Ceará
              </p>
            </div>
          </section>
        </div>

        {/* Rodapé da Página de Termos com CTAs de Ação */}
        <div className="mt-8 flex flex-col sm:flex-row items-center justify-between gap-4 rounded-2xl border border-border bg-card p-5">
          <div className="text-xs text-muted-foreground">
            Pronto para testar a mobilidade colaborativa?
          </div>
          <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
            <Button asChild variant="strong" className="flex-1 sm:flex-none">
<StsFormLink to="/formulario">
                Ir para o formulário STS 2026 <ArrowRight size={16} />
              </StsFormLink>
            </Button>
            <Button asChild variant="outline" className="flex-1 sm:flex-none">
              <Link to="/">Voltar ao início</Link>
            </Button>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
import { StsFormLink } from "@/components/caronaa/StsFormLink";
