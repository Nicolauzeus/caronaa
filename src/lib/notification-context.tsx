import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./auth-context";
import {
  DEFAULT_NOTIFICATION_SETTINGS,
  NOTIFICATION_CONFIG_KEY,
  readNotificationSettings,
  type NotificationSettings,
} from "./notification-settings";
import { playNotificationSound, unlockNotificationAudio } from "./notification-sound";
import {
  createRideAlert,
  readRideAlerts,
  REALTIME_SCOPES,
  RIDES_UPDATED_EVENT,
  type RideAlert,
} from "./notification-events";

type NotificationContextValue = {
  settings: NotificationSettings;
  setSoundEnabled: (enabled: boolean) => void;
  alerts: RideAlert[];
  markAllRead: () => void;
  connection: "connecting" | "connected" | "offline";
};
const NotificationContext = createContext<NotificationContextValue | null>(null);

export function NotificationProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const userId = user?.id;
  const [settings, setSettings] = useState(DEFAULT_NOTIFICATION_SETTINGS);
  const [inbox, setInbox] = useState<{ userId: string; alerts: RideAlert[] }>({
    userId: "",
    alerts: [],
  });
  const [connection, setConnection] = useState<NotificationContextValue["connection"]>("offline");
  const seen = useRef(new Set<string>());
  const alerts = inbox.userId === userId ? inbox.alerts : [];

  useEffect(() => {
    setSettings(readNotificationSettings());
    const onStorage = (event: StorageEvent) => {
      if (event.key === NOTIFICATION_CONFIG_KEY || event.key === null)
        setSettings(readNotificationSettings());
      if (userId && (event.key === `caronaa-alerts:${userId}` || event.key === null)) {
        const loaded = readRideAlerts(userId);
        loaded.forEach((alert) => seen.current.add(alert.id));
        setInbox({ userId, alerts: loaded });
      }
    };
    const unlock = () => {
      void unlockNotificationAudio();
    };
    window.addEventListener("storage", onStorage);
    window.addEventListener("pointerdown", unlock);
    window.addEventListener("keydown", unlock);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
    };
  }, [userId]);

  useEffect(() => {
    if (!userId) {
      seen.current.clear();
      setConnection("offline");
      setInbox({ userId: "", alerts: [] });
      return;
    }
    const saved = readRideAlerts(userId);
    seen.current = new Set(saved.map((alert) => alert.id));
    setInbox({ userId, alerts: saved });
    setConnection("connecting");
    let active = true;
    let refreshTimer: ReturnType<typeof setTimeout> | undefined;
    const channel = supabase.channel(`caronaa-gateway:${userId}`);
    for (const [table, column] of REALTIME_SCOPES) {
      for (const event of ["INSERT", "UPDATE"] as const) {
        channel.on(
          "postgres_changes",
          { event, schema: "public", table, filter: `${column}=eq.${userId}` },
          (payload) => {
            if (!active) return;
            if (!refreshTimer)
              refreshTimer = setTimeout(() => {
                refreshTimer = undefined;
                window.dispatchEvent(new Event(RIDES_UPDATED_EVENT));
                void queryClient.invalidateQueries();
              }, 150);
            const alert = createRideAlert(
              table,
              payload.eventType,
              payload.new,
              payload.old,
              userId,
            );
            if (!alert || seen.current.has(alert.id)) return;
            seen.current.add(alert.id);
            if (seen.current.size > 500) seen.current.delete(seen.current.values().next().value!);
            setInbox((current) => {
              const next = [alert, ...(current.userId === userId ? current.alerts : [])].slice(
                0,
                50,
              );
              try {
                localStorage.setItem(`caronaa-alerts:${userId}`, JSON.stringify(next));
              } catch {
                /* Storage unavailable: keep the in-memory inbox. */
              }
              return { userId, alerts: next };
            });
            toast(alert.title, {
              id: alert.id,
              description: alert.description,
              action: {
                label: "Ver caronas",
                onClick: () => {
                  if (alert.notificationId) {
                    void supabase
                      .rpc("mark_ride_notification_read", {
                        p_notification_id: alert.notificationId,
                      })
                      .then(({ error }) => {
                        if (error) toast.error("Não foi possível marcar o aviso como lido.");
                      });
                  }
                  const destination = alert.rideId
                    ? `/minhas-caronas#ride-${alert.rideId}`
                    : "/minhas-caronas";
                  window.location.assign(destination);
                },
              },
            });
            void playNotificationSound(alert.sound);
          },
        );
      }
    }
    channel.subscribe((status) => {
      if (!active) return;
      setConnection(
        status === "SUBSCRIBED"
          ? "connected"
          : status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED"
            ? "offline"
            : "connecting",
      );
      if (status === "SUBSCRIBED") window.dispatchEvent(new Event(RIDES_UPDATED_EVENT));
    });
    return () => {
      active = false;
      clearTimeout(refreshTimer);
      void supabase.removeChannel(channel);
    };
  }, [userId, queryClient]);

  const setSoundEnabled = (soundEnabled: boolean) => {
    const next = { ...settings, soundEnabled };
    try {
      localStorage.setItem(NOTIFICATION_CONFIG_KEY, JSON.stringify(next));
    } catch {
      toast.error("Não foi possível salvar a preferência de som neste navegador.");
      return;
    }
    setSettings(next);
    if (soundEnabled) void unlockNotificationAudio();
  };
  const markAllRead = () => {
    if (!userId) return;
    const next = alerts.map((alert) => ({ ...alert, read: true }));
    try {
      localStorage.setItem(`caronaa-alerts:${userId}`, JSON.stringify(next));
    } catch {
      /* Keep read state for this session. */
    }
    setInbox({ userId, alerts: next });
  };
  return (
    <NotificationContext.Provider
      value={{ settings, setSoundEnabled, alerts, markAllRead, connection }}
    >
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  const context = useContext(NotificationContext);
  if (!context) throw new Error("useNotifications requires NotificationProvider");
  return context;
}
