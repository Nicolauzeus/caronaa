import { Bell, CheckCheck, Volume2, VolumeX } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useNotifications } from "@/lib/notification-context";

export function NotificationPreferences() {
  const { settings, setSoundEnabled } = useNotifications();
  return (
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
  );
}

export function NotificationControls() {
  const { settings, setSoundEnabled, alerts, markAllRead, connection } = useNotifications();
  const unread = alerts.filter((alert) => !alert.read).length;
  const label = settings.soundEnabled ? "Desativar som" : "Ativar som";
  return (
    <div className="flex shrink-0 items-center gap-1">
      <Tooltip>
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
      </Tooltip>
      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="relative"
            aria-label={`Notificações, ${unread} não lidas`}
          >
            <Bell className="size-4" />
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
