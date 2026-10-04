import * as React from "react";
import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/caronaa/AppShell";

import { FormIntro } from "@/components/formulario/FormIntro";
import { IntentStep } from "@/components/formulario/IntentStep";
import { RouteStep } from "@/components/formulario/RouteStep";
import { PassengerFlow } from "@/components/formulario/PassengerFlow";
import { DriverFlow } from "@/components/formulario/DriverFlow";
import { BothFlow } from "@/components/formulario/BothFlow";
import { TrustStep } from "@/components/formulario/TrustStep";
import { PriceStep } from "@/components/formulario/PriceStep";
import { CommitmentStep } from "@/components/formulario/CommitmentStep";
import { ContactStep } from "@/components/formulario/ContactStep";
import { FormSuccess } from "@/components/formulario/FormSuccess";

import type {
  CaronaaStsFormData,
  CaronaaIntent,
  CommitmentLevel,
  DepartureWindow,
  PassengerTransport,
  PriceRange,
  TrustFactor,
  VehicleType,
} from "@/lib/formulario/types";

import type { FormStep } from "@/lib/formulario/flow";

import {
  getNextStep,
  getPreviousStep,
  getProgressPercentage,
} from "@/lib/formulario/flow";

import {
  caronaaStsFormSchema,
} from "@/lib/formulario/schema";

import {
  prepareSubmission,
} from "@/lib/formulario/submission";

export const Route = createFileRoute("/formulario")({
  head: () => ({
    meta: [
      {
        title: "CARONAA no Siará Tech Summit 2026",
      },
      {
        name: "description",
        content:
          "Encontre ou ofereça uma carona na saída do Siará Tech Summit com a CARONAA.",
      },
      {
        property: "og:title",
        content: "CARONAA no Siará Tech Summit 2026",
      },
      {
        property: "og:description",
        content:
          "Encontre ou ofereça uma carona na saída do Siará Tech Summit com a CARONAA.",
      },
      {
        property: "og:type",
        content: "website",
      },
      {
        name: "twitter:card",
        content: "summary",
      },
    ],
  }),
  component: Formulario,
});

const initialData: CaronaaStsFormData = {
  source: "sts-2026",
};

function Formulario() {
  const [step, setStep] =
    React.useState<FormStep>("INTRO");

  const [data, setData] =
    React.useState<CaronaaStsFormData>(
      initialData,
    );

  const [isSubmitting, setIsSubmitting] =
    React.useState(false);

  const [submitError, setSubmitError] =
    React.useState<string | null>(null);

  const progress =
    getProgressPercentage(step, data);

  function updateData(
    patch: Partial<CaronaaStsFormData>,
  ) {
    setData((current) => ({
      ...current,
      ...patch,
    }));
  }

  function clearPassengerData() {
    setData((current) => ({
      ...current,
      passengerCount: undefined,
      currentTransport: undefined,
      passengerTrustFactors: undefined,
      passengerPriceRange: undefined,
      passengerCommitment: undefined,
    }));
  }

  function clearDriverData() {
    setData((current) => ({
      ...current,
      vehicleType: undefined,
      availableSeats: undefined,
      maxDetourMinutes: undefined,
      driverTrustFactors: undefined,
      driverPriceRange: undefined,
      driverCommitment: undefined,
    }));
  }

  function changeIntent(
    intent: CaronaaIntent,
  ) {
    if (intent === "MOTORISTA") {
      clearPassengerData();
    }

    if (intent === "PASSAGEIRO") {
      clearDriverData();
    }

    updateData({ intent });
  }

  function goNext() {
    const next = getNextStep(
      step,
      data,
    );

    if (next) {
      setStep(next);
      window.scrollTo({
        top: 0,
        behavior: "smooth",
      });
    }
  }

  function goBack() {
    const previous =
      getPreviousStep(
        step,
        data,
      );

    if (previous) {
      setStep(previous);
      window.scrollTo({
        top: 0,
        behavior: "smooth",
      });
    }
  }

  function restart() {
    setData(initialData);
    setStep("INTRO");
    setSubmitError(null);

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  }

  async function submit() {
    setSubmitError(null);

    const validation =
      caronaaStsFormSchema.safeParse(
        data,
      );

    if (!validation.success) {
      const firstIssue =
        validation.error.issues[0];

      setSubmitError(
        firstIssue?.message ??
          "Revise os dados antes de continuar.",
      );

      return;
    }

    try {
      setIsSubmitting(true);

      const payload =
        prepareSubmission(
          validation.data,
        );

      /*
       * Neste momento estamos validando toda a experiência
       * antes de conectar o submit definitivo ao banco.
       *
       * O próximo passo será persistir `payload`
       * no Supabase.
       */

      console.info(
        "CARONAA STS submission prepared",
        payload,
      );

      setData((current) => ({
        ...current,
        submissionId:
          payload.submissionId,
        createdAt:
          payload.createdAt,
      }));

      setStep("SUCCESS");
    } catch (error) {
      setSubmitError(
        error instanceof Error
          ? error.message
          : "Não foi possível finalizar agora.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <AppShell publicPage>
      <div className="min-h-[calc(100vh-72px)] bg-background">
        {step !== "INTRO" &&
        step !== "SUCCESS" ? (
          <div className="sticky top-0 z-20 border-b bg-background/95 backdrop-blur">
            <div className="mx-auto w-full max-w-2xl px-4 py-3 sm:px-6">
              <div className="flex items-center justify-between gap-4">
                <div className="space-y-1">
                  <p className="text-xs font-medium text-muted-foreground">
                    CARONAA • STS 2026
                  </p>

                  <p className="text-xs text-muted-foreground">
                    {progress}% concluído
                  </p>
                </div>

                <div className="h-2 w-32 overflow-hidden rounded-full bg-muted sm:w-48">
                  <div
                    className="h-full rounded-full bg-primary transition-all duration-300"
                    style={{
                      width: `${progress}%`,
                    }}
                  />
                </div>
              </div>
            </div>
          </div>
        ) : null}

        {submitError ? (
          <div className="mx-auto w-full max-w-2xl px-4 pt-4 sm:px-6">
            <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4">
              <p className="text-sm font-medium text-destructive">
                {submitError}
              </p>
            </div>
          </div>
        ) : null}

        {step === "INTRO" ? (
          <FormIntro
            onStart={() =>
              setStep("INTENT")
            }
          />
        ) : null}

        {step === "INTENT" ? (
          <IntentStep
            value={data.intent}
            onChange={changeIntent}
            onNext={goNext}
            onBack={() =>
              setStep("INTRO")
            }
          />
        ) : null}

        {step === "ROUTE" ? (
          <RouteStep
            destinationNeighborhood={
              data.destinationNeighborhood
            }
            destinationReference={
              data.destinationReference
            }
            departureWindow={
              data.departureWindow
            }
            onDestinationNeighborhoodChange={(
              value,
            ) =>
              updateData({
                destinationNeighborhood:
                  value,
              })
            }
            onDestinationReferenceChange={(
              value,
            ) =>
              updateData({
                destinationReference:
                  value,
              })
            }
            onDepartureWindowChange={(
              value: DepartureWindow,
            ) =>
              updateData({
                departureWindow:
                  value,
              })
            }
            onNext={goNext}
            onBack={goBack}
          />
        ) : null}

        {step ===
          "PASSENGER_CONTEXT" ? (
          <PassengerFlow
            passengerCount={
              data.passengerCount
            }
            currentTransport={
              data.currentTransport
            }
            onPassengerCountChange={(
              value,
            ) =>
              updateData({
                passengerCount:
                  value,
              })
            }
            onCurrentTransportChange={(
              value: PassengerTransport,
            ) =>
              updateData({
                currentTransport:
                  value,
              })
            }
            onNext={goNext}
            onBack={goBack}
          />
        ) : null}

        {step ===
          "DRIVER_CONTEXT" ? (
          data.intent === "AMBOS" ? (
            <BothFlow
              vehicleType={
                data.vehicleType
              }
              availableSeats={
                data.availableSeats
              }
              currentTransport={
                data.currentTransport
              }
              onVehicleTypeChange={(
                value: VehicleType,
              ) => {
                updateData({
                  vehicleType: value,
                });

                if (value === "MOTO") {
                  updateData({
                    availableSeats:
                      undefined,
                    maxDetourMinutes:
                      undefined,
                  });
                }
              }}
              onAvailableSeatsChange={(
                value,
              ) =>
                updateData({
                  availableSeats:
                    value,
                })
              }
              onCurrentTransportChange={(
                value: PassengerTransport,
              ) =>
                updateData({
                  currentTransport:
                    value,
                })
              }
              onNext={goNext}
              onBack={goBack}
            />
          ) : (
            <DriverFlow
              vehicleType={
                data.vehicleType
              }
              availableSeats={
                data.availableSeats
              }
              maxDetourMinutes={
                data.maxDetourMinutes
              }
              onVehicleTypeChange={(
                value: VehicleType,
              ) => {
                updateData({
                  vehicleType: value,
                });

                if (value === "MOTO") {
                  updateData({
                    availableSeats:
                      undefined,
                    maxDetourMinutes:
                      undefined,
                  });
                }
              }}
              onAvailableSeatsChange={(
                value,
              ) =>
                updateData({
                  availableSeats:
                    value,
                })
              }
              onMaxDetourMinutesChange={(
                value,
              ) =>
                updateData({
                  maxDetourMinutes:
                    value,
                })
              }
              onNext={goNext}
              onBack={goBack}
            />
          )
        ) : null}

        {step ===
          "PASSENGER_TRUST" ? (
          <TrustStep
            intent="PASSAGEIRO"
            value={
              data.passengerTrustFactors
            }
            onChange={(
              value: TrustFactor[],
            ) =>
              updateData({
                passengerTrustFactors:
                  value,
              })
            }
            onNext={goNext}
            onBack={goBack}
          />
        ) : null}

        {step ===
          "DRIVER_TRUST" ? (
          <TrustStep
            intent="MOTORISTA"
            value={
              data.driverTrustFactors
            }
            onChange={(
              value: TrustFactor[],
            ) =>
              updateData({
                driverTrustFactors:
                  value,
              })
            }
            onNext={goNext}
            onBack={goBack}
          />
        ) : null}

        {step ===
          "PASSENGER_PRICE" ? (
          <PriceStep
            intent="PASSAGEIRO"
            value={
              data.passengerPriceRange
            }
            onChange={(
              value: PriceRange,
            ) =>
              updateData({
                passengerPriceRange:
                  value,
              })
            }
            onNext={goNext}
            onBack={goBack}
          />
        ) : null}

        {step ===
          "DRIVER_PRICE" ? (
          <PriceStep
            intent="MOTORISTA"
            value={
              data.driverPriceRange
            }
            onChange={(
              value: PriceRange,
            ) =>
              updateData({
                driverPriceRange:
                  value,
              })
            }
            onNext={goNext}
            onBack={goBack}
          />
        ) : null}

        {step ===
          "PASSENGER_COMMITMENT" ? (
          <CommitmentStep
            intent="PASSAGEIRO"
            value={
              data.passengerCommitment
            }
            onChange={(
              value: CommitmentLevel,
            ) =>
              updateData({
                passengerCommitment:
                  value,
              })
            }
            onNext={goNext}
            onBack={goBack}
          />
        ) : null}

        {step ===
          "DRIVER_COMMITMENT" ? (
          <CommitmentStep
            intent="MOTORISTA"
            value={
              data.driverCommitment
            }
            onChange={(
              value: CommitmentLevel,
            ) =>
              updateData({
                driverCommitment:
                  value,
              })
            }
            onNext={goNext}
            onBack={goBack}
          />
        ) : null}

        {step === "CONTACT" ? (
          <ContactStep
            name={data.name}
            whatsapp={data.whatsapp}
            onNameChange={(value) =>
              updateData({
                name: value,
              })
            }
            onWhatsappChange={(
              value,
            ) =>
              updateData({
                whatsapp: value,
              })
            }
            onNext={submit}
            onBack={goBack}
          />
        ) : null}

        {isSubmitting ? (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/70 backdrop-blur-sm">
            <div className="rounded-2xl border bg-card px-6 py-5 shadow-lg">
              <p className="text-sm font-medium">
                Preparando sua participação...
              </p>

              <p className="mt-1 text-xs text-muted-foreground">
                Só um instante.
              </p>
            </div>
          </div>
        ) : null}

        {step === "SUCCESS" ? (
          <FormSuccess
            data={data}
            onRestart={restart}
          />
        ) : null}
      </div>
    </AppShell>
  );
}
