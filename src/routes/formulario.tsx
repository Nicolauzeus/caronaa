import * as React from "react";
import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/caronaa/AppShell";

import { FormIntro } from "@/components/formulario/FormIntro";
import { InstitutionalHeader } from "@/components/formulario/InstitutionalHeader";
import { ContactStep } from "@/components/formulario/ContactStep";
import { FormSuccess } from "@/components/formulario/FormSuccess";
import { ProposalTransitionStep } from "@/components/formulario/ProposalTransitionStep";
import { DriverFlow } from "@/components/formulario/DriverFlow";
import { PassengerFlow } from "@/components/formulario/PassengerFlow";
import { DualFlow } from "@/components/formulario/DualFlow";
import {
  CurrentPriceStep,
  EventPresenceStep,
  InterestStep,
  MainProblemStep,
  ProblemsStep,
  ProfileRouteStep,
  RoleStep,
  RouteDetailsStep,
  CEC_DEFAULT_LOCATION,
} from "@/components/formulario/SimplifiedSteps";

import type {
  CaronaaStsFormData,
  CaronaaIntent,
  DepartureWindow,
  DriverFutureOffer,
  DriverGenderPreference,
  DriverRealValidation,
  DualPriority,
  InterestLevel,
  PainPointCode,
  PassengerIntention,
  PassengerTransport,
  ProposalSense,
  TrustFactor,
  UserOccupation,
  VehicleType,
  WeeklyFrequency,
} from "@/lib/formulario/types";

import type { FormStep } from "@/lib/formulario/flow";

import {
  getNextStep,
  getPreviousStep,
  getProgressPercentage,
  getStepIndex,
  getStepCount,
} from "@/lib/formulario/flow";

import { caronaaStsFormSchema, validateFormStep } from "@/lib/formulario/schema";

import { prepareSubmission } from "@/lib/formulario/submission";
import { registerFormStart, saveFormSubmission } from "@/lib/formulario/form-submission-service";
import { useAuth } from "@/lib/auth-context";
import {
  getCampaignAttribution,
  trackFunnelEvent,
  type ClientFunnelEventName,
} from "@/lib/funnel-events";
import { loadFormDraft, saveFormDraft, clearFormDraft } from "@/lib/formulario/draft-storage";

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
    () => ({
      source: attribution.source,
      campaign: attribution.campaign,
      campaignEvent: attribution.campaignEvent,
      originNeighborhood: "Centro de Eventos do Ceará",
      originLocation: CEC_DEFAULT_LOCATION,
    }),
    [attribution],
  );

  const [step, setStep] = React.useState<FormStep>("INTRO");

  const [data, setData] = React.useState<CaronaaStsFormData>(initialData);

  const [isSubmitting, setIsSubmitting] = React.useState(false);

  // Keeps retries and rapid repeated clicks bound to the same database idempotency key.
  const isSubmittingRef = React.useRef(false);
  const submissionAttemptIdRef = React.useRef<string | null>(null);

  const [submitError, setSubmitError] = React.useState<string | null>(null);
  const [stepErrors, setStepErrors] = React.useState<Record<string, string>>({});

  const progress = getProgressPercentage(step, data);
  const totalSteps = 6;
  const currentStepNumber = getStepIndex(step, data);

  // Recupera rascunho salvo anteriormente se existir
  React.useEffect(() => {
    const draft = loadFormDraft();
    if (draft) {
      if (draft.data) {
        setData((prev) => {
          const restored = { ...prev, ...draft.data };
          if (
            (restored.intent === "PASSAGEIRO" || restored.intent === "AMBOS") &&
            !restored.passengerInterest
          ) {
            restored.passengerInterest =
              restored.passengerIntention === "TALVEZ" ? "TALVEZ" : "USARIA_HOJE";
          }
          if (
            (restored.intent === "MOTORISTA" || restored.intent === "AMBOS") &&
            !restored.driverInterest
          ) {
            restored.driverInterest =
              restored.driverRealValidation === "TALVEZ" ? "TALVEZ" : "USARIA_HOJE";
          }
          return {
            ...restored,
            originNeighborhood: "Centro de Eventos do Ceará",
            originLocation: draft.data.originLocation || CEC_DEFAULT_LOCATION,
            source: prev.source || draft.data.source || "sts_2026",
            campaign: prev.campaign || draft.data.campaign || null,
            campaignEvent:
              prev.campaignEvent || draft.data.campaignEvent || "Siará Tech Summit 2026",
          };
        });
      }
      if (draft.step && draft.step !== "SUCCESS") {
        setStep(draft.step);
      }
    }
  }, []);

  // Persiste rascunho para não perder dados ao consultar termos/políticas
  React.useEffect(() => {
    if (step !== "SUCCESS") {
      saveFormDraft(data, step);
    }
  }, [data, step]);

  React.useEffect(() => {
    void trackFunnelEvent({ eventName: "landing_view", userId: user?.id ?? null, ...attribution });
  }, [attribution, user?.id]);

  const sendFunnelEvent = React.useCallback(
    (
      eventName: ClientFunnelEventName,
      extraMetadata: Record<string, string | number | boolean | null> = {},
      stepOverride?: FormStep,
    ) => {
      void trackFunnelEvent({
        eventName,
        userId: user?.id ?? null,
        formStep: stepOverride ?? step,
        submissionId: data.submissionId ?? null,
        metadata: {
          role: data.intent ?? null,
          etapa: stepOverride ?? step,
          timestamp: Date.now(),
          submissionId: data.submissionId ?? null,
          ...extraMetadata,
        },
        ...attribution,
      });
    },
    [attribution, data.intent, data.submissionId, step, user?.id],
  );

  function updateData(patch: Partial<CaronaaStsFormData>) {
    setStepErrors((current) => {
      const next = { ...current };
      for (const key of Object.keys(patch)) delete next[key];
      return next;
    });
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
      passengerIntention: undefined,
      passengerTransports: undefined,
      passengerTransportsCustom: undefined,
      passengerDifficulties: undefined,
      passengerDifficultiesCustom: undefined,
      passengerGenderPreference: undefined,
      passengerFairPrice: undefined,
      passengerBarriers: undefined,
      passengerBarriersCustom: undefined,
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
    setStepErrors({});
    setSubmitError(null);

    if (intent === "MOTORISTA") {
      clearPassengerData();
    }

    if (intent === "PASSAGEIRO") {
      clearDriverData();
    }

    updateData({ intent });
    sendFunnelEvent("form_role_selected", { role: intent });
  }

  const priceInputTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  React.useEffect(() => {
    return () => {
      if (priceInputTimeoutRef.current) {
        clearTimeout(priceInputTimeoutRef.current);
      }
    };
  }, []);

  const handleProposalSenseChange = React.useCallback(
    (value: ProposalSense) => {
      updateData({ proposalSense: value });
      sendFunnelEvent("form_driver_interest", { level: value });
    },
    [sendFunnelEvent],
  );

  const handleVehicleTypeChange = React.useCallback(
    (value: VehicleType) => {
      updateData({ vehicleType: value });
      sendFunnelEvent("form_driver_vehicle_selected", { vehicle: value });
    },
    [sendFunnelEvent],
  );

  const handleAvailableSeatsChange = React.useCallback(
    (value: number) => {
      updateData({ availableSeats: value });
      sendFunnelEvent("form_driver_seats_selected", { seats: value });
    },
    [sendFunnelEvent],
  );

  const handleDriverPriceChange = React.useCallback(
    (value: number) => {
      updateData({ driverPrice: value });
      if (priceInputTimeoutRef.current) {
        clearTimeout(priceInputTimeoutRef.current);
      }
      priceInputTimeoutRef.current = setTimeout(() => {
        sendFunnelEvent("form_price_input", { price: value });
      }, 600);
    },
    [sendFunnelEvent],
  );

  const handleDriverRealValidationChange = React.useCallback((value: DriverRealValidation) => {
    const mappedInterest: InterestLevel =
      value === "COM_CERTEZA" ? "USARIA_HOJE" : value === "TALVEZ" ? "TALVEZ" : "USARIA_HOJE";
    updateData({
      driverRealValidation: value,
      driverInterest: mappedInterest,
    });
  }, []);

  const handlePassengerTransportsChange = React.useCallback(
    (value: string[]) => {
      updateData({ passengerTransports: value });
      sendFunnelEvent("form_passenger_transport_selected", { transportCount: value.length });
    },
    [sendFunnelEvent],
  );

  const handlePassengerIntentionChange = React.useCallback(
    (value: PassengerIntention) => {
      const mappedInterest: InterestLevel = value === "TALVEZ" ? "TALVEZ" : "USARIA_HOJE";
      updateData({
        passengerIntention: value,
        passengerInterest: mappedInterest,
      });
      sendFunnelEvent("form_passenger_interest", { intention: value });
    },
    [sendFunnelEvent],
  );

  const handleDualPriorityChange = React.useCallback((value: DualPriority) => {
    updateData({ dualPriority: value });
  }, []);

  function goNext() {
    if (step !== "INTRO" && step !== "SUCCESS") {
      const validation = validateFormStep(step, data as unknown as Record<string, unknown>);
      if (!validation.success) {
        if ("errors" in validation) setStepErrors(validation.errors as Record<string, string>);
        else
          setStepErrors(
            Object.fromEntries(
              validation.error.issues.map((issue) => [String(issue.path[0]), issue.message]),
            ),
          );
        return;
      }
    }
    setStepErrors({});
    setSubmitError(null);

    if (step === "ROLE_SELECTION") {
      sendFunnelEvent("form_role_selected", { role: data.intent ?? null });
    }
    if (step === "ROUTE_DETAILS" || step === "PROFILE_ROUTE") {
      sendFunnelEvent("form_route_completed");
    }
    if (step === "EVENT_PRESENCE") {
      sendFunnelEvent("form_event_presence_completed", {
        daysCount: data.eventPresenceDays?.length ?? 0,
      });
    }

    const next = getNextStep(step, data);

    if (next) {
      void trackFunnelEvent({
        eventName: "form_step_completed",
        userId: user?.id ?? null,
        ...attribution,
        formStep: step,
      });
      setStep(next);
      window.scrollTo({
        top: 0,
        behavior: "smooth",
      });
    }
  }

  function goBack() {
    setStepErrors({});
    setSubmitError(null);
    const previous = getPreviousStep(step, data);

    if (previous) {
      setStep(previous);
      window.scrollTo({
        top: 0,
        behavior: "smooth",
      });
    }
  }

  function openContact() {
    const validation = validateFormStep("INTEREST", data as unknown as Record<string, unknown>);
    if (!validation.success) {
      if ("errors" in validation) setStepErrors(validation.errors as Record<string, string>);
      return;
    }
    setStepErrors({});
    setSubmitError(null);
    void trackFunnelEvent({
      eventName: "form_step_completed",
      userId: user?.id ?? null,
      ...attribution,
      formStep: "INTEREST",
    });
    setStep("CONTACT");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function restart() {
    clearFormDraft();
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
      const field = String(firstIssue?.path[0] ?? "");
      const friendlyMap: Record<string, string> = {
        intent: "Escolha como você deseja participar.",
        occupation: "Informe seu perfil ou ocupação.",
        occupationDetails: "Descreva sua ocupação.",
        originNeighborhood: "Informe a origem aproximada do trajeto.",
        destinationNeighborhood: "Informe o destino aproximado do trajeto.",
        departureWindow: "Selecione o horário previsto de saída.",
        eventPresenceDays: "Selecione os dias em que você estará no evento.",
        proposalSense: "Informe quanto essa proposta faz sentido para você.",
        vehicleType: "Selecione o tipo de veículo.",
        availableSeats: "Informe a quantidade de assentos disponíveis.",
        driverPrice: "Informe o valor sugerido por vaga.",
        driverRealValidation: "Informe se você toparia oferecer carona.",
        passengerTransports: "Selecione como costuma se deslocar.",
        passengerTransportsCustom: "Especifique seu modo de transporte.",
        passengerDifficulties: "Selecione suas dificuldades no deslocamento.",
        passengerDifficultiesCustom: "Descreva sua principal dificuldade.",
        passengerFairPrice: "O valor justo a pagar deve ser entre R$ 3,50 e R$ 25,00.",
        passengerIntention: "Informe sua intenção de pegar carona.",
        dualPriority: "Informe qual possibilidade é mais importante para você hoje.",
        name: "Informe seu nome completo.",
        whatsapp: "Informe um WhatsApp válido.",
        termsAccepted: "É obrigatório aceitar os Termos de Uso.",
        privacyAccepted: "É obrigatório aceitar a Política de Privacidade.",
      };

      const rawMsg = firstIssue?.message;
      const cleanMsg =
        !rawMsg || rawMsg === "Required" || rawMsg.toLowerCase().includes("required")
          ? friendlyMap[field] || "Revise os dados antes de continuar."
          : rawMsg;

      setSubmitError(cleanMsg);

      return;
    }

    try {
      isSubmittingRef.current = true;
      setIsSubmitting(true);

      // Pre-flight: garante que passengerInterest e driverInterest nunca cheguem como
      // undefined ao prepareSubmission. O Zod faz strip de campos opcionais undefined,
      // então usamos o estado bruto `data` como fonte de verdade para esses campos.
      const intent = validation.data.intent;
      const rawPassengerInterest: InterestLevel | undefined =
        (validation.data.passengerInterest as InterestLevel | undefined) ??
        (data.passengerInterest as InterestLevel | undefined);
      const rawPassengerIntention =
        (validation.data.passengerIntention as string | undefined) ??
        (data.passengerIntention as string | undefined);
      const rawDriverInterest: InterestLevel | undefined =
        (validation.data.driverInterest as InterestLevel | undefined) ??
        (data.driverInterest as InterestLevel | undefined);
      const rawDriverValidation =
        (validation.data.driverRealValidation as string | undefined) ??
        (data.driverRealValidation as string | undefined);

      const derivedPassengerInterest: InterestLevel | undefined =
        intent === "PASSAGEIRO" || intent === "AMBOS"
          ? (rawPassengerInterest ??
            (rawPassengerIntention === "TALVEZ"
              ? "TALVEZ"
              : rawPassengerIntention
                ? "USARIA_HOJE"
                : "USARIA_HOJE"))
          : undefined;

      const derivedDriverInterest: InterestLevel | undefined =
        intent === "MOTORISTA" || intent === "AMBOS"
          ? (rawDriverInterest ??
            (rawDriverValidation === "TALVEZ"
              ? "TALVEZ"
              : rawDriverValidation === "NAO"
                ? "PROVAVELMENTE_NAO"
                : "USARIA_HOJE"))
          : undefined;

      const payload = prepareSubmission({
        ...data,
        ...validation.data,
        campaign: validation.data.campaign ?? null,
        submissionId: submissionAttemptIdRef.current ?? validation.data.submissionId,
        ...(derivedPassengerInterest !== undefined
          ? { passengerInterest: derivedPassengerInterest }
          : {}),
        ...(derivedDriverInterest !== undefined ? { driverInterest: derivedDriverInterest } : {}),
      });
      submissionAttemptIdRef.current = payload.submissionId;

      await saveFormSubmission(payload, user?.id ?? null);

      clearFormDraft();

      setData((current) => ({
        ...current,
        submissionId: payload.submissionId,
        createdAt: payload.createdAt,
      }));

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
          <InstitutionalHeader
            variant="sticky"
            showProgress
            progress={progress}
            currentStep={currentStepNumber}
            totalSteps={totalSteps}
            isFinalStep={step === "CONTACT"}
          />
        ) : null}

        {submitError ? (
          <div className="mx-auto w-full max-w-2xl px-4 pt-4 sm:px-6">
            <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 flex items-start justify-between gap-2">
              <p className="text-sm font-medium text-destructive">
                {submitError.toLowerCase().includes("required")
                  ? "Por favor, revise os dados antes de continuar."
                  : submitError}
              </p>
              <button
                type="button"
                onClick={() => setSubmitError(null)}
                className="text-destructive/70 hover:text-destructive text-xs font-semibold px-2 py-1"
                aria-label="Fechar mensagem de erro"
              >
                ✕
              </button>
            </div>
          </div>
        ) : null}

        {Object.entries(stepErrors).length > 0 ? (
          <div className="mx-auto w-full max-w-2xl space-y-1 px-4 pt-3 sm:px-6" role="alert">
            {Object.entries(stepErrors).map(([field, message]) => (
              <p key={field} className="text-sm text-destructive">
                {message.toLowerCase().includes("required")
                  ? "Preencha este campo obrigatório."
                  : message}
              </p>
            ))}
          </div>
        ) : null}

        {step === "INTRO" ? (
          <FormIntro
            onStart={() => {
              void registerFormStart({ userId: user?.id ?? null, ...attribution });
              sendFunnelEvent("form_started", {}, "INTRO");
              sendFunnelEvent("form_role_selected", {}, "ROLE_SELECTION");
              setStep("ROLE_SELECTION");
            }}
          />
        ) : null}

        {step === "ROLE_SELECTION" ? (
          <RoleStep
            intent={data.intent}
            stepNumber={1}
            totalSteps={totalSteps}
            onIntentChange={changeIntent}
            onNext={goNext}
            onBack={() => setStep("INTRO")}
          />
        ) : null}

        {step === "ROUTE_DETAILS" ? (
          <RouteDetailsStep
            intent={data.intent}
            occupation={data.occupation}
            occupationDetails={data.occupationDetails}
            originNeighborhood={data.originNeighborhood}
            originLocation={data.originLocation}
            destinationNeighborhood={data.destinationNeighborhood}
            destinationLocation={data.destinationLocation}
            departureWindow={data.departureWindow}
            stepNumber={2}
            totalSteps={totalSteps}
            onOccupationChange={(value: UserOccupation) =>
              updateData({
                occupation: value,
              })
            }
            onOccupationDetailsChange={(value) =>
              updateData({
                occupationDetails: value,
              })
            }
            onOriginNeighborhoodChange={(value) =>
              updateData({
                originNeighborhood: value,
              })
            }
            onOriginLocationChange={(value, details) =>
              updateData({
                originNeighborhood: value,
                originLocation: details,
              })
            }
            onDestinationNeighborhoodChange={(value) =>
              updateData({
                destinationNeighborhood: value,
              })
            }
            onDestinationLocationChange={(value, details) =>
              updateData({
                destinationNeighborhood: value,
                destinationLocation: details,
              })
            }
            onDepartureWindowChange={(value: DepartureWindow) =>
              updateData({
                departureWindow: value,
              })
            }
            onNext={goNext}
            onBack={goBack}
          />
        ) : null}

        {step === "EVENT_PRESENCE" ? (
          <EventPresenceStep
            eventPresenceDays={data.eventPresenceDays}
            eventPresenceCustom={data.eventPresenceCustom}
            stepNumber={3}
            totalSteps={totalSteps}
            onEventPresenceDaysChange={(days) => {
              updateData({ eventPresenceDays: days });
              sendFunnelEvent("form_event_presence_completed", { daysCount: days.length });
            }}
            onEventPresenceCustomChange={(value) =>
              updateData({
                eventPresenceCustom: value,
              })
            }
            onNext={goNext}
            onBack={goBack}
          />
        ) : null}

        {step === "PROFILE_ROUTE" ? (
          <ProfileRouteStep
            intent={data.intent}
            occupation={data.occupation}
            occupationDetails={data.occupationDetails}
            originNeighborhood={data.originNeighborhood}
            originLocation={data.originLocation}
            destinationNeighborhood={data.destinationNeighborhood}
            destinationLocation={data.destinationLocation}
            departureWindow={data.departureWindow}
            weeklyFrequency={data.weeklyFrequency}
            eventPresenceDays={data.eventPresenceDays}
            eventPresenceCustom={data.eventPresenceCustom}
            stepNumber={1}
            totalSteps={totalSteps}
            onIntentChange={changeIntent}
            onOccupationChange={(value: UserOccupation) =>
              updateData({
                occupation: value,
              })
            }
            onOccupationDetailsChange={(value) =>
              updateData({
                occupationDetails: value,
              })
            }
            onOriginNeighborhoodChange={(value) =>
              updateData({
                originNeighborhood: value,
              })
            }
            onOriginLocationChange={(value, details) =>
              updateData({
                originNeighborhood: value,
                originLocation: details,
              })
            }
            onDestinationNeighborhoodChange={(value) =>
              updateData({
                destinationNeighborhood: value,
              })
            }
            onDestinationLocationChange={(value, details) =>
              updateData({
                destinationNeighborhood: value,
                destinationLocation: details,
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
            onEventPresenceDaysChange={(days) => {
              updateData({ eventPresenceDays: days });
              sendFunnelEvent("form_event_presence_completed", { daysCount: days.length });
            }}
            onEventPresenceCustomChange={(value) =>
              updateData({
                eventPresenceCustom: value,
              })
            }
            onNext={goNext}
            onBack={() => setStep("INTRO")}
          />
        ) : null}

        {step === "PROPOSAL_TRANSITION" ? (
          <ProposalTransitionStep
            intent={data.intent}
            proposalSense={data.proposalSense}
            onProposalSenseChange={handleProposalSenseChange}
            onNext={goNext}
            onBack={goBack}
            stepNumber={currentStepNumber}
            totalSteps={totalSteps}
          />
        ) : null}

        {step === "DRIVER_FLOW" ? (
          <DriverFlow
            vehicleType={data.vehicleType}
            availableSeats={data.availableSeats}
            driverFutureOffer={data.driverFutureOffer}
            driverComfortFactors={data.driverComfortFactors}
            driverGenderPreference={data.driverGenderPreference}
            driverPrice={data.driverPrice}
            driverBarriers={data.driverBarriers}
            driverBarriersCustom={data.driverBarriersCustom}
            driverRealValidation={data.driverRealValidation}
            onVehicleTypeChange={handleVehicleTypeChange}
            onAvailableSeatsChange={handleAvailableSeatsChange}
            onDriverFutureOfferChange={(value) => updateData({ driverFutureOffer: value })}
            onDriverComfortFactorsChange={(value) => updateData({ driverComfortFactors: value })}
            onDriverGenderPreferenceChange={(value) =>
              updateData({ driverGenderPreference: value })
            }
            onDriverPriceChange={handleDriverPriceChange}
            onDriverBarriersChange={(value) => updateData({ driverBarriers: value })}
            onDriverBarriersCustomChange={(value) => updateData({ driverBarriersCustom: value })}
            onDriverRealValidationChange={handleDriverRealValidationChange}
            onNext={goNext}
            onBack={goBack}
            stepNumber={currentStepNumber}
            totalSteps={totalSteps}
          />
        ) : null}

        {step === "PASSENGER_FLOW" ? (
          <PassengerFlow
            passengerTransports={data.passengerTransports}
            passengerTransportsCustom={data.passengerTransportsCustom}
            passengerDifficulties={data.passengerDifficulties}
            passengerDifficultiesCustom={data.passengerDifficultiesCustom}
            passengerTrustFactors={data.passengerTrustFactors}
            passengerGenderPreference={data.passengerGenderPreference}
            passengerFairPrice={data.passengerFairPrice}
            passengerBarriers={data.passengerBarriers}
            passengerBarriersCustom={data.passengerBarriersCustom}
            passengerIntention={data.passengerIntention}
            onPassengerTransportsChange={handlePassengerTransportsChange}
            onPassengerTransportsCustomChange={(value) =>
              updateData({ passengerTransportsCustom: value })
            }
            onPassengerDifficultiesChange={(value) => updateData({ passengerDifficulties: value })}
            onPassengerDifficultiesCustomChange={(value) =>
              updateData({ passengerDifficultiesCustom: value })
            }
            onPassengerTrustFactorsChange={(value) => updateData({ passengerTrustFactors: value })}
            onPassengerGenderPreferenceChange={(value) =>
              updateData({ passengerGenderPreference: value })
            }
            onPassengerFairPriceChange={(value) => updateData({ passengerFairPrice: value })}
            onPassengerBarriersChange={(value) => updateData({ passengerBarriers: value })}
            onPassengerBarriersCustomChange={(value) =>
              updateData({ passengerBarriersCustom: value })
            }
            onPassengerIntentionChange={handlePassengerIntentionChange}
            onNext={goNext}
            onBack={goBack}
            stepNumber={currentStepNumber}
            totalSteps={totalSteps}
          />
        ) : null}

        {step === "BOTH_FLOW" ? (
          <DualFlow
            dualPriority={data.dualPriority}
            trustFactors={data.passengerTrustFactors}
            genderPreference={data.passengerGenderPreference}
            vehicleType={data.vehicleType}
            availableSeats={data.availableSeats}
            maxDetourMinutes={data.maxDetourMinutes}
            driverFutureOffer={data.driverFutureOffer}
            driverPrice={data.driverPrice}
            driverBarriers={data.driverBarriers}
            driverBarriersCustom={data.driverBarriersCustom}
            driverRealValidation={data.driverRealValidation}
            passengerTransports={data.passengerTransports}
            passengerTransportsCustom={data.passengerTransportsCustom}
            passengerDifficulties={data.passengerDifficulties}
            passengerDifficultiesCustom={data.passengerDifficultiesCustom}
            passengerFairPrice={data.passengerFairPrice}
            passengerBarriers={data.passengerBarriers}
            passengerBarriersCustom={data.passengerBarriersCustom}
            passengerIntention={data.passengerIntention}
            onDualPriorityChange={handleDualPriorityChange}
            onTrustFactorsChange={(value) => {
              updateData({ passengerTrustFactors: value, driverTrustFactors: value });
            }}
            onGenderPreferenceChange={(value) => {
              updateData({ passengerGenderPreference: value, driverGenderPreference: value });
            }}
            onVehicleTypeChange={handleVehicleTypeChange}
            onAvailableSeatsChange={handleAvailableSeatsChange}
            onMaxDetourMinutesChange={(value) => updateData({ maxDetourMinutes: value })}
            onDriverFutureOfferChange={(value) => updateData({ driverFutureOffer: value })}
            onDriverPriceChange={handleDriverPriceChange}
            onDriverBarriersChange={(value) => updateData({ driverBarriers: value })}
            onDriverBarriersCustomChange={(value) => updateData({ driverBarriersCustom: value })}
            onDriverRealValidationChange={handleDriverRealValidationChange}
            onPassengerTransportsChange={handlePassengerTransportsChange}
            onPassengerTransportsCustomChange={(value) =>
              updateData({ passengerTransportsCustom: value })
            }
            onPassengerDifficultiesChange={(value) => updateData({ passengerDifficulties: value })}
            onPassengerDifficultiesCustomChange={(value) =>
              updateData({ passengerDifficultiesCustom: value })
            }
            onPassengerFairPriceChange={(value) => updateData({ passengerFairPrice: value })}
            onPassengerBarriersChange={(value) => updateData({ passengerBarriers: value })}
            onPassengerBarriersCustomChange={(value) =>
              updateData({ passengerBarriersCustom: value })
            }
            onPassengerIntentionChange={handlePassengerIntentionChange}
            onNext={goNext}
            onBack={goBack}
            stepNumber={currentStepNumber}
            totalSteps={totalSteps}
          />
        ) : null}

        {step === "CURRENT_PRICE" ? (
          <CurrentPriceStep
            stepNumber={2}
            totalSteps={totalSteps}
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
            stepNumber={3}
            totalSteps={totalSteps}
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
            stepNumber={4}
            totalSteps={totalSteps}
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
            stepNumber={5}
            totalSteps={totalSteps}
            intent={data.intent}
            passengerInterest={data.passengerInterest}
            driverInterest={data.driverInterest}
            passengerPriceRange={data.passengerPriceRange}
            driverPrice={data.driverPrice}
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
            onPassengerPriceRangeChange={(value) =>
              updateData({
                passengerPriceRange: value,
              })
            }
            onDriverPriceChange={(value) =>
              updateData({
                driverPrice: value,
              })
            }
            onNext={openContact}
            onBack={goBack}
          />
        ) : null}

        {step === "CONTACT" ? (
          <ContactStep
            name={data.name}
            whatsapp={data.whatsapp}
            email={data.email}
            feedback={data.feedback}
            termsAccepted={data.termsAccepted}
            privacyAccepted={data.privacyAccepted}
            researchAccepted={data.researchAccepted}
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
            onFeedbackChange={(value) =>
              updateData({
                feedback: value,
              })
            }
            onTermsAcceptedChange={(value) =>
              updateData({
                termsAccepted: value,
                termsVersion: "sts_2026_v1",
                consentsTimestamp: new Date().toISOString(),
              })
            }
            onPrivacyAcceptedChange={(value) =>
              updateData({
                privacyAccepted: value,
                consentsTimestamp: new Date().toISOString(),
              })
            }
            onResearchAcceptedChange={(value) =>
              updateData({
                researchAccepted: value,
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
