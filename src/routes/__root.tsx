import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  useRouterState,
  HeadContent,
  Scripts,
  type ErrorComponentProps,
} from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { AuthProvider } from "../lib/auth-context";
import { NotificationProvider } from "@/lib/notification-context";
import { Toaster } from "@/components/ui/sonner";
import logoAsset from "@/assets/brand/caronaa-logo.png.asset.json";
import { registerPwa, requestPersistentStorage } from "@/lib/pwa";
import { PwaInstallNotice } from "@/components/caronaa/PwaInstallNotice";
import { recoverStaleChunk } from "@/lib/chunk-recovery";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>

        <h2 className="mt-4 text-xl font-semibold text-foreground">
          Page not found
        </h2>

        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>

        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: ErrorComponentProps) {
  console.error(error);

  const router = useRouter();

  useEffect(() => {
    if (recoverStaleChunk(error, window.sessionStorage, () => window.location.reload())) return;
    reportLovableError(error, {
      boundary: "tanstack_root_error_component",
    });
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          This page didn't load
        </h1>

        <p className="mt-2 text-sm text-muted-foreground">
          Something went wrong on our end. You can try refreshing or head back
          home.
        </p>

        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              if (/dynamically imported module|module script|Loading chunk/i.test(error instanceof Error ? error.message : String(error))) {
                window.location.reload();
                return;
              }
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Try again
          </button>

          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{
  queryClient: QueryClient;
}>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "google-site-verification", content: "Ot_tK4NfYqFNdaC0Q--vRHYZ47-Ln9EYPrufd_W4bhI" },
      { name: "theme-color", content: "#eab900" },
      { name: "apple-mobile-web-app-capable", content: "yes" },
      {
        name: "viewport",
        content: "width=device-width, initial-scale=1",
      },
      {
        title: "CARONAA",
      },
      {
        name: "description",
        content:
          "Compartilhe caminhos e descubra caronas na sua comunidade.",
      },
      {
        property: "og:title",
        content: "CARONAA",
      },
      {
        property: "og:description",
        content:
          "Compartilhe caminhos e descubra caronas na sua comunidade.",
      },
      {
        property: "og:type",
        content: "website",
      },
      {
        name: "twitter:card",
        content: "summary_large_image",
      },
    ],

    links: [
      { rel: "manifest", href: "/manifest.webmanifest" },
      {
        rel: "stylesheet",
        href: appCss,
      },
      {
        rel: "icon",
        href: logoAsset.url,
        type: "image/png",
      },
      {
        rel: "apple-touch-icon",
        href: "/pwa-icon-192.png",
      },
      {
        rel: "preconnect",
        href: "https://fonts.googleapis.com",
      },
      {
        rel: "preconnect",
        href: "https://fonts.gstatic.com",
        crossOrigin: "anonymous",
      },
      {
        rel: "stylesheet",
        href:
          "https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&family=Sora:wght@400;600;700;800&display=swap",
      },
    ],
  }),

  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <head>
        <HeadContent />

        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('caronaa-theme');var d=t==='dark'||(!t&&matchMedia('(prefers-color-scheme: dark)').matches);document.documentElement.classList.toggle('dark',d);document.documentElement.style.colorScheme=d?'dark':'light'}catch(e){}})();`,
          }}
        />
      </head>

      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RouteNavigationProgress() {
  const pending = useRouterState({ select: (state) => state.status === "pending" });
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    if (!pending) { setVisible(false); return; }
    // Fast transitions should not flash a loader.
    const timer = window.setTimeout(() => setVisible(true), 180);
    return () => window.clearTimeout(timer);
  }, [pending]);
  if (!visible || !pending) return null;
  return (
    <div role="progressbar" aria-label="Abrindo página" aria-valuemin={0} aria-valuemax={100}
      className="caronaa-navigation-progress pointer-events-none fixed inset-x-0 top-0 z-[110] h-[3px] overflow-hidden bg-[#FFBB00]/20">
      <div className="caronaa-navigation-progress-bar h-full origin-left bg-[#FFBB00]" />
    </div>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();

  useEffect(() => {
    void registerPwa();
    const persist = () => { void requestPersistentStorage(); };
    window.addEventListener("pointerdown", persist, { once: true });
    window.addEventListener("keydown", persist, { once: true });
    return () => {
      window.removeEventListener("pointerdown", persist);
      window.removeEventListener("keydown", persist);
    };
  }, []);

  // A missing route chunk can reject before the error boundary renders, leaving
  // a blank page; recover from the global signal too.
  useEffect(() => {
    const recover = (event: PromiseRejectionEvent) => {
      recoverStaleChunk(event.reason, window.sessionStorage, () => window.location.reload());
    };
    window.addEventListener("unhandledrejection", recover);
    return () => window.removeEventListener("unhandledrejection", recover);
  }, []);


  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider delayDuration={0}>
        <AuthProvider>
          <NotificationProvider>
          {/* Required: nested routes render here. Removing <Outlet /> breaks all child routes. */}
          <RouteNavigationProgress />
          <Outlet />
          <PwaInstallNotice />

          <Toaster richColors position="top-center" />
          </NotificationProvider>
        </AuthProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );}
