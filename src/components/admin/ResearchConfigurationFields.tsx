import { useState } from "react";
import { CORPORATE_INTERNAL_KEY } from "@/lib/formulario/corporate-internal";
import { COMPANY_CAMPUS_DRIVER_KEY } from "@/lib/formulario/company-campus-driver";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  SUGGESTED_RESEARCH_TIMES,
  SERVICE_STATES,
  type ResearchConfiguration,
} from "@/lib/formulario/research-configuration";

const dayLabels = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];
const inputClass = "mt-1 min-h-11 w-full rounded-lg border bg-background px-3 py-2 text-sm";
export function ResearchConfigurationFields({
  value,
  onChange,
  creationMode = false,
}: {
  value: ResearchConfiguration;
  onChange: (next: ResearchConfiguration) => void;
  creationMode?: boolean;
}) {
  const [tab, setTab] = useState("institution");
  const set = <K extends keyof ResearchConfiguration>(key: K, next: ResearchConfiguration[K]) =>
    onChange({ ...value, [key]: next });
  const text = (key: keyof ResearchConfiguration, label: string, type = "text") => (
    <label className="block min-w-0 text-sm" key={key}>
      {label}
      <input
        type={type}
        className={inputClass}
        value={String(value[key] ?? "")}
        onChange={(event) => set(key, event.target.value)}
      />
    </label>
  );
  const times = (key: "outboundTimes" | "returnTimes", label: string) => (
    <fieldset className="space-y-2">
      <legend className="mb-2 text-sm font-medium">{label}</legend>
      <div className="flex flex-wrap gap-2">
        {[...new Set([...SUGGESTED_RESEARCH_TIMES, ...value[key]])].sort().map((time) => (
          <label
            key={time}
            className="flex min-h-11 items-center gap-2 rounded-lg border px-3 text-sm"
          >
            <input
              type="checkbox"
              checked={value[key].includes(time)}
              onChange={(event) =>
                set(
                  key,
                  event.target.checked
                    ? [...value[key], time].sort()
                    : value[key].filter((item) => item !== time),
                )
              }
            />
            {time}
          </label>
        ))}
      </div>
      <label className="block text-sm">
        Adicionar horário
        <input
          type="time"
          className={inputClass}
          value=""
          onChange={(event) => {
            if (event.target.value)
              set(key, [...new Set([...value[key], event.target.value])].sort());
          }}
        />
      </label>
    </fieldset>
  );
  return (
    <section aria-label="Configuração institucional" className="min-w-0 space-y-4 border-y py-4">
      {value.templateKey===CORPORATE_INTERNAL_KEY && (
        <p className="rounded-xl border border-primary/30 bg-primary/5 p-3 text-sm">
          Uso exclusivo de colaboradores com conta verificada. Preencha somente o endereço da unidade e os horários de turnos; não informe endereços residenciais. O acesso não é liberado por domínio de e-mail ou selo de pesquisa.
        </p>
      )}
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="flex h-auto max-w-full justify-start overflow-x-auto">
          <TabsTrigger value="institution">Instituição</TabsTrigger>
          <TabsTrigger value="schedule">Dias e horários</TabsTrigger>
          <TabsTrigger value="service">Serviço e política</TabsTrigger>
        </TabsList>
        <TabsContent value="institution" className="grid gap-3 pt-3 sm:grid-cols-2">
          <label className="flex min-h-12 items-start gap-3 rounded-xl border border-primary/20 bg-primary/5 p-3 text-sm sm:col-span-2">
            <input type="checkbox" className="mt-1" checked={value.emailCaptureEnabled}
              onChange={(event)=>set("emailCaptureEnabled",event.target.checked)}/>
            <span><strong>Captura de e-mail e inteligência de leads</strong>
              <span className="mt-1 block text-xs leading-5 text-muted-foreground">
                Solicita e-mail e autorização específica antes da conclusão. Não adiciona automaticamente participantes a campanhas. Ative somente após instalar a migration 0103 e revisar o aviso de privacidade.
              </span>
            </span>
          </label>

          {!creationMode && text("institutionId", "Identificador institucional")}
          {text("institutionName", value.templateKey===CORPORATE_INTERNAL_KEY ? "Nome da empresa" : "Instituição, empresa ou evento")}
          {!creationMode && text("publicName", "Nome público da pesquisa")}
          {text("campus", value.templateKey===CORPORATE_INTERNAL_KEY ? "Unidade ou filial" : value.templateKey===COMPANY_CAMPUS_DRIVER_KEY ? "Unidade da empresa" : "Campus ou unidade")}
          {value.templateKey===COMPANY_CAMPUS_DRIVER_KEY && text("nearbyUniversity", "Universidade ou instituto próximo")}
          {text("region", "Município ou região")}
          {text("address", "Endereço institucional")}
          <details className="sm:col-span-2 rounded-xl border border-border/70 bg-muted/20 p-3">
            <summary className="cursor-pointer text-sm font-semibold">Mais opções (opcional)</summary>
            <p className="mt-2 text-xs text-muted-foreground">O código e o título já são herdados da etapa anterior. Configure apenas dados adicionais, se necessário.</p>
            <div className="mt-3 grid min-w-0 gap-3 sm:grid-cols-2">
          {(["latitude", "longitude"] as const).map((key) => (
            <label className="text-sm" key={key}>
              {key === "latitude"
                ? "Latitude institucional (opcional)"
                : "Longitude institucional (opcional)"}
              <input
                type="number"
                step="any"
                min={key === "latitude" ? -90 : -180}
                max={key === "latitude" ? 90 : 180}
                value={value[key] ?? ""}
                onChange={(event) =>
                  set(key, event.target.value === "" ? null : Number(event.target.value))
                }
                className={inputClass}
              />
            </label>
          ))}
          {text("campaignName", "Campanha")}
          {text("acquisitionSource", "Origem informada da campanha")}
          {!creationMode && <label className="text-sm">
            Tipo de campanha
            <select
              value={value.campaignType}
              onChange={(event) =>
                set("campaignType", event.target.value as ResearchConfiguration["campaignType"])
              }
              className={inputClass}
            >
              {["INSTITUCIONAL", "EVENTO", "ORGANICO", "OUTRO"].map((type) => (
                <option key={type} value={type}>
                  {
                    {
                      INSTITUCIONAL: "Institucional",
                      EVENTO: "Evento",
                      ORGANICO: "Orgânico",
                      OUTRO: "Outro",
                    }[type]
                  }
                </option>
              ))}
            </select>
          </label>}

            </div>
          </details>
          {!creationMode && <p className="text-xs text-muted-foreground sm:col-span-2">
            A identidade visual autorizada pode ser adicionada na configuração do formulário.
          </p>}
        </TabsContent>
        <TabsContent value="schedule" className="space-y-5 pt-3">
          <details className="space-y-3 border-b pb-3">
            <summary className="cursor-pointer text-sm font-medium">
              Horários específicos por perfil
            </summary>
            {value.profiles.map((profile) => {
              const current = value.profileSchedules?.find(
                (schedule) => schedule.profile === profile,
              );
              const update = (patch: Partial<NonNullable<typeof current>>) =>
                set(
                  "profileSchedules",
                  value.profileSchedules.map((schedule) =>
                    schedule.profile === profile ? { ...schedule, ...patch } : schedule,
                  ),
                );
              return (
                <div key={profile} className="space-y-3 border-t py-3">
                  <label className="flex min-h-11 items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={Boolean(current)}
                      onChange={(event) =>
                        set(
                          "profileSchedules",
                          event.target.checked
                            ? [
                                ...value.profileSchedules,
                                {
                                  profile,
                                  days: [...value.days],
                                  outboundTimes: [...value.outboundTimes],
                                  returnTimes: [...value.returnTimes],
                                  flexibilityMinutes: value.flexibilityMinutes,
                                },
                              ]
                            : value.profileSchedules.filter(
                                (schedule) => schedule.profile !== profile,
                              ),
                        )
                      }
                    />
                    {{ PASSAGEIRO: "Passageiro", MOTORISTA: "Motorista", AMBOS: "Ambos" }[profile]}:
                    horários próprios
                  </label>
                  {current && (
                    <>
                      <fieldset>
                        <legend className="text-sm">Dias</legend>
                        <div className="flex flex-wrap gap-2">
                          {dayLabels.map((label, index) => (
                            <label key={label} className="flex min-h-11 items-center gap-2 text-sm">
                              <input
                                type="checkbox"
                                checked={current.days.includes(index + 1)}
                                onChange={(event) =>
                                  update({
                                    days: event.target.checked
                                      ? [...current.days, index + 1]
                                      : current.days.filter((day) => day !== index + 1),
                                  })
                                }
                              />
                              {label}
                            </label>
                          ))}
                        </div>
                      </fieldset>
                      {(["outboundTimes", "returnTimes"] as const).map((key) => (
                        <fieldset key={key}>
                          <legend className="text-sm">
                            {key === "outboundTimes" ? "Saída" : "Retorno"}
                          </legend>
                          <div className="flex flex-wrap gap-2">
                            {[...new Set([...SUGGESTED_RESEARCH_TIMES, ...current[key]])]
                              .sort()
                              .map((time) => (
                                <label
                                  key={time}
                                  className="flex min-h-11 items-center gap-2 text-sm"
                                >
                                  <input
                                    type="checkbox"
                                    checked={current[key].includes(time)}
                                    onChange={(event) =>
                                      update({
                                        [key]: event.target.checked
                                          ? [...current[key], time].sort()
                                          : current[key].filter((item) => item !== time),
                                      })
                                    }
                                  />
                                  {time}
                                </label>
                              ))}
                          </div>
                          <label className="text-sm">
                            Adicionar horário
                            <input
                              className={inputClass}
                              type="time"
                              value=""
                              onChange={(event) => {
                                if (event.target.value)
                                  update({
                                    [key]: [
                                      ...new Set([...current[key], event.target.value]),
                                    ].sort(),
                                  });
                              }}
                            />
                          </label>
                        </fieldset>
                      ))}
                      <label className="text-sm">
                        Flexibilidade máxima (minutos)
                        <input
                          type="number"
                          min={0}
                          max={120}
                          className={inputClass}
                          value={current.flexibilityMinutes}
                          onChange={(event) =>
                            update({ flexibilityMinutes: Number(event.target.value) })
                          }
                        />
                      </label>
                    </>
                  )}
                </div>
              );
            })}
          </details>
          <fieldset>
            <legend className="mb-2 text-sm font-medium">Dias disponíveis</legend>
            <div className="flex flex-wrap gap-2">
              {dayLabels.map((label, index) => (
                <label
                  key={label}
                  className="flex min-h-11 items-center gap-2 rounded-lg border px-3 text-sm"
                >
                  <input
                    type="checkbox"
                    checked={value.days.includes(index + 1)}
                    onChange={(event) =>
                      set(
                        "days",
                        event.target.checked
                          ? [...value.days, index + 1].sort()
                          : value.days.filter((day) => day !== index + 1),
                      )
                    }
                  />
                  {label}
                </label>
              ))}
            </div>
          </fieldset>
          <p className="text-xs text-muted-foreground">
            Os horários iniciais são sugestões. Confira a rotina local antes de publicar.
          </p>
          {times("outboundTimes", "Horários de saída")}
          {times("returnTimes", "Horários de retorno")}
          <label className="block text-sm">
            Flexibilidade máxima, em minutos
            <input
              type="number"
              min={0}
              max={120}
              value={value.flexibilityMinutes}
              onChange={(event) => set("flexibilityMinutes", Number(event.target.value))}
              className={inputClass}
            />
          </label>
          <label className="block text-sm">
            Pontos seguros de embarque (um por linha)
            <textarea
              rows={3}
              value={value.safeMeetingPoints.join("\n")}
              onChange={(event) => set("safeMeetingPoints", event.target.value.split("\n"))}
              className={inputClass}
            />
          </label>
        </TabsContent>
        <TabsContent value="service" className="grid gap-3 pt-3 sm:grid-cols-2">
          <label className="text-sm">
            Data de início
            <input
              type="date"
              value={value.launchDate ?? ""}
              onChange={(event) => set("launchDate", event.target.value || null)}
              className={inputClass}
            />
          </label>
          {text("timezone", "Fuso horário")}
          <label className="text-sm">
            Situação do serviço
            <select
              value={value.serviceState}
              onChange={(event) =>
                set("serviceState", event.target.value as ResearchConfiguration["serviceState"])
              }
              className={inputClass}
            >
              {SERVICE_STATES.map((state) => (
                <option key={state} value={state}>
                  {
                    {
                      PLANEJADO: "Planejado",
                      CONFIRMADO: "Confirmado",
                      EM_OPERACAO: "Em operação",
                      ADIADO: "Adiado",
                    }[state]
                  }
                </option>
              ))}
            </select>
          </label>
          {text("priceReference", "Referência real de preço ou cotação (opcional)")}
          <label className="text-sm">
            Público autorizado no serviço pretendido
            <select
              className={inputClass}
              value={value.accessPolicy}
              onChange={(event) =>
                set("accessPolicy", event.target.value as ResearchConfiguration["accessPolicy"])
              }
            >
              <option value="PESQUISA_PUBLICA">Público geral</option>
              <option value="MEMBROS_DA_INSTITUICAO">Membros da instituição</option>
              <option value="COLABORADORES_DA_EMPRESA">Somente colaboradores da empresa</option>
            </select>
          </label>
          <label className="text-sm">
            Referência por trecho (R$, opcional)
            <input
              type="number"
              min={0}
              max={10000}
              step="0.01"
              className={inputClass}
              value={value.pricing.referencePerTrip ?? ""}
              onChange={(event) =>
                set("pricing", {
                  ...value.pricing,
                  referencePerTrip: event.target.value === "" ? null : Number(event.target.value),
                })
              }
            />
          </label>
          <label className="text-sm">
            Origem da referência de preço
            <input
              className={inputClass}
              value={value.pricing.referenceSource}
              onChange={(event) =>
                set("pricing", { ...value.pricing, referenceSource: event.target.value })
              }
            />
          </label>
          <fieldset>
            <legend className="mb-2 text-sm font-medium">Público-alvo</legend>
            {(["PASSAGEIRO", "MOTORISTA", "AMBOS"] as const).map((profile) => (
              <label key={profile} className="flex min-h-11 items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={value.profiles.includes(profile)}
                  onChange={(event) =>
                    set(
                      "profiles",
                      event.target.checked
                        ? [...value.profiles, profile]
                        : value.profiles.filter((item) => item !== profile),
                    )
                  }
                />
                {{ PASSAGEIRO: "Passageiro", MOTORISTA: "Motorista", AMBOS: "Ambos" }[profile]}
              </label>
            ))}
          </fieldset>
          <fieldset>
            <legend className="mb-2 text-sm font-medium">Modalidades pesquisadas</legend>
            {(["CARONA", "TRANSPORTE_PROFISSIONAL_INTERESSE"] as const).map((mode) => (
              <label key={mode} className="flex min-h-11 items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={value.modes.includes(mode)}
                  onChange={(event) =>
                    set(
                      "modes",
                      event.target.checked
                        ? [...value.modes, mode]
                        : value.modes.filter((item) => item !== mode),
                    )
                  }
                />
                {mode === "CARONA"
                  ? "Carona compartilhada"
                  : "Interesse em transporte profissional"}
              </label>
            ))}
          </fieldset>
          <label className="text-sm sm:col-span-2">
            Política de uso
            <textarea
              rows={3}
              value={value.usagePolicy}
              onChange={(event) => set("usagePolicy", event.target.value)}
              className={inputClass}
            />
          </label>
          {text("institutionalContact", "Contato institucional (restrito à administração)")}
          <label className="flex min-h-11 items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={value.partnershipConfirmed}
              onChange={(event) => set("partnershipConfirmed", event.target.checked)}
            />
            Parceria efetivamente confirmada
          </label>
          <label className="text-sm sm:col-span-2">
            Descrição pública da parceria
            <textarea
              rows={2}
              value={value.partnershipDescription}
              onChange={(event) => set("partnershipDescription", event.target.value)}
              className={inputClass}
            />
          </label>
        </TabsContent>
      </Tabs>
    </section>
  );
}
