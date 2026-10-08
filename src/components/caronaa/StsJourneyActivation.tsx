import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { ArrowRight } from "lucide-react";
import { toast } from "sonner";
import { getStsRideDraft, publishStsRide } from "@/lib/formulario/ride-activation.functions";
import {
  confirmFormAccountActivation,
  getFormAccountActivation,
} from "@/lib/formulario/account-activation";
import { publicationDetailsSchema } from "@/lib/formulario/ride-activation";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth-context";
import type { FormLocationDetails } from "@/lib/location/types";

export function StsJourneyActivation({
  onPublished,
  hasActive,
  onOriginAvailable,
}: {
  onPublished: () => void;
  hasActive: boolean;
  onOriginAvailable?: (origin: FormLocationDetails) => void;
}) {
  const { user } = useAuth();
  const getDraft = useServerFn(getStsRideDraft);
  const publish = useServerFn(publishStsRide);
  const [draft, setDraft] = useState<Awaited<ReturnType<typeof getDraft>>>(null);
  const [linkId, setLinkId] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (draft?.classification !== "expired" && draft?.details.origin && onOriginAvailable)
      onOriginAvailable({
        rawText: draft.details.origin,
        formattedAddress: draft.details.origin,
        lat: draft.details.originLat,
        lng: draft.details.originLng,
      });
  }, [
    draft?.classification,
    draft?.details.origin,
    draft?.details.originLat,
    draft?.details.originLng,
    onOriginAvailable,
  ]);

  useEffect(() => {
    let alive = true;
    void getDraft()
      .then(async (value) => {
        if (!alive) return;
        if (value?.publicationId) {
          onPublished();
          return;
        }
        setDraft(value);
        if (!value) {
          const activation = await getFormAccountActivation();
          if (alive && activation.status === "ready") {
            const id = activation.submission?.submissionId;
            if (id && user?.user_metadata.submission_id === id) {
              // Signup explicitly supplied this response; the existing RPC still verifies ownership.
              await confirmFormAccountActivation(id, {});
              const linked = await getDraft();
              if (!alive) return;
              if (linked?.publicationId) onPublished();
              else setDraft(linked);
            } else setLinkId(id ?? null);
          }
        }
      })
      .catch((reason) => {
        console.warn("[STS] Optional enrichment unavailable", reason);
        if (alive)
          setError(
            "Seu trajeto STS está indisponível agora. Você pode pedir ou oferecer uma carona normalmente.",
          );
      });
    return () => {
      alive = false;
    };
  }, [getDraft, onPublished, user?.id, user?.user_metadata.submission_id]);

  async function link() {
    if (!linkId) return;
    setBusy(true);
    try {
      await confirmFormAccountActivation(linkId, {});
      setLinkId(null);
      const value = await getDraft();
      setDraft(value);
      if (value?.publicationId) onPublished();
    } catch (reason) {
      console.warn("[STS] Account link unavailable", reason);
      setError("Não foi possível vincular o formulário agora. Tente novamente mais tarde.");
    } finally {
      setBusy(false);
    }
  }
  if (hasActive) return null;
  if (!draft && !linkId && !error) return null;
  if (draft?.classification === "expired") return null;
  const labels = {
    origin: "Saída",
    destination: "Destino",
    rideDate: "Data",
    departureTime: "Horário exato",
    count: draft?.kind === "offer" ? "Vagas" : "Passageiros",
    price: draft?.kind === "offer" ? "Valor total da viagem (R$)" : "Valor por passageiro (R$)",
  };
  return (
    <section className="border-t border-border py-5" aria-label="Trajeto do formulário STS">
      <span className="text-xs font-semibold text-muted-foreground">STS 26</span>
      <h2 className="mt-1 text-base font-bold">
        {linkId
          ? "Recupere seu trajeto do formulário"
          : draft
            ? "Seu trajeto já está preenchido"
            : "Trajeto STS"}
      </h2>
      {error && (
        <p role="alert" className="mt-2 text-sm text-destructive">
          {error}
        </p>
      )}
      {linkId ? (
        <Button variant="outline" onClick={link} disabled={busy} className="mt-3">
          {busy ? "Recuperando..." : "Vincular meu formulário"}
        </Button>
      ) : (
        draft && (
          <>
            <p className="mt-1 text-sm text-muted-foreground">
              Confirme os dados que faltam antes de publicar.
            </p>
            {!editing ? (
              <Button variant="outline" onClick={() => setEditing(true)} className="mt-3">
                Concluir publicação <ArrowRight size={16} />
              </Button>
            ) : (
              <form
                className="mt-4 grid gap-4 sm:grid-cols-2"
                onSubmit={async (event) => {
                  event.preventDefault();
                  const parsed = publicationDetailsSchema.safeParse(draft.details);
                  if (!parsed.success) {
                    setError("Confirme os campos do trajeto antes de publicar.");
                    return;
                  }
                  setBusy(true);
                  setError(null);
                  try {
                    await publish({
                      data: {
                        submissionId: draft.submissionId,
                        kind: draft.kind,
                        details: parsed.data,
                      },
                    });
                    setDraft(null);
                    onPublished();
                    toast.success("Seu trajeto STS está publicado.");
                  } catch (reason) {
                    console.warn("[STS] Publication unavailable", reason);
                    setError(
                      "Não foi possível publicar o trajeto STS. Confira os dados ou tente novamente mais tarde.",
                    );
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                <div
                  role="group"
                  aria-label="Papel do trajeto STS"
                  className="flex gap-2 sm:col-span-2"
                >
                  {(["request", "offer"] as const).map((kind) => (
                    <button
                      key={kind}
                      type="button"
                      aria-pressed={draft.kind === kind}
                      onClick={() => {
                        if (draft.kind !== kind)
                          setDraft({
                            ...draft,
                            ...draft.alternate,
                            alternate: {
                              submissionId: draft.submissionId,
                              kind: draft.kind,
                              details: draft.details,
                              missing: draft.missing,
                              classification: draft.classification,
                              departureWindow: draft.departureWindow,
                            },
                          });
                      }}
                      className={`min-h-11 flex-1 rounded-lg border px-3 text-sm font-semibold ${draft.kind === kind ? "border-primary bg-primary/10" : "border-border"}`}
                    >
                      {kind === "request" ? "Pedir carona" : "Oferecer carona"}
                    </button>
                  ))}
                </div>
                {Object.entries(labels).map(([key, label]) => (
                  <label key={key} className="text-sm font-semibold">
                    {label}
                    <input
                      required
                      type={
                        key === "rideDate"
                          ? "date"
                          : key === "departureTime"
                            ? "time"
                            : key === "count" || key === "price"
                              ? "number"
                              : "text"
                      }
                      min={
                        key === "count"
                          ? 1
                          : key === "price"
                            ? 0
                            : key === "rideDate"
                              ? "2026-10-07"
                              : undefined
                      }
                      max={
                        key === "count"
                          ? 6
                          : key === "price"
                            ? 1000
                            : key === "rideDate"
                              ? "2026-10-09"
                              : undefined
                      }
                      step={key === "price" ? "0.01" : undefined}
                      value={draft.details[key as keyof typeof draft.details] ?? ""}
                      onChange={(event) =>
                        setDraft({
                          ...draft,
                          details: {
                            ...draft.details,
                            ...(key === "origin"
                              ? { originLat: undefined, originLng: undefined }
                              : key === "destination"
                                ? { destinationLat: undefined, destinationLng: undefined }
                                : {}),
                            [key]:
                              key === "count" || key === "price"
                                ? event.target.value === ""
                                  ? undefined
                                  : Number(event.target.value)
                                : event.target.value,
                          },
                        })
                      }
                      className="mt-1 block h-12 w-full rounded-lg border border-input bg-background px-3 font-normal"
                    />
                  </label>
                ))}
                {draft.kind === "offer" && (
                  <label className="text-sm font-semibold">
                    Passageiros aceitos
                    <select
                      required
                      value={draft.details.audience ?? ""}
                      onChange={(e) =>
                        setDraft({
                          ...draft,
                          details: {
                            ...draft.details,
                            audience: e.target.value as "ANY" | "FEMININO" | "MASCULINO",
                          },
                        })
                      }
                      className="mt-1 h-12 w-full rounded-lg border border-input bg-background px-3"
                    >
                      <option value="">Selecione</option>
                      <option value="ANY">Todos os gêneros</option>
                      <option value="FEMININO">Somente mulheres</option>
                      <option value="MASCULINO">Somente homens</option>
                    </select>
                  </label>
                )}
                <Button type="submit" disabled={busy} className="min-h-12 sm:col-span-2">
                  {busy ? "Publicando..." : "Publicar trajeto STS"}
                </Button>
              </form>
            )}
          </>
        )
      )}
    </section>
  );
}
