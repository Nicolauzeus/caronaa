import { useState } from "react";
import { registerResearchInterest } from "@/lib/formulario/research-configuration-service";
import {
  effectiveResearchSchedule,
  validateJourney,
  type ResearchJourney,
  type PublicResearchConfiguration,
} from "@/lib/formulario/research-configuration";
import { ResearchJourneyFields } from "./ResearchJourneyFields";

export function ResearchInterestActivation({
  formId,
  receipt,
  journey,
  configuration,
}: {
  formId: string;
  receipt: string;
  journey: ResearchJourney;
  configuration?: PublicResearchConfiguration["settings"];
}) {
  const [consents, setConsents] = useState<Record<string, boolean>>({}),
    [statuses, setStatuses] = useState<Record<string, string>>({}),
    [busy, setBusy] = useState(""),
    [error, setError] = useState("");
  const [roleJourneys, setRoleJourneys] = useState<Record<string, ResearchJourney>>(() => ({
    PASSAGEIRO: { ...journey, profile: "PASSAGEIRO" },
    MOTORISTA: { ...journey, profile: "MOTORISTA" },
  }));
  if (journey.mode !== "CARONA")
    return (
      <p className="text-sm text-muted-foreground">
        Interesse em transporte profissional registrado na pesquisa. Uma contratação depende de
        aprovação e habilitação do serviço local.
      </p>
    );
  const roles: ("PASSAGEIRO" | "MOTORISTA")[] =
    journey.profile === "AMBOS" ? ["PASSAGEIRO", "MOTORISTA"] : [journey.profile];
  return (
    <section aria-label="Interesse no trajeto" className="space-y-4 border-y py-4">
      <h2 className="text-lg font-bold">Seu próximo passo</h2>
      {roles.map((role) => (
        <div key={role} className="space-y-3">
          {configuration && !statuses[role] && (
            <details className="space-y-3 border-b pb-3">
              <summary className="cursor-pointer text-sm font-medium">
                {role === "PASSAGEIRO"
                  ? "Ajustar trajeto como passageiro"
                  : "Ajustar disponibilidade como motorista"}
              </summary>
              <ResearchJourneyFields
                config={{
                  ...effectiveResearchSchedule(configuration, journey.profile),
                  profiles: [role],
                  modes: ["CARONA"],
                }}
                value={roleJourneys[role]}
                onChange={(value) =>
                  setRoleJourneys((previous) => ({ ...previous, [role]: value }))
                }
                showConsents={false}
              />
            </details>
          )}
          <label className="flex items-start gap-2 text-sm">
            <input
              className="mt-1"
              type="checkbox"
              checked={Boolean(consents[role])}
              disabled={Boolean(statuses[role])}
              onChange={(event) =>
                setConsents((previous) => ({ ...previous, [role]: event.target.checked }))
              }
            />
            {role === "PASSAGEIRO"
              ? "Autorizo registrar meu interesse em encontrar carona neste trajeto."
              : "Autorizo registrar minha disponibilidade para oferecer lugares neste trajeto."}
          </label>
          {statuses[role] ? (
            <p role="status" className="text-sm font-semibold">
              {role === "PASSAGEIRO" ? "Interesse registrado" : "Disponibilidade registrada"}
            </p>
          ) : (
            <button
              type="button"
              className="min-h-11 w-full rounded-lg bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground disabled:opacity-50"
              disabled={!consents[role] || Boolean(busy)}
              onClick={async () => {
                setBusy(role);
                setError("");
                try {
                  const planned = configuration
                    ? validateJourney(roleJourneys[role], {
                        ...effectiveResearchSchedule(configuration, journey.profile),
                        profiles: [role],
                        modes: ["CARONA"],
                      })
                    : undefined;
                  const status = await registerResearchInterest(
                    formId,
                    receipt,
                    role,
                    consents[role],
                    planned,
                  );
                  setStatuses((previous) => ({ ...previous, [role]: status }));
                } catch (reason) {
                  setError(
                    reason instanceof Error ? reason.message : "Não foi possível registrar agora.",
                  );
                } finally {
                  setBusy("");
                }
              }}
            >
              {busy === role
                ? "Registrando…"
                : role === "PASSAGEIRO"
                  ? "Quero encontrar uma carona para este trajeto"
                  : "Quero disponibilizar lugares neste trajeto"}
            </button>
          )}
        </div>
      ))}
      <p className="text-xs text-muted-foreground">
        Este registro não cria reserva, oferta pública, cobrança ou garantia de atendimento. Para
        publicar uma carona, entre no CARONAA e confirme os dados, a rota e o preço no fluxo normal.
      </p>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </section>
  );
}
