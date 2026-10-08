import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell } from "@/components/caronaa/AppShell";
import { BrandBadge, StsBadge } from "@/components/caronaa/BrandElements";
import { Button } from "@/components/ui/button";
import {
  ShieldCheck,
  Lock,
  Eye,
  MapPin,
  CheckCircle2,
  AlertTriangle,
  Sparkles,
  HelpCircle,
  FileText,
  ArrowRight,
  Database,
  Smartphone,
  Share2,
} from "lucide-react";

export const Route = createFileRoute("/privacidade")({
  head: () => ({
    meta: [{ property: "og:title", content: "Política de Privacidade — CARONAA" },
{ property: "og:description", content: "Conheça a Política de Privacidade da CARONAA. Saiba como coletamos, usamos, tratamos e protegemos seus dados em conformidade com a LGPD." },
{ property: "og:type", content: "website" },
{ name: "twitter:card", content: "summary" },
      { title: "Política de Privacidade — CARONAA" },
      {
        name: "description",
        content:
          "Conheça a Política de Privacidade da CARONAA. Saiba como coletamos, usamos, tratamos e protegemos seus dados em conformidade com a LGPD.",
      },
    ],
  }),
  component: PrivacidadePage,
});

const SUMARIO = [
  { id: "apresentacao", titulo: "1. Nosso compromisso" },
  { id: "dados-coletados", titulo: "2. Dados que coletamos" },
  { id: "finalidades", titulo: "3. Para que usamos seus dados" },
  { id: "localizacao", titulo: "4. Tratamento de localização" },
  { id: "consentimentos", titulo: "5. Consentimentos e escolhas" },
  { id: "compartilhamento", titulo: "6. Compartilhamento de dados" },
  { id: "seguranca", titulo: "7. Segurança e limites" },
  { id: "direitos", titulo: "8. Seus direitos (LGPD)" },
  { id: "estagio-mvp", titulo: "9. Evolução e fase inicial" },
  { id: "contato", titulo: "10. Contato e DPO" },
];

function PrivacidadePage() {
  return (
    <AppShell publicPage>
      <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 sm:py-14">
        {/* Cabeçalho */}
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <BrandBadge variant="community" />
            <StsBadge />
          </div>

          <h1 className="font-display text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl">
            Política de Privacidade da CARONAA
          </h1>

          <p className="text-sm text-muted-foreground">
            Versão do documento:{" "}
            <strong className="text-foreground">privacidade_sts_2026_v1</strong> • Última
            atualização: Outubro de 2026
          </p>
        </div>

        {/* Destaque Obrigatório: Startup em Fase Inicial */}
        <div className="mt-6 rounded-2xl border border-caronaa-primary/30 bg-caronaa-primary/10 p-4 sm:p-5">
          <div className="flex items-start gap-3">
            <Sparkles className="size-5 shrink-0 text-caronaa-primary mt-0.5" />
            <div className="space-y-1">
              <p className="text-sm font-bold text-foreground">Transparência e Fase Inicial</p>
              <p className="text-sm font-semibold text-foreground/90">
                &ldquo;CARONAA é uma startup em fase inicial e esta política poderá evoluir à medida
                que a plataforma e suas funcionalidades forem desenvolvidas.&rdquo;
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Construímos esta política em linguagem acessível e humana para que você saiba
                exatamente o que acontece com cada informação compartilhada conosco.
              </p>
            </div>
          </div>
        </div>

        {/* Aviso de Revisão Jurídica */}
        <div className="mt-4 rounded-2xl border border-amber-500/30 bg-amber-50/50 dark:bg-amber-950/20 p-4 sm:p-5">
          <div className="flex items-start gap-3">
            <AlertTriangle className="size-5 shrink-0 text-amber-600 dark:text-amber-400 mt-0.5" />
            <div className="space-y-1">
              <p className="text-xs font-bold uppercase tracking-wider text-amber-800 dark:text-amber-300">
                Aviso Importante
              </p>
              <p className="text-xs sm:text-sm text-amber-900/90 dark:text-amber-200/90 leading-relaxed">
                &ldquo;Esta Política de Privacidade não substitui aconselhamento jurídico. A versão
                publicada deverá ser revisada juridicamente antes do lançamento público
                definitivo.&rdquo;
              </p>
            </div>
          </div>
        </div>

        {/* Sumário Rápido */}
        <nav
          aria-label="Sumário da Política de Privacidade"
          className="mt-8 rounded-2xl border border-border bg-card p-5 shadow-sm"
        >
          <div className="flex items-center gap-2 pb-3 border-b border-border">
            <FileText size={18} className="text-caronaa-primary" />
            <h2 className="text-sm font-bold text-foreground">Sumário do Documento</h2>
          </div>
          <ol className="mt-3 grid grid-cols-1 gap-2 text-xs sm:grid-cols-2">
            {SUMARIO.map((item) => (
              <li key={item.id}>
                <a
                  href={`#${item.id}`}
                  className="flex items-center gap-2 rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition"
                >
                  <span className="font-semibold text-caronaa-primary-strong">{item.titulo}</span>
                </a>
              </li>
            ))}
          </ol>
        </nav>

        {/* Conteúdo da Política */}
        <div className="mt-8 space-y-8 rounded-3xl border border-border bg-card p-6 text-sm leading-relaxed text-foreground shadow-soft sm:p-10">
          {/* 1. Nosso compromisso */}
          <section id="apresentacao" className="scroll-mt-20 space-y-3">
            <h2 className="font-display text-lg font-bold text-foreground flex items-center gap-2">
              <ShieldCheck size={20} className="text-caronaa-primary" />
              1. Nosso compromisso com a sua privacidade (LGPD)
            </h2>
            <p className="text-muted-foreground">
              A <strong>CARONAA</strong> respeita a sua privacidade e preza pela proteção dos seus
              dados pessoais. Esta Política de Privacidade explica de forma simples, transparente e
              acessível como tratamos suas informações em nossos serviços, sites e formulários
              (inclusive durante a validação no Siará Tech Summit 2026), em estrita conformidade com
              a Lei Geral de Proteção de Dados Pessoais (Lei nº 13.709/2018 - LGPD).
            </p>
          </section>

          {/* 2. Dados que coletamos */}
          <section id="dados-coletados" className="scroll-mt-20 space-y-4">
            <h2 className="font-display text-lg font-bold text-foreground flex items-center gap-2">
              <Database size={20} className="text-caronaa-primary" />
              2. Quais dados coletamos
            </h2>
            <p className="text-muted-foreground">
              Para viabilizar a conexão entre motoristas e passageiros, coletamos apenas os dados
              estritamente relevantes e proporcionais a cada finalidade:
            </p>

            <div className="grid grid-cols-1 gap-3.5">
              <div className="rounded-2xl border border-border bg-muted/20 p-4">
                <h3 className="font-bold text-sm text-foreground">a) Dados de identificação</h3>
                <p className="text-xs text-muted-foreground mt-1">
                  Nome completo, nome social ou a forma como você prefere ser chamado nos contatos
                  da plataforma.
                </p>
              </div>

              <div className="rounded-2xl border border-border bg-muted/20 p-4">
                <h3 className="font-bold text-sm text-foreground">b) Dados de contato</h3>
                <p className="text-xs text-muted-foreground mt-1">
                  Número de telefone com WhatsApp (para validação de autenticidade e combinação ágil
                  de caronas) e endereço de e-mail (para avisos da conta, recuperação de acesso e
                  comunicados essenciais).
                </p>
              </div>

              <div className="rounded-2xl border border-border bg-muted/20 p-4">
                <h3 className="font-bold text-sm text-foreground">
                  c) Dados de localização e trajeto
                </h3>
                <p className="text-xs text-muted-foreground mt-1">
                  Bairro ou ponto de referência de origem, bairro ou polo de destino, janelas de
                  horário previstas para saída/chegada e paradas desejadas.
                </p>
              </div>

              <div className="rounded-2xl border border-border bg-muted/20 p-4">
                <h3 className="font-bold text-sm text-foreground">
                  d) Dados de utilização e preferências
                </h3>
                <p className="text-xs text-muted-foreground mt-1">
                  Papel escolhido (motorista, passageiro ou ambos), número de assentos disponíveis
                  ou solicitados, preferências de conforto (ar-condicionado, música, bagagem),
                  preferências de perfil (ex.: caronas exclusivas por gênero) e histórico de buscas
                  ou ofertas na plataforma.
                </p>
              </div>

              <div className="rounded-2xl border border-border bg-muted/20 p-4">
                <h3 className="font-bold text-sm text-foreground">
                  e) Dados de pesquisas de validação e feedback
                </h3>
                <p className="text-xs text-muted-foreground mt-1">
                  Respostas voluntárias sobre hábitos atuais de deslocamento, maiores dores e
                  dificuldades no trânsito, estimativa de gastos habituais, comentários de avaliação
                  e sugestões livres para aprimoramento da solução.
                </p>
              </div>

              <div className="rounded-2xl border border-border bg-muted/20 p-4">
                <h3 className="font-bold text-sm text-foreground">
                  f) Dados técnicos e telemetria
                </h3>
                <p className="text-xs text-muted-foreground mt-1">
                  Endereço IP aproximado, categoria do dispositivo (computador, celular ou tablet),
                  tipo de navegador, registros de data/hora de acesso (logs) e identificadores
                  anônimos de sessão.
                </p>
              </div>

              <div className="rounded-2xl border border-border bg-muted/20 p-4">
                <h3 className="font-bold text-sm text-foreground">g) Cookies e analytics</h3>
                <p className="text-xs text-muted-foreground mt-1">
                  Identificadores de atribuição de campanha (como tags de eventos ou parcerias) e
                  métricas agregadas de funil, utilizadas exclusivamente para avaliar conversão,
                  estabilidade e usabilidade da aplicação.
                </p>
              </div>
            </div>
          </section>

          {/* 3. Para que usamos seus dados */}
          <section id="finalidades" className="scroll-mt-20 space-y-3">
            <h2 className="font-display text-lg font-bold text-foreground flex items-center gap-2">
              <CheckCircle2 size={20} className="text-caronaa-primary" />
              3. Para que usamos seus dados (Finalidades)
            </h2>
            <p className="text-muted-foreground">
              Seus dados pessoais são tratados estritamente para propósitos legítimos e
              transparentes:
            </p>
            <ul className="list-disc pl-5 space-y-1.5 text-muted-foreground text-xs sm:text-sm">
              <li>
                <strong>Criar e gerenciar sua conta:</strong> autenticar seu acesso, manter seu
                perfil seguro e sincronizar suas preferências;
              </li>
              <li>
                <strong>Permitir o funcionamento da CARONAA:</strong> viabilizar as funcionalidades
                do aplicativo e o fluxo de caronas;
              </li>
              <li>
                <strong>Procurar compatibilidade de trajetos:</strong> comparar origens, destinos e
                horários para sugerir conexões potenciais com outros participantes;
              </li>
              <li>
                <strong>Entrar em contato sobre caronas:</strong> enviar notificações via WhatsApp
                ou e-mail quando houver um trajeto convergente ou confirmação necessária;
              </li>
              <li>
                <strong>Melhorar o produto continuamente:</strong> identificar gargalos de
                usabilidade, corrigir falhas técnicas e aprimorar a experiência de navegação;
              </li>
              <li>
                <strong>Realizar validação de problema e solução:</strong> analisar a viabilidade
                das rotas urbanas e a aceitação do modelo colaborativo;
              </li>
              <li>
                <strong>Medir conversão e utilização:</strong> acompanhar métricas estatísticas
                agregadas de engajamento do funil de participação;
              </li>
              <li>
                <strong>Segurança e prevenção de abuso:</strong> coibir fraudes cadastrais, contas
                duplicadas, spam ou comportamentos contrários às diretrizes da comunidade;
              </li>
              <li>
                <strong>Cumprimento de obrigações legais:</strong> atender ao Marco Civil da
                Internet (guarda de registros de conexão), solicitações de autoridades competentes e
                normas fiscais/regulatórias.
              </li>
            </ul>
          </section>

          {/* 4. Tratamento de localização */}
          <section id="localizacao" className="scroll-mt-20 space-y-3">
            <h2 className="font-display text-lg font-bold text-foreground flex items-center gap-2">
              <MapPin size={20} className="text-caronaa-primary" />
              4. Como tratamos sua localização (Privacidade e Aproximação)
            </h2>
            <div className="rounded-2xl border border-caronaa-primary/20 bg-caronaa-primary/5 p-4 sm:p-5 space-y-2">
              <p className="font-bold text-sm text-foreground">
                Diretriz de discrição e proteção do domicílio:
              </p>
              <p className="text-xs sm:text-sm text-foreground/90">
                Os dados de localização são utilizados exclusivamente para identificar
                compatibilidade de percurso entre quem oferece e quem busca carona.
              </p>
              <ul className="list-disc pl-5 space-y-1 text-xs text-muted-foreground">
                <li>
                  <strong>
                    Não exibimos publicamente seu endereço residencial exato sem necessidade;
                  </strong>
                </li>
                <li>
                  <strong>
                    Sempre que possível, utilizamos região e localização aproximada na interface
                    pública
                  </strong>{" "}
                  (tais como o bairro, pontos de referência conhecidos ou polos de grande circulação
                  urbana);
                </li>
                <li>
                  O ponto exato de embarque ou desembarque só é combinado diretamente entre os
                  participantes após o interesse mútuo e a confirmação mútua da carona.
                </li>
              </ul>
            </div>
          </section>

          {/* 5. Consentimentos e escolhas */}
          <section id="consentimentos" className="scroll-mt-20 space-y-3">
            <h2 className="font-display text-lg font-bold text-foreground flex items-center gap-2">
              <Lock size={20} className="text-caronaa-primary" />
              5. Consentimentos e escolhas (Sem caixas genéricas)
            </h2>
            <p className="text-muted-foreground">
              A CARONAA não utiliza um único checkbox genérico para englobar finalidades distintas.
              Nossos formulários e interfaces diferenciam com clareza:
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="rounded-xl border border-border bg-card p-3.5 space-y-1">
                <span className="font-bold text-foreground block">
                  Tratamento necessário para o serviço
                </span>
                <span className="text-muted-foreground">
                  Vinculado aos Termos de Uso para viabilizar o cadastro, o cálculo de rotas e o
                  matching de caronas (execução de contrato).
                </span>
              </div>
              <div className="rounded-xl border border-border bg-card p-3.5 space-y-1">
                <span className="font-bold text-foreground block">Política de Privacidade</span>
                <span className="text-muted-foreground">
                  Ciência e concordância sobre como dados de contato e localização aproximada são
                  tratados durante o uso.
                </span>
              </div>
              <div className="rounded-xl border border-border bg-card p-3.5 space-y-1">
                <span className="font-bold text-foreground block">
                  Participação em pesquisas de validação
                </span>
                <span className="text-muted-foreground">
                  Opção voluntária para colaborar com entrevistas e questionários de aprofundamento
                  sobre mobilidade urbana.
                </span>
              </div>
              <div className="rounded-xl border border-border bg-card p-3.5 space-y-1">
                <span className="font-bold text-foreground block">Comunicações e novidades</span>
                <span className="text-muted-foreground">
                  Consentimento opcional e revogável a qualquer momento para receber novidades do
                  lançamento da plataforma após o evento.
                </span>
              </div>
            </div>
          </section>

          {/* 6. Compartilhamento de dados */}
          <section id="compartilhamento" className="scroll-mt-20 space-y-3">
            <h2 className="font-display text-lg font-bold text-foreground flex items-center gap-2">
              <Share2 size={20} className="text-caronaa-primary" />
              6. Compartilhamento responsável de dados
            </h2>
            <p className="text-muted-foreground">
              <strong>
                A CARONAA não vende, não aluga e não comercializa dados pessoais com terceiros para
                fins publicitários.
              </strong>
            </p>
            <p className="text-muted-foreground">
              O compartilhamento limita-se estritamente ao necessário:
            </p>
            <ul className="list-disc pl-5 space-y-1 text-xs sm:text-sm text-muted-foreground">
              <li>
                <strong>Entre participantes compatíveis:</strong> nome, foto de perfil (quando
                cadastrada), preferências e WhatsApp são disponibilizados mutuamente apenas quando
                há interesse recíproco em combinar uma viagem;
              </li>
              <li>
                <strong>Provedores de infraestrutura tecnológica:</strong> provedores de hospedagem
                em nuvem, bancos de dados seguros e serviços de autenticação que atuam como
                operadores sob estrito dever de sigilo;
              </li>
              <li>
                <strong>Autoridades competentes:</strong> em caso de requisição judicial legalmente
                fundamentada ou cumprimento de dever legal.
              </li>
            </ul>
          </section>

          {/* 7. Segurança e limites */}
          <section id="seguranca" className="scroll-mt-20 space-y-3">
            <h2 className="font-display text-lg font-bold text-foreground flex items-center gap-2">
              <Lock size={20} className="text-caronaa-primary" />
              7. Medidas de segurança e seus limites técnicos
            </h2>
            <p className="text-muted-foreground">
              Adotamos salvaguardas técnicas e organizacionais compatíveis com o estágio da
              plataforma, incluindo criptografia em trânsito (HTTPS/TLS), autenticação segura de
              acessos, segregação de credenciais e controle restrito de acesso aos bancos de dados.
            </p>
            <div className="rounded-xl border border-border bg-muted/30 p-3.5 text-xs text-muted-foreground">
              <p className="font-bold text-foreground text-xs sm:text-sm mb-1">
                Transparência sobre segurança:
              </p>
              <p>
                Embora apliquemos esforços contínuos e padrões modernos de segurança, nenhum sistema
                informático ou transmissão de dados na internet é totalmente inviolável. Portanto,{" "}
                <strong>não prometemos segurança absoluta</strong> contra ameaças cibernéticas
                imprevisíveis ou vazamentos provocados por negligência do próprio usuário na guarda
                de suas senhas.
              </p>
            </div>
          </section>

          {/* 8. Seus direitos (LGPD) */}
          <section id="direitos" className="scroll-mt-20 space-y-3">
            <h2 className="font-display text-lg font-bold text-foreground flex items-center gap-2">
              <Eye size={20} className="text-caronaa-primary" />
              8. Seus direitos como titular de dados
            </h2>
            <p className="text-muted-foreground">
              Nos termos do artigo 18 da LGPD, você possui os seguintes direitos em relação aos seus
              dados pessoais tratados pela CARONAA:
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
              <div className="rounded-lg border border-border bg-card p-3">
                <strong>Confirmação e Acesso:</strong> saber se tratamos seus dados e solicitar
                cópia das informações.
              </div>
              <div className="rounded-lg border border-border bg-card p-3">
                <strong>Correção e Atualização:</strong> retificar dados incompletos, inexatos ou
                desatualizados.
              </div>
              <div className="rounded-lg border border-border bg-card p-3">
                <strong>Eliminação dos dados:</strong> solicitar a exclusão de dados tratados com
                base no seu consentimento, ressalvadas as hipóteses legais de guarda obrigatória.
              </div>
              <div className="rounded-lg border border-border bg-card p-3">
                <strong>Revogação do consentimento:</strong> retirar seu consentimento a qualquer
                momento de forma simples e gratuita.
              </div>
              <div className="rounded-lg border border-border bg-card p-3">
                <strong>Informação sobre compartilhamento:</strong> saber com quais entidades
                públicas ou privadas compartilhamos dados.
              </div>
              <div className="rounded-lg border border-border bg-card p-3">
                <strong>Oposição e Portabilidade:</strong> opor-se a tratamentos em desacordo com a
                lei ou solicitar portabilidade nos termos regulamentares.
              </div>
            </div>
            <p className="text-xs text-muted-foreground pt-1">
              Para exercer qualquer um dos seus direitos, basta nos enviar uma solicitação pelo
              e-mail informado ao final desta política.
            </p>
          </section>

          {/* 9. Evolução e fase inicial */}
          <section id="estagio-mvp" className="scroll-mt-20 space-y-3">
            <h2 className="font-display text-lg font-bold text-foreground flex items-center gap-2">
              <Sparkles size={20} className="text-caronaa-primary" />
              9. Evolução da plataforma e alterações desta política
            </h2>
            <p className="text-muted-foreground">
              A CARONAA é um projeto em contínuo desenvolvimento. Esta Política de Privacidade
              poderá ser revisada e enriquecida à medida que novos recursos, integrações de mapas ou
              funcionalidades colaborativas forem introduzidos.
            </p>
            <p className="text-muted-foreground">
              Sempre que houver atualizações relevantes que afetem seus direitos ou a forma como
              tratamos suas informações, disponibilizaremos a nova versão nesta mesma página e
              destacaremos a nova data de vigência.
            </p>
          </section>

          {/* 10. Contato e DPO */}
          <section id="contato" className="scroll-mt-20 space-y-3 border-t border-border pt-6">
            <h2 className="font-display text-lg font-bold text-foreground flex items-center gap-2">
              <HelpCircle size={20} className="text-caronaa-primary" />
              10. Canal de contato e encarregado de dados (DPO)
            </h2>
            <p className="text-muted-foreground">
              Caso você tenha dúvidas sobre esta política, queira solicitar a exclusão dos seus
              dados ou deseje falar com o encarregado pelo tratamento de dados pessoais da CARONAA,
              entre em contato:
            </p>
            <div className="rounded-2xl bg-muted/40 p-4 space-y-2 text-xs sm:text-sm">
              <p>
                <strong>E-mail para temas de privacidade e LGPD:</strong>{" "}
                <a
                  href="mailto:contato@caronaa.com.br"
                  className="font-semibold text-caronaa-primary-strong underline hover:text-caronaa-primary"
                >
                  contato@caronaa.com.br
                </a>
              </p>
              <p>
                <strong>Iniciativa:</strong> Projeto CARONAA • Unifor Hub (Universidade de
                Fortaleza)
              </p>
              <p>
                <strong>Cidade / Estado:</strong> Fortaleza, Ceará, Brasil
              </p>
            </div>
          </section>
        </div>

        {/* Rodapé com Botões de Ação */}
        <div className="mt-8 flex flex-col sm:flex-row items-center justify-between gap-4 rounded-2xl border border-border bg-card p-5">
          <div className="text-xs text-muted-foreground">
            Conheça também as regras de uso da plataforma:
          </div>
          <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
            <Button asChild variant="strong" className="flex-1 sm:flex-none">
              <Link to="/termos">
                Ver Termos de Uso <ArrowRight size={16} />
              </Link>
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
