import React from "react";
import { Link } from "@tanstack/react-router";
import logoAsset from "@/assets/brand/caronaa-logo.png.asset.json";
import { cn } from "@/lib/utils";

export function PublicFooter({ className }: { className?: string }) {
  return (
    <footer
      className={cn(
        "border-t border-border bg-card/60 text-foreground transition-colors",
        className,
      )}
      aria-label="Rodapé institucional CARONAA"
    >
      <div className="mx-auto max-w-[1280px] px-4 py-12 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-8 md:grid-cols-12 md:gap-12">
          {/* Coluna 1: Marca, Proposta de Valor e Badges Institucionais */}
          <div className="space-y-4 md:col-span-6 lg:col-span-7">
            <Link to="/" className="inline-block" aria-label="CARONAA — Início">
              <img src={logoAsset.url} alt="CARONAA" className="h-10 w-auto object-contain" />
            </Link>

            <p className="max-w-md text-sm font-medium leading-relaxed text-muted-foreground">
              Conectando quem precisa ir com quem já está indo.
            </p>

            {/* Badges de Ecossistema e Evento */}
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <div
                className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-3 py-1 text-xs font-medium text-foreground shadow-2xs"
                title="Startup incubada/residente no ecossistema de inovação Unifor Hub"
              >
                <span
                  className="size-2 rounded-full bg-caronaa-primary shrink-0"
                  aria-hidden="true"
                />
                <span>Startup do Unifor Hub</span>
              </div>

              <div
                className="inline-flex items-center gap-1.5 rounded-full border border-event-cyan/30 bg-background px-3 py-1 text-xs font-semibold text-foreground shadow-2xs"
                title="Startup expositora oficial no Siará Tech Summit 2026"
              >
                <span className="size-2 rounded-full bg-event-cyan shrink-0" aria-hidden="true" />
                <span>Expositora no Siará Tech Summit 2026</span>
              </div>
            </div>
          </div>

          {/* Coluna 2: Links Institucionais e Navegação Pública */}
          <div className="grid grid-cols-2 gap-6 sm:grid-cols-2 md:col-span-6 lg:col-span-5">
            {/* Plataforma & Evento */}
            <div className="space-y-3">
              <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Plataforma
              </p>
              <ul className="space-y-2.5 text-sm font-medium">
                <li>
                  <Link
                    to="/como-funciona"
                    className="text-muted-foreground transition-colors hover:text-foreground"
                  >
                    Como funciona
                  </Link>
                </li>
                <li>
                  <Link
                    to="/"
                    hash="siara-tech-summit"
                    className="text-muted-foreground transition-colors hover:text-foreground"
                  >
                    Siará Tech Summit
                  </Link>
                </li>
                <li>
                  <Link
                    to="/seguranca"
                    className="text-muted-foreground transition-colors hover:text-foreground"
                  >
                    Segurança
                  </Link>
                </li>
              </ul>
            </div>

            {/* Conta & Jurídico */}
            <div className="space-y-3">
              <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Acesso & Termos
              </p>
              <ul className="space-y-2.5 text-sm font-medium">
                <li>
                  <Link
                    to="/auth"
                    className="text-muted-foreground transition-colors hover:text-foreground"
                  >
                    Entrar
                  </Link>
                </li>
                <li>
                  <Link
                    to="/auth"
                    search={{ mode: "signup" }}
                    className="text-muted-foreground transition-colors hover:text-foreground"
                  >
                    Criar conta
                  </Link>
                </li>
                <li>
                  <Link
                    to="/termos"
                    className="text-muted-foreground transition-colors hover:text-foreground"
                  >
                    Termos de Uso
                  </Link>
                </li>
                <li>
                  <Link
                    to="/privacidade"
                    className="text-muted-foreground transition-colors hover:text-foreground"
                  >
                    Privacidade
                  </Link>
                </li>
              </ul>
            </div>
          </div>
        </div>

        {/* Linha Inferior com Copyright e Crédito */}
        <div className="mt-10 border-t border-border/80 pt-6 text-center sm:flex sm:items-center sm:justify-between sm:text-left">
          <p className="text-xs text-muted-foreground">
            © {new Date().getFullYear()} CARONAA. Todos os direitos reservados.
          </p>
          <p className="mt-2 text-xs text-muted-foreground/80 sm:mt-0">
            Mobilidade colaborativa e sustentável para a comunidade.
          </p>
        </div>
      </div>
    </footer>
  );
}
