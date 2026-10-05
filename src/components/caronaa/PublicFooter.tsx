import { Link } from "@tanstack/react-router";
import { Brand } from "@/components/caronaa/AppShell";
import { CaronaaSymbol } from "@/components/caronaa/BrandElements";
import { Sparkles, ShieldCheck, HeartHandshake } from "lucide-react";

export function PublicFooter() {
  return (
    <footer className="border-t border-border bg-card/60 text-card-foreground">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="grid gap-10 md:grid-cols-4">
          {/* Coluna 1: Marca e Posicionamento */}
          <div className="space-y-4 md:col-span-2">
            <Brand />
            <p className="max-w-md text-sm leading-relaxed text-muted-foreground">
              <strong className="text-foreground">
                CARONAA conecta quem precisa ir com quem já está indo.
              </strong>
              <br />
              Encontre uma carona para o seu trajeto ou compartilhe o lugar que está sobrando no
              seu carro. Mobilidade comunitária em fase de validação real.
            </p>
            <div className="flex flex-wrap items-center gap-2 pt-2 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-secondary px-3 py-1 font-medium text-foreground">
                <Sparkles size={13} className="text-caronaa-primary" />
                Startup expositora no Siará Tech Summit 2026
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-secondary px-3 py-1 font-medium text-foreground">
                <CaronaaSymbol size={13} className="text-caronaa-primary" />
                Ecossistema Unifor Hub
              </span>
            </div>
          </div>

          {/* Coluna 2: Navegação Pública */}
          <div className="space-y-3">
            <p className="text-xs font-bold tracking-wider text-primary uppercase">Plataforma</p>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>
                <Link
                  to="/"
                  className="transition-colors hover:text-foreground"
                >
                  Página Inicial
                </Link>
              </li>
              <li>
                <Link
                  to="/como-funciona"
                  className="transition-colors hover:text-foreground"
                >
                  Como Funciona
                </Link>
              </li>
              <li>
                <Link
                  to="/buscar"
                  className="transition-colors hover:text-foreground"
                >
                  Buscar Caronas
                </Link>
              </li>
              <li>
                <Link
                  to="/formulario"
                  className="inline-flex items-center gap-1 font-medium text-caronaa-primary-strong hover:underline"
                >
                  Validação STS 2026
                </Link>
              </li>
            </ul>
          </div>

          {/* Coluna 3: Confiança e Legal */}
          <div className="space-y-3">
            <p className="text-xs font-bold tracking-wider text-primary uppercase">Confiança & Diretrizes</p>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>
                <Link
                  to="/seguranca"
                  className="transition-colors hover:text-foreground"
                >
                  Segurança e responsabilidades
                </Link>
              </li>
              <li>
                <Link
                  to="/termos"
                  className="transition-colors hover:text-foreground"
                >
                  Termos de Uso
                </Link>
              </li>
              <li>
                <Link
                  to="/privacidade"
                  className="transition-colors hover:text-foreground"
                >
                  Privacidade
                </Link>
              </li>
              <li>
                <Link
                  to="/auth"
                  className="transition-colors hover:text-foreground"
                >
                  Entrar
                </Link>
              </li>
              <li>
                <a
                  href="mailto:contato@caronaa.com.br"
                  className="transition-colors hover:text-foreground"
                >
                  Contato
                </a>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-8 rounded-xl border border-border/60 bg-muted/30 p-3.5 text-center text-xs text-muted-foreground">
          <p>
            A CARONAA conecta motoristas e passageiros de rotas afins em um ambiente de validação comunitária.
            Não fazemos promessas de segurança absoluta; a plataforma atua aproximando membros da comunidade que combinam seus deslocamentos com respeito mútuo.
          </p>
        </div>

        <div className="mt-8 flex flex-col items-center justify-between gap-4 border-t border-border pt-6 text-xs text-muted-foreground sm:flex-row">
          <p>© {new Date().getFullYear()} CARONAA • Siará Tech Summit 2026 • Unifor Hub. Fortaleza, Ceará.</p>
          <p className="text-center sm:text-right">
            Projeto em estágio inicial de validação • Programa de Pré-Aceleração Unifor Hub
          </p>
        </div>
      </div>
    </footer>
  );
}
