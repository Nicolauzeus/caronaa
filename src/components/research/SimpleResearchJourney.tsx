import { useId } from "react";
import { LocationAutocomplete } from "@/components/formulario/LocationAutocomplete";
import { ResearchOriginLocationActions } from "./ResearchOriginLocationActions";
import type { ResearchJourney, PublicResearchConfiguration } from "@/lib/formulario/research-configuration";

type Props = {
  config: PublicResearchConfiguration["settings"];
  value: ResearchJourney;
  onChange: (value: ResearchJourney) => void;
};
const inputClass = "mt-1 min-h-11 w-full min-w-0 rounded-xl border border-border bg-background px-3 text-base";

/** Only for new F01 schemas; use the existing journey contract and RPC. */
export function SimpleResearchJourney({ config, value: journey, onChange }: Props) {
  const id = useId();
  const set = <K extends keyof ResearchJourney>(field: K, value: ResearchJourney[K]) =>
    onChange({ ...journey, [field]: value });
  const dayNames = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];
  const changeTime = (field: "outboundTime" | "returnTime", time: string) => {
    const other = field === "outboundTime" ? "otherOutboundTime" : "otherReturnTime";
    const suggested = field === "outboundTime" ? config.outboundTimes : config.returnTimes;
    onChange({ ...journey, [field]: time, [other]: !suggested.includes(time) });
  };
  return (
    <section aria-label="Trajeto habitual" className="space-y-3 rounded-xl border border-border bg-background p-3">
      <div>
        <h3 className="text-sm font-bold">Seu trajeto habitual</h3>
        <p className="text-xs leading-5 text-muted-foreground">
          Informe bairros ou localidades. Não é necessário compartilhar o endereço da sua casa.
        </p>
      </div>
      <ResearchOriginLocationActions currentArea={journey.originArea}
        onChooseArea={(area) => onChange({
          ...journey, originArea: area, originLat: null, originLng: null,
        })}
        onSearch={() => document.getElementById(id + "origin")?.focus()}
      />
      <div className="grid min-w-0 gap-3 sm:grid-cols-2">
        <div className="min-w-0">
          <LocationAutocomplete id={id + "origin"} variant="simple" required
            label="De onde costuma sair?" placeholder="Bairro ou cidade"
            value={journey.originArea}
            onChange={(text, details) => onChange({
              ...journey, originArea: details?.neighborhood || details?.city || text,
              originLat: null, originLng: null,
            })}
            helperText="Escolha uma sugestão ou digite sua região." />
        </div>
        <div className="min-w-0">
          <LocationAutocomplete id={id + "destination"} variant="simple" required
            label="Para onde costuma ir?" placeholder="Universidade, empresa ou bairro"
            value={journey.destinationArea}
            onChange={(text, details) => onChange({
              ...journey, destinationArea: details?.neighborhood || details?.city || text,
              destinationLat: null, destinationLng: null,
            })} />
        </div>
      </div>
      <fieldset className="space-y-2">
        <legend className="text-sm font-semibold">Dias em que faz esse trajeto *</legend>
        <div className="grid grid-cols-7 gap-1 sm:gap-2">
          {config.days.map(day=>(
            <label key={day} className={"flex min-h-11 min-w-0 cursor-pointer items-center justify-center rounded-lg border text-xs " +
              (journey.days.includes(day) ? "border-primary bg-primary/10 font-bold" : "border-border")}>
              <input type="checkbox" className="sr-only" checked={journey.days.includes(day)}
                onChange={event=>set("days",event.target.checked
                  ? [...journey.days,day].sort((a,b)=>a-b)
                  : journey.days.filter(value=>value!==day))}/>
              {dayNames[day-1]}
            </label>
          ))}
        </div>
      </fieldset>
      <div className="grid gap-3 sm:grid-cols-2">
        <label htmlFor={id + "direction"} className="text-sm font-medium">
          Sentido
          <select id={id + "direction"} value={journey.direction} className={inputClass}
            onChange={event=>{
              const direction=event.target.value as ResearchJourney["direction"];
              onChange({...journey,direction,returnTime:direction==="IDA_E_VOLTA"?journey.returnTime:""});
            }}>
            <option value="IDA">Ida</option>
            <option value="VOLTA">Volta</option>
            <option value="IDA_E_VOLTA">Ida e volta</option>
          </select>
        </label>
        <label htmlFor={id + "time"} className="text-sm font-medium">
          Horário de saída *
          <input id={id + "time"} type="time" required className={inputClass}
            value={journey.outboundTime} onChange={event=>changeTime("outboundTime",event.target.value)}/>
        </label>
        {journey.direction==="IDA_E_VOLTA"&&(
          <label htmlFor={id + "return"} className="text-sm font-medium sm:col-span-2">
            Horário de retorno *
            <input id={id + "return"} type="time" required className={inputClass}
              value={journey.returnTime} onChange={event=>changeTime("returnTime",event.target.value)}/>
          </label>
        )}
      </div>
      <p className="text-xs leading-5 text-muted-foreground">
        Esses dados representam sua rotina declarada para pesquisa; não publicam nenhuma carona automaticamente.
      </p>
    </section>
  );
}
