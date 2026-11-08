import { LiveRideMap } from "./LiveRideMap";
import { calculateRemainingWaitTime } from "@/lib/meeting-point-tolerance";
import { getStrictPickupWait, markStrictPickupNoShow, type StrictPickupWait } from "@/lib/strict-pickup-wait-service";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  Car,
  CheckCircle2,
  Flag,
  Info,
  MapPin,
  Navigation,
  RefreshCw,
  ShieldCheck,
  Smartphone,
  User,
  Volume2,
  Wifi,
  WifiOff,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  calculateDistanceKm,
  estimateEtaMinutes,
  getCurrentRidePosition,
  TRANSIT_STAGE_DESCRIPTIONS,
  TRANSIT_STAGE_LABELS,
  type RidePosition,
  type RideSafety,
  type TransitStage,
} from "@/lib/ride-safety";
import {
  revokeRideLocation,
  updateRideLocation,
  updateRideTransitStage,
} from "@/lib/ride-safety-service";

export interface RideLiveTrackerProps {
  rideId: string;
  role: "driver" | "passenger" | "available";
  viewerUserId: string;
  status: string;
  safety: RideSafety;
  pickupLabel?: string;
  destinationLabel?: string;
  onRefresh: () => Promise<void>;
}

const STAGE_ORDER: TransitStage[] = [
  "CONFIRMED",
  "DRIVER_EN_ROUTE",
  "AWAITING_BOARDING",
  "IN_PROGRESS",
  "COMPLETED",
];

export function RideLiveTracker({
  rideId,
  role,
  viewerUserId,
  status,
  safety,
  pickupLabel,
  destinationLabel,
  onRefresh,
}: RideLiveTrackerProps) {
  const [sharing, setSharing] = useState(false);
  const [isUpdatingStage, setIsUpdatingStage] = useState(false);
  const [gpsError, setGpsError] = useState<string | null>(null);
  const [lastLocalUpdate, setLastLocalUpdate] = useState<Date | null>(null);
  const [voiceEnabled, setVoiceEnabled] = useState(false);
  const [clock, setClock] = useState(Date.now());
  const [strictWait, setStrictWait] = useState<StrictPickupWait | null>(null);
  const [noShowBusy, setNoShowBusy] = useState(false);
  const lastVoiceStage = useRef<TransitStage | null>(null);
  const refreshRef = useRef(onRefresh);
  refreshRef.current = onRefresh;
  const consentKey = `caronaa:location:${viewerUserId}:${rideId}`;
  useEffect(() => {
    setSharing(sessionStorage.getItem(consentKey) === "yes");
  }, [consentKey]);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    if (status !== "CONFIRMED") { setStrictWait(null); return; }
    let active = true;
    const refreshWait = () => void getStrictPickupWait(rideId)
      .then((result) => { if (active) setStrictWait(result); })
      .catch(() => { if (active) setStrictWait(null); });
    refreshWait();
    const interval = window.setInterval(refreshWait, 10000);
    return () => { active = false; window.clearInterval(interval); };
  }, [rideId, status, safety.transitStage]);

  const currentStage: TransitStage =
    status === "IN_PROGRESS"
      ? "IN_PROGRESS"
      : status === "COMPLETED"
        ? "COMPLETED"
        : status === "CANCELLED"
          ? "CANCELLED"
          : (safety.transitStage ?? "CONFIRMED");

  const announceVoiceInstruction = useCallback(() => {
    if (!("speechSynthesis" in window)) {
      toast.error("Este navegador não oferece orientação por voz.");
      setVoiceEnabled(false);
      return;
    }
    const instruction =
      currentStage === "CONFIRMED" || currentStage === "DRIVER_EN_ROUTE"
        ? `Próxima ação: seguir para o embarque${pickupLabel ? ` em ${pickupLabel}` : " do passageiro"}. Use o aplicativo de mapas para instruções de rota.`
        : currentStage === "AWAITING_BOARDING"
          ? "Você chegou ao embarque. Valide o QR code ou o PIN antes de iniciar a viagem."
          : currentStage === "IN_PROGRESS"
            ? `Viagem em andamento. O destino deste passageiro é ${destinationLabel || "o destino combinado"}. Use o aplicativo de mapas para instruções de rota.`
            : TRANSIT_STAGE_DESCRIPTIONS[currentStage];
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(instruction);
    utterance.lang = "pt-BR";
    utterance.rate = 0.92;
    window.speechSynthesis.speak(utterance);
    lastVoiceStage.current = currentStage;
  }, [currentStage, destinationLabel, pickupLabel]);

  useEffect(() => {
    if (role === "driver" && voiceEnabled && lastVoiceStage.current !== currentStage) {
      announceVoiceInstruction();
    }
    if (["COMPLETED", "CANCELLED", "NO_SHOW"].includes(status)) {
      window.speechSynthesis?.cancel();
      setVoiceEnabled(false);
    }
  }, [announceVoiceInstruction, currentStage, role, status, voiceEnabled]);

  // Atualização periódica do relógio interno para cálculo de "Ao vivo" vs "Desatualizado"
  useEffect(() => {
    const clockTimer = window.setInterval(() => setClock(Date.now()), 10000);
    return () => window.clearInterval(clockTimer);
  }, []);

  // Coleta periódica de localização quando o compartilhamento está ativo
  useEffect(() => {
    if (!sharing || !["CONFIRMED", "IN_PROGRESS"].includes(status)) {
      if (timerRef.current) {
        window.clearInterval(timerRef.current);
        timerRef.current = null;
      }
      return;
    }

    let active = true;
    let inFlight = false;

    const pushLocation = async () => {
      if (inFlight || !active) return;
      inFlight = true;
      try {
        const position = await getCurrentRidePosition();
        if (!active) return;
        await updateRideLocation(rideId, position);
        setLastLocalUpdate(new Date());
        setGpsError(null);
        await refreshRef.current();
      } catch (err) {
        if (!active) return;
        const msg = err instanceof Error ? err.message : "Erro ao capturar GPS.";
        setGpsError(msg);
      } finally {
        inFlight = false;
      }
    };

    // Envio inicial imediato
    void pushLocation();
    // Throttle: atualizações a cada 12 segundos para economizar bateria e tráfego
    timerRef.current = window.setInterval(() => void pushLocation(), 12000);

    return () => {
      active = false;
      if (timerRef.current) {
        window.clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [sharing, status, rideId]);

  // Se a viagem for cancelada ou finalizada, desativa compartilhamento
  useEffect(() => {
    if (["COMPLETED", "CANCELLED", "NO_SHOW"].includes(status) && sharing) {
      sessionStorage.removeItem(consentKey);
      setSharing(false);
    }
  }, [status, sharing, consentKey]);

  // Alternância do consentimento explícito
  const handleToggleSharing = async (enabled: boolean) => {
    setGpsError(null);
    if (!enabled) {
      sessionStorage.removeItem(consentKey);
      setSharing(false);
      try {
        await revokeRideLocation(rideId);
        toast.info("Compartilhamento de localização pausado e dados removidos.");
        await refreshRef.current();
      } catch {
        setGpsError("Não foi possível remover a última posição. Tente novamente.");
      }
    } else {
      sessionStorage.setItem(consentKey, "yes");
      setSharing(true);
      toast.info("Autorize a localização no navegador para iniciar o compartilhamento.");
    }
  };

  // Ações do motorista para avançar etapas
  const handleAdvanceStage = async (nextStage: "DRIVER_EN_ROUTE" | "AWAITING_BOARDING") => {
    setIsUpdatingStage(true);
    try {
      await updateRideTransitStage(rideId, nextStage);
      if (nextStage === "AWAITING_BOARDING") {
        setStrictWait(await getStrictPickupWait(rideId).catch(() => null));
      }
      toast.success(`Etapa atualizada: ${TRANSIT_STAGE_LABELS[nextStage]}`);
      await refreshRef.current();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível avançar a etapa.");
    } finally {
      setIsUpdatingStage(false);
    }
  };

  const currentStageIndex = STAGE_ORDER.indexOf(currentStage);

  // Localizações recebidas
  const locations = safety.locations || [];
  const driverUserId = safety.driverUserId;
  const passengerUserId = safety.passengerUserId;

  const driverLocation = locations.find((l) => l.userId === driverUserId);
  const passengerLocation = locations.find((l) => l.userId === passengerUserId);

  // Status de atualização das posições
  const getPositionStatus = (loc?: RidePosition & { capturedAt: string }) => {
    if (!loc)
      return {
        label: "Compartilhamento pausado",
        color: "text-muted-foreground",
        state: "paused" as const,
      };
    const ageSeconds = Math.round((clock - new Date(loc.capturedAt).getTime()) / 1000);
    if (ageSeconds <= 60) {
      return { label: "Ao vivo", color: "text-emerald-500", state: "live" as const };
    }
    return { label: "Posição desatualizada", color: "text-amber-500", state: "stale" as const };
  };

  const driverStatus = getPositionStatus(driverLocation);
  const passengerStatus = getPositionStatus(passengerLocation);

  // Cálculo de distância e previsão estimada
  const route = safety.routeDetails;
  const meetingPointCoords = useMemo(
    () =>
      route?.passengerOriginLat != null && route?.passengerOriginLng != null
        ? { lat: route.passengerOriginLat, lng: route.passengerOriginLng }
        : route?.originLat != null && route?.originLng != null
          ? { lat: route.originLat, lng: route.originLng }
          : null,
    [route],
  );

  const destinationCoords = useMemo(
    () =>
      route?.passengerDestinationLat != null && route?.passengerDestinationLng != null
        ? { lat: route.passengerDestinationLat, lng: route.passengerDestinationLng }
        : route?.destinationLat != null && route?.destinationLng != null
          ? { lat: route.destinationLat, lng: route.destinationLng }
          : null,
    [route],
  );

  const metrics = useMemo(() => {
    if (!driverLocation) return null;

    // Se estiver a caminho do encontro, calcula distância do motorista até o ponto de encontro
    if (["CONFIRMED", "DRIVER_EN_ROUTE"].includes(currentStage) && meetingPointCoords) {
      const distance = calculateDistanceKm(
        driverLocation.latitude,
        driverLocation.longitude,
        meetingPointCoords.lat,
        meetingPointCoords.lng,
      );
      const eta = estimateEtaMinutes(distance);
      return {
        targetName: "Ponto de encontro",
        distanceKm: distance,
        etaMinutes: eta,
      };
    }

    // Se estiver em viagem, calcula distância até o destino
    if (currentStage === "IN_PROGRESS" && destinationCoords) {
      const distance = calculateDistanceKm(
        driverLocation.latitude,
        driverLocation.longitude,
        destinationCoords.lat,
        destinationCoords.lng,
      );
      const eta = estimateEtaMinutes(distance);
      return {
        targetName: "Destino",
        distanceKm: distance,
        etaMinutes: eta,
      };
    }

    return null;
  }, [driverLocation, currentStage, meetingPointCoords, destinationCoords]);

  // Pontos para o mapa interativo
  const activePoints = useMemo(() => {
    const pts: Array<{
      lat: number;
      lng: number;
      title: string;
      type: "driver" | "passenger" | "meeting" | "destination";
      isViewer?: boolean;
    }> = [];
    if (driverLocation) {
      pts.push({
        lat: driverLocation.latitude,
        lng: driverLocation.longitude,
        title: role === "driver" ? "Você (motorista)" : "Motorista",
        type: "driver",
        isViewer: role === "driver",
      });
    }
    if (passengerLocation) {
      pts.push({
        lat: passengerLocation.latitude,
        lng: passengerLocation.longitude,
        title: role === "passenger" ? "Você (passageiro)" : "Passageiro",
        type: "passenger",
        isViewer: role === "passenger",
      });
    }
    if (meetingPointCoords) {
      pts.push({
        lat: meetingPointCoords.lat,
        lng: meetingPointCoords.lng,
        title: "Ponto de Encontro",
        type: "meeting",
      });
    }
    if (destinationCoords) {
      pts.push({
        lat: destinationCoords.lat,
        lng: destinationCoords.lng,
        title: "Destino",
        type: "destination",
      });
    }
    return pts;
  }, [driverLocation, passengerLocation, meetingPointCoords, destinationCoords, role]);

  return (
    <div className="space-y-4 rounded-xl border border-border bg-card/60 p-4 shadow-sm">
      <div className="flex items-center justify-between border-b border-border/60 pb-3">
        <div className="flex items-center gap-2">
          <div className="flex size-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Navigation size={16} />
          </div>
          <div>
            <h4 className="text-sm font-bold text-foreground">Acompanhamento em tempo real</h4>
            <p className="text-[11px] text-muted-foreground">
              {TRANSIT_STAGE_DESCRIPTIONS[currentStage] || "Acompanhe o deslocamento ao vivo."}
            </p>
          </div>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={() => void onRefresh()}
          className="size-7 text-muted-foreground hover:text-foreground"
          title="Recarregar dados da viagem"
        >
          <RefreshCw size={13} />
        </Button>
      </div>

      {/* 1. Stepper das 5 Etapas do Acompanhamento */}
      <div className="space-y-2">
        <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
          Etapa da viagem
        </p>
        <div className="grid grid-cols-5 gap-1 text-center">
          {STAGE_ORDER.map((stage, idx) => {
            const isCompleted = currentStageIndex > idx || currentStage === "COMPLETED";
            const isCurrent = currentStageIndex === idx && currentStage !== "COMPLETED";
            return (
              <div key={stage} className="flex flex-col items-center">
                <div
                  className={`flex size-6 items-center justify-center rounded-full text-[10px] font-bold transition-colors ${
                    isCompleted
                      ? "bg-primary text-primary-foreground"
                      : isCurrent
                        ? "bg-primary/20 text-primary ring-2 ring-primary ring-offset-1"
                        : "bg-muted text-muted-foreground"
                  }`}
                >
                  {isCompleted ? <CheckCircle2 size={12} /> : idx + 1}
                </div>
                <span
                  className={`mt-1 line-clamp-2 text-[9px] font-medium leading-tight ${
                    isCurrent ? "font-bold text-foreground" : "text-muted-foreground"
                  }`}
                >
                  {TRANSIT_STAGE_LABELS[stage]}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {role === "driver" && ["CONFIRMED", "IN_PROGRESS"].includes(status) && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-card p-3">
          <p className="text-xs text-muted-foreground">
            {currentStage === "IN_PROGRESS"
              ? `Próximo destino: ${destinationLabel || "destino combinado"}`
              : `Próximo passo: embarque${pickupLabel ? ` em ${pickupLabel}` : " do passageiro"}`}
          </p>
          <Button
            type="button"
            size="sm"
            variant={voiceEnabled ? "default" : "outline"}
            onClick={() => {
              if (voiceEnabled) {
                window.speechSynthesis?.cancel();
                setVoiceEnabled(false);
              } else {
                setVoiceEnabled(true);
                announceVoiceInstruction();
              }
            }}
          >
            <Volume2 size={15} /> {voiceEnabled ? "Desativar voz" : "Ouvir próximo passo"}
          </Button>
        </div>
      )}

      {/* 2. Controles de Ação de Etapa do Motorista */}
      {role === "driver" && status === "CONFIRMED" && (
        <div className="rounded-lg border border-primary/20 bg-primary/5 p-3">
          <p className="text-xs font-semibold text-foreground">Ações do motorista:</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {currentStage === "CONFIRMED" && (
              <Button
                type="button"
                size="sm"
                disabled={isUpdatingStage}
                onClick={() => void handleAdvanceStage("DRIVER_EN_ROUTE")}
                className="gap-1.5 text-xs"
              >
                <Car size={14} />
                {isUpdatingStage ? "Atualizando..." : "Estou a caminho do ponto de encontro"}
              </Button>
            )}

            {currentStage === "DRIVER_EN_ROUTE" && (
              <Button
                type="button"
                size="sm"
                disabled={isUpdatingStage}
                onClick={() => void handleAdvanceStage("AWAITING_BOARDING")}
                className="gap-1.5 text-xs"
              >
                <Flag size={14} />
                {isUpdatingStage ? "Atualizando..." : "Cheguei ao ponto de encontro"}
              </Button>
            )}

            {currentStage === "AWAITING_BOARDING" && (
              <div className="flex items-center gap-2 text-xs text-amber-700 dark:text-amber-400">
                <ShieldCheck size={14} className="shrink-0" />
                <span>Aguardando passageiro. Valide o PIN ou QR Code para iniciar o percurso.</span>
              </div>
            )}
          </div>
        </div>
      )}

      {status === "CONFIRMED" && currentStage === "AWAITING_BOARDING" && strictWait?.strict && strictWait.arrivedAt && (() => {
        let remaining: ReturnType<typeof calculateRemainingWaitTime> | null = null;
        try { remaining = calculateRemainingWaitTime(strictWait.arrivedAt!, new Date(clock)); } catch { /* Wait for verified server state. */ }
        if (!remaining) return null;
        const display = `${String(remaining.minutes).padStart(2, "0")}:${String(remaining.seconds).padStart(2, "0")}`;
        return (
          <div role="status" className="space-y-2 rounded-xl border border-[#FFBB00]/30 bg-[#121212] p-3 text-xs text-white">
            <p className="font-semibold">Aguardando passageiro: {display}</p>
            {remaining.isExpired && role === "driver" && (
              <Button type="button" disabled={noShowBusy || !strictWait.canMarkNoShow} onClick={async () => {
                setNoShowBusy(true);
                try {
                  const latest = await getStrictPickupWait(rideId);
                  if (!latest.canMarkNoShow) throw new Error("Confirmação de ausência ainda indisponível.");
                  await markStrictPickupNoShow(rideId);
                  toast.success("Ausência registrada. Vaga liberada.");
                  await refreshRef.current();
                } catch (cause) {
                  toast.error(cause instanceof Error ? cause.message : "Não foi possível registrar a ausência.");
                } finally { setNoShowBusy(false); }
              }} className="bg-[#FFBB00] text-[#121212] hover:bg-[#FFBB00]/90">
                {noShowBusy ? "Registrando..." : "Seguir viagem (passageiro não compareceu)"}
              </Button>
            )}
          </div>
        );
      })()}

      {/* 3. Estimativa de Distância e Chegada (quando disponível) */}
      {metrics && (
        <div className="flex items-center justify-between rounded-lg border border-border/80 bg-secondary/40 p-3 text-xs">
          <div className="flex items-center gap-2">
            <Info size={16} className="text-primary" />
            <div>
              <p className="font-semibold text-foreground">
                Use o aplicativo de mapas para consultar a rota e a previsão atuais.
              </p>
              <p className="text-[10px] text-muted-foreground">
                O mapa calcula o percurso pelas vias quando o serviço estiver disponível. A previsão é aproximada.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* 4. Mapa Interativo com Marcadores e Legenda */}
      <div className="relative overflow-hidden rounded-xl border border-border bg-muted/20">
        {activePoints.length > 0 ? (
          <div className="relative w-full">
            <LiveRideMap points={activePoints} skipMeeting={currentStage === "IN_PROGRESS" || currentStage === "COMPLETED"} />
            <div className="absolute top-2 left-2 flex items-center gap-1.5 rounded-md bg-background/90 px-2 py-1 text-[10px] font-semibold text-foreground shadow-sm backdrop-blur-xs border border-border/60">
              <span
                className={`size-2 rounded-full ${driverStatus.state === "live" ? "bg-emerald-500" : "bg-amber-500"}`}
              />
              <span>
                {driverStatus.state === "live"
                  ? "GPS do motorista atualizado"
                  : driverStatus.state === "paused"
                    ? "Motorista não compartilha posição"
                    : "Última posição do motorista desatualizada"}
              </span>
            </div>
          </div>
        ) : (
          <div className="flex h-40 flex-col items-center justify-center p-4 text-center">
            <MapPin size={24} className="text-muted-foreground/50 mb-1" />
            <p className="text-xs font-semibold text-muted-foreground">
              Aguardando compartilhamento de localização
            </p>
            <p className="text-[11px] text-muted-foreground/80 max-w-xs mt-0.5">
              Ative o compartilhamento abaixo para visualizar o trajeto e os marcadores no mapa.
            </p>
          </div>
        )}

        {/* Rótulos persistentes no mapa + legenda acessível para cada papel. */}
        <div className="border-t border-border/70 bg-background/95 p-2.5">
          <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
            Legenda do percurso
          </p>
          <div className="grid grid-cols-2 gap-x-2 gap-y-2 text-[11px] sm:grid-cols-4" aria-label="Legenda de pessoas e lugares no mapa">
            <div className="flex items-center gap-1.5">
              <span className="flex size-6 shrink-0 items-center justify-center rounded-full border-2 border-[#FFBB00] bg-[#121212] text-[#FFBB00]"><Car size={12} aria-hidden /></span>
              <span className="font-semibold text-foreground">{role === "driver" ? "Você (motorista)" : "Motorista"}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-[#2563EB] text-white"><User size={12} aria-hidden /></span>
              <span className="font-semibold text-foreground">{role === "passenger" ? "Você (passageiro)" : "Passageiro"}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="flex size-6 shrink-0 items-center justify-center rounded-full border border-[#121212] bg-white text-[#121212]"><MapPin size={12} aria-hidden /></span>
              <span className="font-medium text-foreground">Ponto de Encontro</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-[#FFBB00] text-[#121212]"><Flag size={12} aria-hidden /></span>
              <span className="font-semibold text-foreground">Destino Final</span>
            </div>
          </div>
          {(role === "driver" && !driverLocation || role === "passenger" && !passengerLocation) && (
            <p role="status" className="mt-2 text-[11px] text-muted-foreground">
              Sua posição ao vivo ainda não aparece no mapa. Ative o compartilhamento abaixo para exibir o marcador “Você”.
            </p>
          )}
          {driverStatus.state === "stale" && (
            <p className="mt-1 text-[11px] text-amber-700 dark:text-amber-400">
              A posição exibida do motorista é a última transmitida, não necessariamente a posição atual.
            </p>
          )}
        </div>
      </div>

      {/* 5. Painel de Status dos Participantes */}
      <div className="grid gap-2 sm:grid-cols-2">
        {/* Card Motorista */}
        <div className="rounded-lg border border-border/70 bg-card p-2.5 text-xs space-y-1">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1.5 font-bold text-foreground">
              <Car size={13} className="text-[#FFBB00]" /> Motorista
            </span>
            <span className={`text-[10px] font-bold ${driverStatus.color}`}>
              ● {driverStatus.label}
            </span>
          </div>
          {driverLocation ? (
            <div className="text-[11px] text-muted-foreground">
              <p>Precisão: ±{Math.round(driverLocation.accuracyM)} m</p>
              <p>Último sinal: {new Date(driverLocation.capturedAt).toLocaleTimeString("pt-BR")}</p>
            </div>
          ) : (
            <p className="text-[11px] text-muted-foreground">Nenhuma posição transmitida.</p>
          )}
        </div>

        {/* Card Passageiro */}
        <div className="rounded-lg border border-border/70 bg-card p-2.5 text-xs space-y-1">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1.5 font-bold text-foreground">
              <User size={13} className="text-blue-500" /> Passageiro
            </span>
            <span className={`text-[10px] font-bold ${passengerStatus.color}`}>
              ● {passengerStatus.label}
            </span>
          </div>
          {passengerLocation ? (
            <div className="text-[11px] text-muted-foreground">
              <p>Precisão: ±{Math.round(passengerLocation.accuracyM)} m</p>
              <p>
                Último sinal: {new Date(passengerLocation.capturedAt).toLocaleTimeString("pt-BR")}
              </p>
            </div>
          ) : (
            <p className="text-[11px] text-muted-foreground">Nenhuma posição transmitida.</p>
          )}
        </div>
      </div>

      {/* 6. Controle Explícito de Compartilhamento e Privacidade */}
      {["CONFIRMED", "IN_PROGRESS"].includes(status) && (
        <div className="space-y-2 border-t border-border/60 pt-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <label
                htmlFor={`live-toggle-${rideId}`}
                className="text-xs font-bold text-foreground cursor-pointer flex items-center gap-1.5"
              >
                <MapPin size={14} className="text-primary" />
                Compartilhar minha localização nesta viagem
              </label>
              <p className="text-[11px] text-muted-foreground">
                Disponível exclusivamente para os participantes confirmados desta viagem.
              </p>
            </div>
            <Switch
              id={`live-toggle-${rideId}`}
              checked={sharing}
              onCheckedChange={handleToggleSharing}
            />
          </div>

          {gpsError && (
            <div className="flex items-center gap-1.5 text-xs text-destructive rounded-md bg-destructive/10 p-2">
              <AlertTriangle size={14} className="shrink-0" />
              <span>{gpsError}</span>
            </div>
          )}

          {/* Aviso Obrigatório sobre Navegadores em Celular */}
          <div className="flex items-start gap-2 rounded-lg border border-amber-500/20 bg-amber-500/5 p-2.5 text-[11px] text-muted-foreground">
            <Smartphone size={15} className="text-amber-500 shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold text-foreground">
                Aviso sobre dispositivos móveis:{" "}
              </span>
              Navegadores em celulares suspendem a localização quando a tela é bloqueada ou em
              segundo plano. Mantenha o navegador aberto para transmissão contínua.
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
