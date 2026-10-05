import * as React from "react";
import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/caronaa/AppShell";

import { FormIntro } from "@/components/formulario/FormIntro";
import { ContactStep } from "@/components/formulario/ContactStep";
import { FormSuccess } from "@/components/formulario/FormSuccess";
import {
  CurrentPriceStep,
  InterestStep,
  MainProblemStep,
  ProblemsStep,
  ProfileRouteStep,
} from "@/components/formulario/SimplifiedSteps";

import type {
  CaronaaStsFormData,
  CaronaaIntent,
  DepartureWindow,
  InterestLevel,
  PainPointCode,
  PassengerTransport,
  UserOccupation,
  WeeklyFrequency,
} from "@/lib/formulario/types";

import type { FormStep } from "@/lib/formulario/flow";

import { getNextStep, getPreviousStep, getProgressPercentage } from "@/lib/formulario/flow";

import { caronaaStsFormSchema } from "@/lib/formulario/schema";

import { prepareSubmission } from "@/lib/formulario/submission";
import { registerFormStart, saveFormSubmission } from "@/lib/formulario/form-submission-service";
import { useAuth } from "@/lib/auth-context";
import { getCampaignAttribution, trackFunnelEvent } from "@/lib/funnel-events";

export const Route = createFileRoute("/formulario")({
  head: () => ({
    meta: [
      {
        title: "CARONAA no Siará Tech Summit 2026",
      },
      {
        name: "description",
        content: "Encontre ou ofereça uma carona na saída do Siará Tech Summit com a CARONAA.",
      },
      {
        property: "og:title",
        content: "CARONAA no Siará Tech Summit 2026",
      },
      {
        property: "og:description",
        content: "Encontre ou ofereça uma carona na saída do Siará Tech Summit com a CARONAA.",
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

function Formulario() {
  const { user } = useAuth();
  const attribution = React.useMemo(() => getCampaignAttribution(), []);
  const initialData = React.useMemo<CaronaaStsFormData>(
    () => ({ source: attribution.source, campaign: attribution.campaign, campaignEvent: attribution.campaignEvent }),
    [attribution],
  );

  const [step, setStep] = React.useState<FormStep>("INTRO");

  const [data, setData] = React.useState<CaronaaStsFormData>(initialData);

  const [isSubmitting, setIsSubmitting] = React.useState(false);

  // Keeps retries and rapid repeated clicks bound to the same database idempotency key.
  const isSubmittingRef = React.useRef(false);
  const submissionAttemptIdRef = React.useRef<string | null>(null);

  const [submitError, setSubmitError] = React.useState<string | null>(null);

  const progress = getProgressPercentage(step, data);

  React.useEffect(() => {
    void trackFunnelEvent({ eventName: "landing_view", userId: user?.id ?? null, ...attribution });
  }, [attribution, user?.id]);

  function updateData(patch: Partial<CaronaaStsFormData>) {
    setData((current) => ({
      ...current,
      ...patch,
    }));
  }

  function clearPassengerData() {
    setData((current) => ({
      ...current,
      passengerCount: undefined,
      passengerTrustFactors: undefined,
      passengerPriceRange: undefined,
      passengerCommitment: undefined,
      passengerInterest: undefined,
    }));
  }

  function clearDriverData() {
    setData((current) => ({
      ...current,
      vehicleType: undefined,
      availableSeats: undefined,
      maxDetourMinutes: undefined,
      driverTrustFactors: undefined,
      driverPrice: undefined,
      caronaaFee: undefined,
      driverNetAmount: undefined,
      familyCarCompanions: undefined,
      driverInterest: undefined,
      driverCommitment: undefined,
    }));
  }

  function changeIntent(intent: CaronaaIntent) {
    if (intent === "MOTORISTA") {
      clearPassengerData();
    }

    if (intent === "PASSAGEIRO") {
      clearDriverData();
    }

    updateData({ intent });
  }

  function goNext() {
    const next = getNextStep(step, data);

    if (next) {
      void trackFunnelEvent({ eventName: "form_step_completed", userId: user?.id ?? null, ...attribution, formStep: step });
      setStep(next);
      window.scrollTo({
        top: 0,
        behavior: "smooth",
      });
    }
  }

  function goBack() {
    const previous = getPreviousStep(step, data);

    if (previous) {
      setStep(previous);
      window.scrollTo({
        top: 0,
        behavior: "smooth",
      });
    }
  }

  function restart() {
    submissionAttemptIdRef.current = null;
    isSubmittingRef.current = false;
    setData(initialData);
    setStep("INTRO");
    setSubmitError(null);

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  }

  async function submit() {
    if (isSubmittingRef.current) return;

    setSubmitError(null);

    const validation = caronaaStsFormSchema.safeParse(data);

    if (!validation.success) {
      const firstIssue = validation.error.issues[0];

      setSubmitError(firstIssue?.message ?? "Revise os dados antes de continuar.");

      return;
    }

    try {
      isSubmittingRef.current = true;
      setIsSubmitting(true);

      const payload = prepareSubmission({
        ...validation.data,
        submissionId: submissionAttemptIdRef.current ?? validation.data.submissionId,
      });
      submissionAttemptIdRef.current = payload.submissionId;

      await saveFormSubmission(payload, user?.id ?? null);

      setData((current) => ({
        ...current,
        submissionId: payload.submissionId,
        createdAt: payload.createdAt,
      }));

      void trackFunnelEvent({
        eventName: "form_completed",
        userId: user?.id ?? null,
        ...attribution,
        formStep: "CONTACT",
        submissionId: payload.submissionId,
      });

      void trackFunnelEvent({
        eventName: "lead_created",
        userId: user?.id ?? null,
        ...attribution,
        submissionId: payload.submissionId,
        metadata: {
          leadType: payload.leadType,
          activationStatus: payload.activationStatus,
        },
      });

      setStep("SUCCESS");
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "Não foi possível finalizar agora.");
    } finally {
      isSubmittingRef.current = false;
      setIsSubmitting(false);
    }
  }

  return (
    <AppShell publicPage>
      <div className="min-h-[calc(100vh-72px)] bg-background">
        {step !== "INTRO" && step !== "SUCCESS" ? (
          <div className="sticky top-0 z-20 border-b bg-background/95 backdrop-blur">
            <div className="mx-auto w-full max-w-2xl px-4 py-3 sm:px-6">
              <div className="flex items-center justify-between gap-4">
                <div className="space-y-1">
                  <p className="text-xs font-medium text-muted-foreground">CARONAA • STS 2026</p>

                  <p className="text-xs text-muted-foreground">{progress}% concluído</p>
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
              <p className="text-sm font-medium text-destructive">{submitError}</p>
            </div>
          </div>
        ) : null}

        {step === "INTRO" ? <FormIntro onStart={() => { void registerFormStart({ userId: user?.id ?? null, ...attribution }); void trackFunnelEvent({ eventName: "form_started", userId: user?.id ?? null, ...attribution }); setStep("PROFILE_ROUTE"); }} /> : null}

        {step === "PROFILE_ROUTE" ? (
          <ProfileRouteStep
            intent={data.intent}
            occupation={data.occupation}
            originNeighborhood={data.originNeighborhood}
            destinationNeighborhood={data.destinationNeighborhood}
            departureWindow={data.departureWindow}
            weeklyFrequency={data.weeklyFrequency}
            onIntentChange={changeIntent}
            onOccupationChange={(value: UserOccupation) =>
              updateData({
                occupation: value,
              })
            }
            onOriginNeighborhoodChange={(value) =>
              updateData({
                originNeighborhood: value,
              })
            }
            onDestinationNeighborhoodChange={(value) =>
              updateData({
                destinationNeighborhood: value,
              })
            }
            onDepartureWindowChange={(value: DepartureWindow) =>
              updateData({
                departureWindow: value,
              })
            }
            onWeeklyFrequencyChange={(value: WeeklyFrequency) =>
              updateData({
                weeklyFrequency: value,
              })
            }
            onNext={goNext}
            onBack={() => setStep("INTRO")}
          />
        ) : null}

        {step === "CURRENT_PRICE" ? (
          <CurrentPriceStep
            currentTransport={data.currentTransport}
            routeCostRange={data.routeCostRange}
            costPeriod={data.costPeriod}
            onCurrentTransportChange={(value: PassengerTransport) =>
              updateData({
                currentTransport: value,
              })
            }
            onRouteCostRangeChange={(value) =>
              updateData({
                routeCostRange: value,
              })
            }
            onCostPeriodChange={(value) =>
              updateData({
                costPeriod: value,
              })
            }
            onNext={goNext}
            onBack={goBack}
          />
        ) : null}

        {step === "PROBLEMS" ? (
          <ProblemsStep
            value={data.painPoints}
            onChange={(value: PainPointCode[]) =>
              updateData({
                painPoints: value,
                mainPainPoint: value.includes(data.mainPainPoint as PainPointCode)
                  ? data.mainPainPoint
                  : undefined,
                mainPainIntensity: value.includes(data.mainPainPoint as PainPointCode)
                  ? data.mainPainIntensity
                  : undefined,
              })
            }
            onNext={goNext}
            onBack={goBack}
          />
        ) : null}

        {step === "MAIN_PROBLEM" ? (
          <MainProblemStep
            painPoints={data.painPoints}
            mainPainPoint={data.mainPainPoint}
            mainPainIntensity={data.mainPainIntensity}
            onMainPainPointChange={(value: PainPointCode) =>
              updateData({
                mainPainPoint: value,
              })
            }
            onMainPainIntensityChange={(value) =>
              updateData({
                mainPainIntensity: value,
              })
            }
            onNext={goNext}
            onBack={goBack}
          />
        ) : null}

        {step === "INTEREST" ? (
          <InterestStep
            intent={data.intent}
            passengerInterest={data.passengerInterest}
            driverInterest={data.driverInterest}
            onPassengerInterestChange={(value: InterestLevel) =>
              updateData({
                passengerInterest: value,
              })
            }
            onDriverInterestChange={(value: InterestLevel) =>
              updateData({
                driverInterest: value,
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
            email={data.email}
            onNameChange={(value) =>
              updateData({
                name: value,
              })
            }
            onWhatsappChange={(value) =>
              updateData({
                whatsapp: value,
              })
            }
            onEmailChange={(value) =>
              updateData({
                email: value,
              })
            }
            onNext={submit}
            onBack={goBack}
          />
        ) : null}

        {isSubmitting ? (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/70 backdrop-blur-sm">
            <div className="rounded-2xl border bg-card px-6 py-5 shadow-lg">
              <p className="text-sm font-medium">Preparando sua participação...</p>

              <p className="mt-1 text-xs text-muted-foreground">Só um instante.</p>
            </div>
          </div>
        ) : null}

        {step === "SUCCESS" ? <FormSuccess data={data} onRestart={restart} /> : null}
      </div>
    </AppShell>
  );
}
