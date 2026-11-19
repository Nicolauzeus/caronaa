import { useEffect, useState } from "react";
import { setOpportunityAlerts } from "@/lib/ride-opportunity-alerts";
import { toast } from "sonner";
import { Bell, CheckCheck, Volume2, VolumeX } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useNotifications } from "@/lib/notification-context";
import { playNotificationSound, startLoop, stopLoop, unlockNotificationAudio } from "@/lib/notification-sound";

export function NotificationPreferences() {
  const { settings, setSoundEnabled } = useNotifications();
  const [opportunities, setOpportunities] = useState<boolean | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    setOpportunityAlerts()
      .then((value) => {
        if (active) setOpportunities(value);
      })
      .catch((cause) => {
        if (active) setError(cause.message);
      });
    return () => {
      active = false;
    };
  }, []);
  return (
    <div className="mb-6 space-y-3">
      <section
        className="mb-6 flex items-center justify-between gap-4 border-y border-border py-4"
        aria-label="Preferências de notificações"
      >
        <label htmlFor="notification-sound" className="text-sm font-medium">
          Som das notificações
        </label>
        <Switch
          id="notification-sound"
          checked={settings.soundEnabled}
          onCheckedChange={setSoundEnabled}
        />
      </section>
      <section className="flex items-center justify-between gap-4 border-b border-border pb-4">
        <label htmlFor="opportunity-alerts" className="text-sm font-medium">
          Avisos de oportunidades de até uma hora
        </label>
        <Switch
          id="opportunity-alerts"
          checked={opportunities ?? false}
          disabled={opportunities == null || saving}
          onCheckedChange={async (enabled) => {
            setSaving(true);
            try {
              setOpportunities(await setOpportunityAlerts(enabled));
              setError("");
            } catch (cause) {
              toast.error(cause instanceof Error ? cause.message : "Não foi possível salvar.");
            } finally {
              setSaving(false);
            }
          }}
        />
      </section>
      <section className="space-y-2 border-b border-border pb-4" aria-label="Testar alertas sonoros">
        <p className="text-xs font-medium text-muted-foreground">Ouvir alertas no celular</p>
        <div className="grid grid-cols-3 gap-2">
          <Button type="button" variant="outline" size="sm" disabled={!settings.soundEnabled} onClick={() => { void unlockNotificationAudio().then(() => { startLoop("audio-preview", Date.now()+3600); window.setTimeout(()=>stopLoop("audio-preview"),3600); }); }}>Novo pedido</Button>
          <Button type="button" variant="outline" size="sm" disabled={!settings.soundEnabled} onClick={() => { void unlockNotificationAudio().then(() => playNotificationSound("driver_arrived")); }}>Chegada</Button>
          <Button type="button" variant="outline" size="sm" disabled={!settings.soundEnabled} onClick={() => { void unlockNotificationAudio().then(() => playNotificationSound("ride_completed")); }}>Conclusão</Button>
        </div>
        <p className="text-[11px] text-muted-foreground">O teste toca o aviso de pedido por até 3,6 segundos. Depende de volume e permissão de áudio do navegador.</p>
      </section>
      {error && (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}

export function NotificationControls({ dock = false }: { dock?: boolean } = {}) {
  const { settings, setSoundEnabled, alerts, markAllRead, connection } = useNotifications();
  const unread = alerts.filter((alert) => !alert.read).length;
  const label = settings.soundEnabled ? "Desativar som" : "Ativar som";
  return (
    <div className={dock?"flex min-w-0 flex-1 items-stretch":"flex shrink-0 items-center gap-1"}>
      {!dock&&<Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            aria-label={label}
            aria-pressed={settings.soundEnabled}
            onClick={() => setSoundEnabled(!settings.soundEnabled)}
          >
            {settings.soundEnabled ? (
              <Volume2 className="size-4" />
            ) : (
              <VolumeX className="size-4" />
            )}
          </Button>
        </TooltipTrigger>
        <TooltipContent>{label}</TooltipContent>
      </Tooltip>}
      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className={dock?"relative flex h-14 w-full flex-col items-center justify-center gap-1 rounded-xl px-1 py-1 text-[11px] font-bold text-muted-foreground hover:bg-muted":"relative"}
            aria-label={`Notificações, ${unread} não lidas`}
          >
            <Bell className={dock?"size-[22px]":"size-4"} />
            {dock&&<span className="truncate text-[10px]">Notificações</span>}
            {unread > 0 && (
              <span className="absolute right-1 top-1 size-2 rounded-full bg-destructive" />
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-80 max-w-[calc(100vw-2rem)] p-0">
          <div className="flex items-center justify-between border-b p-3">
            <div>
              <h2 className="text-sm font-semibold">Notificações</h2>
              <p className="text-xs text-muted-foreground">
                {connection === "connected"
                  ? "Conectado"
                  : connection === "connecting"
                    ? "Conectando..."
                    : "Sem conexão em tempo real"}
              </p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              title="Marcar todas como lidas"
              aria-label="Marcar todas como lidas"
              disabled={!unread}
              onClick={markAllRead}
            >
              <CheckCheck className="size-4" />
            </Button>
          </div>
          <div className="max-h-80 overflow-y-auto">
            {alerts.length ? (
              alerts.map((alert) => (
                <Link
                  key={alert.id}
                  to="/minhas-caronas"
                  className={`block border-b p-3 text-sm hover:bg-secondary ${alert.read ? "" : "bg-secondary/50"}`}
                >
                  <span className="block font-semibold">{alert.title}</span>
                  <span className="block text-xs text-muted-foreground">{alert.description}</span>
                  <time
                    className="mt-1 block text-xs text-muted-foreground"
                    dateTime={alert.createdAt}
                  >
                    {new Date(alert.createdAt).toLocaleString("pt-BR")}
                  </time>
                </Link>
              ))
            ) : (
              <p className="p-5 text-center text-sm text-muted-foreground">Nenhuma notificação.</p>
            )}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
