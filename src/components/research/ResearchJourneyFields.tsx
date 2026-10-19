import { useId } from "react";
import { EVENT_EXIT_MATCH_KEY } from "@/lib/formulario/event-exit-match";
import type {
  PublicResearchConfiguration,
  ResearchJourney,
} from "@/lib/formulario/research-configuration";
import { effectiveResearchSchedule } from "@/lib/formulario/research-configuration";
import { LocationAutocomplete } from "@/components/formulario/LocationAutocomplete";
import type { FormLocationDetails } from "@/lib/location/types";

export function initialResearchJourney(
  c: PublicResearchConfiguration["settings"],
): ResearchJourney {
  c = effectiveResearchSchedule(c, c.profiles[0]);
  const isEvent=c.templateKey===EVENT_EXIT_MATCH_KEY;
  const eventDay=c.launchDate ? new Date(c.launchDate+"T12:00:00Z").getUTCDay() || 7 : null;
  return {
    profile: c.profiles[0],
    mode: c.modes[0],
    direction: isEvent ? "VOLTA" : "IDA",
    days: isEvent && eventDay && c.days.includes(eventDay) ? [eventDay] : [],
    outboundTime: c.outboundTimes[0],
    returnTime: "",
    otherOutboundTime: false,
    otherReturnTime: false,
    flexibilityMinutes: 0,
    originArea: isEvent ? c.campus || c.institutionName : "",
    originLat: isEvent ? c.latitude : null,
    originLng: isEvent ? c.longitude : null,
    destinationArea: isEvent ? "" : c.campus || c.institutionName,
    destinationLat: isEvent ? null : c.latitude,
    destinationLng: isEvent ? null : c.longitude,
    marketingConsent: false,
    partnerSharingConsent: false,
  };
}
export function ResearchJourneyFields({
  config: c,
  value: j,
  onChange,
  showConsents = true,
}: {
  config: PublicResearchConfiguration["settings"];
  value: ResearchJourney;
  onChange: (value: ResearchJourney) => void;
  showConsents?: boolean;
}) {
  const fieldId = useId();
  c = effectiveResearchSchedule(c, j.profile);
  const eventExit=c.templateKey===EVENT_EXIT_MATCH_KEY;
  const set = <K extends keyof ResearchJourney>(key: K, value: ResearchJourney[K]) =>
    onChange({ ...j, [key]: value });
  const cls = "mt-1 min-h-11 w-full rounded-lg border bg-background px-3 py-2 text-sm";
  const location = (
    prefix: "origin" | "destination",
    text: string,
    details?: FormLocationDetails,
  ) =>
    onChange({
      ...j,
      [`${prefix}Area`]: details?.neighborhood || details?.city || text,
      [`${prefix}Lat`]: details?.lat ?? null,
      [`${prefix}Lng`]: details?.lng ?? null,
    });
  const time = (
    key: "outboundTime" | "returnTime",
    label: string,
    options: string[],
    other: "otherOutboundTime" | "otherReturnTime",
  ) => (
    <div className="space-y-2">
      <label htmlFor={fieldId + key} className="block text-sm">
        {label}
      </label>
      <select
        id={fieldId + key}
        className={cls}
        value={j[other] ? "OTHER" : j[key]}
        onChange={(event) =>
          onChange({
            ...j,
            [other]: event.target.value === "OTHER",
            [key]: event.target.value === "OTHER" ? "" : event.target.value,
          })
        }
      >
        <option value="">Selecione</option>
        {options.map((time) => (
          <option key={time}>{time}</option>
        ))}
        <option value="OTHER">Outro horário</option>
      </select>
      {j[other] && (
        <label className="block text-sm">
          {label}: outro horário
          <input
            type="time"
            value={j[key]}
            onChange={(event) => set(key, event.target.value)}
            className={cls}
          />
        </label>
      )}
    </div>
  );
  return (
    <div className="space-y-4">
      <label className="block text-sm">
        Seu perfil
        <select
          className={cls}
          value={j.profile}
          onChange={(event) => set("profile", event.target.value as ResearchJourney["profile"])}
        >
          {c.profiles.map((profile) => (
            <option key={profile} value={profile}>
              {
                {
                  PASSAGEIRO: "Passageiro",
                  MOTORISTA: "Motorista",
                  AMBOS: "Passageiro e motorista",
                }[profile]
              }
            </option>
          ))}
        </select>
      </label>
      <label className="block text-sm">
        Modalidade de interesse
        <select
          className={cls}
          value={j.mode}
          onChange={(event) => set("mode", event.target.value as ResearchJourney["mode"])}
        >
          {c.modes.map((mode) => (
            <option key={mode} value={mode}>
              {mode === "CARONA" ? "Carona compartilhada" : "Transporte profissional (interesse)"}
            </option>
          ))}
        </select>
      </label>
      {eventExit ? <p className="rounded-lg bg-primary/5 p-3 text-sm font-medium">Trajeto de saída do evento: local do evento → destino</p> : <label className="block text-sm">
        Sentido do percurso
        <select
          className={cls}
          value={j.direction}
          onChange={(event) => {
            const direction = event.target.value as ResearchJourney["direction"];
            const reverse = (j.direction === "VOLTA") !== (direction === "VOLTA");
            onChange({
              ...j,
              direction,
              returnTime: direction === "IDA_E_VOLTA" ? j.returnTime : "",
              otherReturnTime: direction === "IDA_E_VOLTA" ? j.otherReturnTime : false,
              ...(reverse
                ? {
                    originArea: j.destinationArea,
                    originLat: j.destinationLat,
                    originLng: j.destinationLng,
                    destinationArea: j.originArea,
                    destinationLat: j.originLat,
                    destinationLng: j.originLng,
                  }
                : {}),
            });
          }}
        >
          <option value="IDA">Ida</option>
          <option value="VOLTA">Volta</option>
          <option value="IDA_E_VOLTA">Ida e volta</option>
        </select>
      </label>}
      {!eventExit && <fieldset>
        <legend className="mb-2 text-sm font-medium">Dias do trajeto</legend>
        <div className="flex flex-wrap gap-2">
          {c.days.map((day) => (
            <label
              key={day}
              className="flex min-h-11 items-center gap-2 rounded-lg border px-3 text-sm"
            >
              <input
                type="checkbox"
                checked={j.days.includes(day)}
                onChange={(event) =>
                  set(
                    "days",
                    event.target.checked
                      ? [...j.days, day].sort()
                      : j.days.filter((item) => item !== day),
                  )
                }
              />
              {["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"][day - 1]}
            </label>
          ))}
        </div>
      </fieldset>}
      {time(
        "outboundTime",
        "Horário de saída",
        j.direction === "VOLTA" && c.returnTimes.length ? c.returnTimes : c.outboundTimes,
        "otherOutboundTime",
      )}
      {j.direction === "IDA_E_VOLTA" &&
        time("returnTime", "Horário de retorno", c.returnTimes, "otherReturnTime")}
      <label className="block text-sm">
        Flexibilidade em minutos
        <input
          type="number"
          className={cls}
          min={0}
          max={c.flexibilityMinutes}
          value={j.flexibilityMinutes}
          onChange={(event) => set("flexibilityMinutes", Number(event.target.value))}
        />
      </label>
      <LocationAutocomplete
        id={fieldId + "-origin"}
        label={eventExit ? "Ponto de saída do evento" : "Bairro ou município de origem"}
        value={j.originArea}
        onChange={(text, details) => location("origin", text, details)}
        helperText="Informe uma região aproximada, sem endereço residencial ou número."
        variant="simple"
      />
      <LocationAutocomplete
        id={fieldId + "-destination"}
        label={eventExit ? "Bairro ou região de destino após o evento" : "Bairro, campus ou ponto de destino"}
        value={j.destinationArea}
        onChange={(text, details) => location("destination", text, details)}
        variant="simple"
      />
      {c.safeMeetingPoints.length > 0 && (
        <div>
          <p className="text-sm font-medium">Pontos de embarque informados pela organização</p>
          <ul className="mt-2 list-inside list-disc text-sm text-muted-foreground">
            {c.safeMeetingPoints.map((point) => (
              <li key={point}>{point}</li>
            ))}
          </ul>
        </div>
      )}
      <p className="text-xs text-muted-foreground">
        O trajeto indica interesse para análise. Ainda não é uma solicitação, oferta pública ou
        correspondência confirmada.
      </p>
      {showConsents && (
        <>
          <label className="flex items-start gap-2 text-sm">
            <input
              type="checkbox"
              checked={j.marketingConsent}
              onChange={(event) => set("marketingConsent", event.target.checked)}
              className="mt-1"
            />
            Autorizo contato comercial, caso tenha informado um contato nesta pesquisa (opcional).
          </label>
          <label className="flex items-start gap-2 text-sm">
            <input
              type="checkbox"
              checked={j.partnerSharingConsent}
              onChange={(event) => set("partnerSharingConsent", event.target.checked)}
              className="mt-1"
            />
            Autorizo compartilhar meus dados desta pesquisa com os parceiros informados na política
            de uso (opcional).
          </label>
        </>
      )}
    </div>
  );
}
