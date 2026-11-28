import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Download, X } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { checkAndroidUpdate } from "@/lib/native/android-release-client";
import { isNativePluginAvailable, onNativeAppResume } from "@/lib/native/capacitor-bridge";

const updateKey = ["caronaa", "android-release"] as const;
const dismissalKey = "caronaa:android-update-snoozed";
const oneDayMs = 24 * 60 * 60 * 1000;

function readDismissal(): { versionCode: number; until: number } | null {
  try {
    const dismissal = JSON.parse(window.localStorage.getItem(dismissalKey) ?? "null");
    return Number.isInteger(dismissal?.versionCode) &&
      Number.isFinite(dismissal.until) &&
      dismissal.until > Date.now() &&
      dismissal.until <= Date.now() + oneDayMs
      ? dismissal
      : null;
  } catch {
    return null;
  }
}

export function AndroidUpdateNotice({ fromProfile }: { fromProfile: boolean }) {
  const native = isNativePluginAvailable("App");
  const queryClient = useQueryClient();
  const [dismissal, setDismissal] = useState(readDismissal);
  const { data: release, isError } = useQuery({
    queryKey: updateKey,
    enabled: native,
    queryFn: ({ signal }) => checkAndroidUpdate(signal),
    staleTime: 5 * 60 * 1000,
    retry: false,
  });

  useEffect(() => {
    if (!native) return;
    return onNativeAppResume(() => {
      void queryClient.refetchQueries({ queryKey: updateKey, type: "active", stale: true });
    });
  }, [native, queryClient]);

  useEffect(() => {
    if (!dismissal || dismissal.until <= Date.now()) return;
    const timer = window.setTimeout(() => setDismissal(null), dismissal.until - Date.now());
    return () => window.clearTimeout(timer);
  }, [dismissal]);

  if (!native || !release || isError) return null;
  if (
    !fromProfile &&
    dismissal?.versionCode === release.versionCode &&
    dismissal.until > Date.now()
  ) {
    return null;
  }

  function dismiss(versionCode: number) {
    const next = { versionCode, until: Date.now() + oneDayMs };
    setDismissal(next);
    try {
      window.localStorage.setItem(dismissalKey, JSON.stringify(next));
    } catch {
      // The current screen can still dismiss the notice when storage is unavailable.
    }
  }

  return (
    <aside
      aria-label="Atualização do CARONAA"
      className="shrink-0 border-b border-primary/25 bg-background px-3 py-2 text-foreground"
    >
      <div className="mx-auto flex max-w-[1280px] flex-wrap items-center gap-x-3 gap-y-1">
        <p role="status" className="min-w-32 flex-1 text-sm font-semibold">
          CARONAA {release.versionName} disponível
        </p>
        <Button asChild size="sm" className="min-h-11 shrink-0">
          <a href={release.downloadUrl}>
            <Download size={16} aria-hidden="true" />
            Atualizar app
          </a>
        </Button>
        {!fromProfile && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-11 shrink-0"
            aria-label="Adiar aviso de atualização por 24 horas"
            onClick={() => dismiss(release.versionCode)}
          >
            <X size={16} aria-hidden="true" />
          </Button>
        )}
      </div>
    </aside>
  );
}
