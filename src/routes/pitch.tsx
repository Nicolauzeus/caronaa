// @ts-nocheck -- legacy typing mismatches with generated database types; fix incrementally
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowRight,
  Building2,
  Check,
  CheckCircle2,
  ChevronRight,
  Coins,
  ExternalLink,
  HeartHandshake,
  HelpCircle,
  Instagram,
  Mail,
  MapPin,
  MessageSquare,
  Phone,
  Send,
  Share2,
  ShieldCheck,
  Sparkles,
  User,
} from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";

import { BrandBadge, BrandLogo, CaronaaSymbol, StsBadge } from "@/components/caronaa/BrandElements";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { LocationAutocomplete } from "@/components/formulario/LocationAutocomplete";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";
import {
  INSTITUTION_TYPE_LABELS,
  INVESTOR_UPDATE_LABELS,
  InstitutionType,
  InvestorUpdatePreference,
  PARTNERSHIP_TYPE_LABELS,
  PartnershipType,
  PitchInterest,
} from "@/lib/pitch/types";
import { PitchFormValues, formatBrazilianPhoneNumber, pitchFormSchema } from "@/lib/pitch/schema";
import { savePitchContact } from "@/lib/pitch/pitch-service";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/pitch")({
  head: () => ({
    meta: [
      {
        title: "Pitch Siará Tech Summit — CARONAA",
      },
      {
        name: "description",
        content:
          "Construa a próxima fase da mobilidade compartilhada junto com a CARONAA. Deixe seu contato e acompanhe nossa evolução.",
      },
      {
        property: "og:title",
        content: "Pitch Siará Tech Summit — CARONAA",
      },
      {
        property: "og:description",
        content:
          "Construa a próxima fase da mobilidade compartilhada junto com a CARONAA. Parcerias e Investimentos.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: PitchLandingPage,
});

export function PitchLandingPage() {
  const [selectedInterest, setSelectedInterest] = useState<PitchInterest | null>(null);
  const [samePhoneWhatsapp, setSamePhoneWhatsapp] = useState<boolean>(true);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [isSubmitted, setIsSubmitted] = useState<boolean>(false);
  const [alreadyFilledForm, setAlreadyFilledForm] = useState<boolean>(false);
  const [alreadyFollowedInstagram, setAlreadyFollowedInstagram] = useState<boolean>(false);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<PitchFormValues>({
    resolver: zodResolver(pitchFormSchema),
    defaultValues: {
      interest: undefined,
      name: "",
      whatsapp: "",
      phone: "",
      same_phone_whatsapp: true,
      email: "",
      investor_update_preference: undefined,
      institution_name: "",
      institution_type: undefined,
      institution_address: "",
      partnership_type: undefined,
      partnership_type_custom: "",
      message: "",
      consent_contact: false,
      consent_newsletter: false,
    },
  });

  const currentPartnershipType = watch("partnership_type");
  const currentInvestorPref = watch("investor_update_preference");
  const currentInstitutionType = watch("institution_type");
  const consentContactValue = watch("consent_contact");
  const consentNewsletterValue = watch("consent_newsletter");

  const handleInterestSelect = (interest: PitchInterest) => {
    setSelectedInterest(interest);
    setValue("interest", interest, { shouldValidate: true });
  };

  const handleToggleSamePhone = (checked: boolean) => {
    setSamePhoneWhatsapp(checked);
    setValue("same_phone_whatsapp", checked, { shouldValidate: true });
    if (checked) {
      setValue("phone", "");
    }
  };

  const onSubmit = async (values: PitchFormValues) => {
    try {
      setIsSubmitting(true);
      const res = await savePitchContact({
        ...values,
        same_phone_whatsapp: samePhoneWhatsapp,
      });

      if (res.success) {
        setIsSubmitted(true);
        window.scrollTo({ top: 0, behavior: "smooth" });
        toast.success("Obrigado pelo seu interesse! Seus dados foram recebidos com sucesso.");
      } else {
        toast.error(res.error || "Ocorreu um erro ao salvar seu contato. Tente novamente.");
      }
    } catch {
      toast.error("Erro inesperado. Por favor, tente novamente.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Success Screen
  if (isSubmitted) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-amber-500/10 via-background to-background text-foreground flex flex-col justify-between p-4 sm:p-6 md:p-10">
        <header className="max-w-xl mx-auto w-full pt-4 pb-6 flex items-center justify-between">
          <BrandLogo size="md" />
          <StsBadge />
        </header>

        <main className="max-w-xl mx-auto w-full flex-1 flex flex-col justify-center py-6">
          <Card className="border-amber-500/30 bg-card/95 shadow-xl backdrop-blur rounded-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-500">
            <div className="bg-gradient-to-r from-amber-500 to-orange-500 h-2.5 w-full" />
            <CardHeader className="text-center pt-8 pb-4">
              <div className="mx-auto w-16 h-16 bg-amber-500/15 text-amber-600 rounded-full flex items-center justify-center mb-4 ring-8 ring-amber-500/10">
                <Check className="w-8 h-8 stroke-[3]" />
              </div>
              <CardTitle className="text-2xl sm:text-3xl font-bold font-display tracking-tight text-foreground">
                Obrigado por querer acompanhar a CARONAA! 🚗💛
              </CardTitle>
              <CardDescription className="text-base sm:text-lg text-muted-foreground mt-3 leading-relaxed">
                Estamos começando a transformar a validação em evidência. Em breve entraremos em
                contato pelo canal que você informou.
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-6 pt-2 pb-8 px-5 sm:px-8">
              <div className="rounded-xl bg-muted/60 p-4 border border-border/80">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                  Enquanto isso
                </p>
                <p className="text-sm text-foreground/90 font-medium">
                  Continue acompanhando nossa jornada e participe das primeiras rotas da nossa
                  comunidade.
                </p>
              </div>

              {!alreadyFilledForm ? (
                <div className="space-y-4 rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 sm:p-5">
                  <div className="flex items-start gap-3">
                    <div className="p-2 rounded-lg bg-amber-500/15 text-amber-600 shrink-0 mt-0.5">
                      <Sparkles className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="font-semibold text-sm sm:text-base text-foreground">
                        Experimente o Formulário de Validação
                      </h4>
                      <p className="text-xs sm:text-sm text-muted-foreground mt-1">
                        Cadastre um trajeto real para o evento e ajude a validar nossos algoritmos
                        de matching.
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row gap-2.5 pt-2">
                    <Button
                      asChild
                      className="flex-1 bg-amber-500 hover:bg-amber-600 text-slate-950 font-semibold gap-2 shadow-sm"
                    >
                      <Link to="/formulario">
                        Preencher formulário
                        <ArrowRight className="w-4 h-4" />
                      </Link>
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => setAlreadyFilledForm(true)}
                      className="text-xs sm:text-sm text-muted-foreground hover:text-foreground"
                    >
                      Já preenchi
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-4 rounded-xl border border-pink-500/25 bg-gradient-to-br from-pink-500/10 via-purple-500/5 to-amber-500/10 p-5 animate-in fade-in slide-in-from-bottom-3 duration-300">
                  <div className="flex items-start gap-3.5">
                    <div className="p-2.5 rounded-xl bg-gradient-to-tr from-amber-500 via-rose-500 to-purple-600 text-white shrink-0 shadow-md">
                      <Instagram className="w-5 h-5" />
                    </div>
                    <div className="flex-1">
                      <h4 className="font-bold text-base text-foreground flex items-center gap-1.5">
                        Siga a CARONAA no Instagram
                      </h4>
                      <p className="text-xs sm:text-sm text-muted-foreground mt-1 leading-relaxed">
                        Acompanhe nossos bastidores, atualizações em tempo real e métricas do Siará
                        Tech Summit diretamente no nosso perfil oficial.
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row gap-2.5 pt-2">
                    <Button
                      asChild
                      className="flex-1 bg-gradient-to-r from-purple-600 via-pink-600 to-amber-500 hover:opacity-95 text-white font-semibold gap-2 shadow-md border-0"
                    >
                      <a
                        href="https://www.instagram.com/caronaa.app/"
                        target="_blank"
                        rel="noreferrer"
                      >
                        <Instagram className="w-4 h-4" />
                        Seguir @caronaa.app
                        <ExternalLink className="w-3.5 h-3.5 opacity-80" />
                      </a>
                    </Button>

                    {!alreadyFollowedInstagram ? (
                      <Button
                        variant="outline"
                        onClick={() => {
                          setAlreadyFollowedInstagram(true);
                          toast.success("Excelente! Obrigado por fazer parte da comunidade.");
                        }}
                        className="text-xs sm:text-sm"
                      >
                        Já segui
                      </Button>
                    ) : (
                      <Button
                        variant="ghost"
                        disabled
                        className="text-xs sm:text-sm text-emerald-600 dark:text-emerald-400 gap-1.5"
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        Conectado 🎉
                      </Button>
                    )}
                  </div>
                </div>
              )}

              <div className="pt-4 border-t text-center">
                <Button asChild variant="ghost" size="sm" className="text-xs text-muted-foreground">
                  <Link to="/">← Voltar para a página inicial</Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        </main>

        <footer className="max-w-xl mx-auto w-full text-center py-4 text-xs text-muted-foreground">
          <p>© {new Date().getFullYear()} CARONAA — Mobilidade Compartilhada & Inteligente.</p>
        </footer>
      </div>
    );
  }

  // Form Screen
  return (
    <div className="min-h-screen bg-gradient-to-b from-amber-500/10 via-background to-background text-foreground flex flex-col justify-between p-4 sm:p-6 md:p-8">
      {/* Header */}
      <header className="max-w-2xl mx-auto w-full pt-2 pb-6 flex items-center justify-between">
        <BrandLogo size="md" />
        <div className="flex items-center gap-2">
          <StsBadge />
        </div>
      </header>

      {/* Main Pitch Card Container */}
      <main className="max-w-2xl mx-auto w-full flex-1 py-2">
        <Card className="border-border/80 bg-card/95 shadow-xl backdrop-blur rounded-2xl overflow-hidden">
          {/* Top subtle highlight banner */}
          <div className="bg-gradient-to-r from-amber-400 via-amber-500 to-orange-500 h-2 w-full" />

          <CardHeader className="pt-6 pb-6 px-5 sm:px-8 space-y-3">
            <div className="inline-flex items-center gap-2 self-start px-3 py-1 rounded-full text-xs font-semibold bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/20">
              <CaronaaSymbol size={14} className="text-amber-600 dark:text-amber-400" />
              <span>Siará Tech Summit 2026 • Pitch Validation</span>
            </div>

            <h1 className="text-2xl sm:text-3xl md:text-4xl font-extrabold font-display tracking-tight text-foreground leading-tight">
              Vamos construir a próxima fase juntos?
            </h1>

            <p className="text-sm sm:text-base text-muted-foreground leading-relaxed">
              A CARONAA está começando sua fase de validação com usuários reais. Se você acredita
              que pode contribuir como parceiro, instituição ou possível investidor, deixe seu
              contato e acompanhe nossa evolução.
            </p>
          </CardHeader>

          <CardContent className="px-5 sm:px-8 pb-8">
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
              {/* Escolha Inicial de Interesse */}
              <div className="space-y-3">
                <Label className="text-sm sm:text-base font-bold text-foreground flex items-center gap-2">
                  <span>Como você gostaria de acompanhar a CARONAA?</span>
                  <span className="text-amber-600">*</span>
                </Label>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <button
                    type="button"
                    onClick={() => handleInterestSelect("INVESTIDOR")}
                    className={cn(
                      "flex flex-col items-center justify-center p-4 rounded-xl border-2 text-center transition-all duration-200 group text-sm font-semibold",
                      selectedInterest === "INVESTIDOR"
                        ? "border-amber-500 bg-amber-500/10 text-foreground shadow-sm ring-2 ring-amber-500/20"
                        : "border-border/80 hover:border-amber-500/40 bg-background text-muted-foreground hover:text-foreground",
                    )}
                  >
                    <Coins
                      className={cn(
                        "w-6 h-6 mb-2 transition-colors",
                        selectedInterest === "INVESTIDOR"
                          ? "text-amber-600"
                          : "text-muted-foreground group-hover:text-amber-500",
                      )}
                    />
                    <span>Quero acompanhar como possível investidor</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleInterestSelect("PARCEIRO")}
                    className={cn(
                      "flex flex-col items-center justify-center p-4 rounded-xl border-2 text-center transition-all duration-200 group text-sm font-semibold",
                      selectedInterest === "PARCEIRO"
                        ? "border-amber-500 bg-amber-500/10 text-foreground shadow-sm ring-2 ring-amber-500/20"
                        : "border-border/80 hover:border-amber-500/40 bg-background text-muted-foreground hover:text-foreground",
                    )}
                  >
                    <Building2
                      className={cn(
                        "w-6 h-6 mb-2 transition-colors",
                        selectedInterest === "PARCEIRO"
                          ? "text-amber-600"
                          : "text-muted-foreground group-hover:text-amber-500",
                      )}
                    />
                    <span>Quero conversar sobre uma parceria</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleInterestSelect("AMBOS")}
                    className={cn(
                      "flex flex-col items-center justify-center p-4 rounded-xl border-2 text-center transition-all duration-200 group text-sm font-semibold",
                      selectedInterest === "AMBOS"
                        ? "border-amber-500 bg-amber-500/10 text-foreground shadow-sm ring-2 ring-amber-500/20"
                        : "border-border/80 hover:border-amber-500/40 bg-background text-muted-foreground hover:text-foreground",
                    )}
                  >
                    <HeartHandshake
                      className={cn(
                        "w-6 h-6 mb-2 transition-colors",
                        selectedInterest === "AMBOS"
                          ? "text-amber-600"
                          : "text-muted-foreground group-hover:text-amber-500",
                      )}
                    />
                    <span>Quero os dois</span>
                  </button>
                </div>

                {errors.interest && (
                  <p className="text-xs text-destructive font-medium mt-1">
                    {errors.interest.message}
                  </p>
                )}
              </div>

              {/* Seção Formulário Base */}
              <div className="space-y-4 pt-2 border-t border-border/70">
                <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
                  Seus dados para contato
                </h3>

                <div className="space-y-2">
                  <Label htmlFor="name" className="text-sm font-semibold">
                    Nome completo <span className="text-amber-600">*</span>
                  </Label>
                  <div className="relative">
                    <User className="w-4 h-4 text-muted-foreground absolute left-3 top-3" />
                    <Input
                      id="name"
                      placeholder="Ex.: Carolina Silva"
                      className="pl-9"
                      {...register("name")}
                    />
                  </div>
                  {errors.name && (
                    <p className="text-xs text-destructive font-medium">{errors.name.message}</p>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="whatsapp" className="text-sm font-semibold">
                      WhatsApp <span className="text-amber-600">*</span>
                    </Label>
                    <div className="relative">
                      <Phone className="w-4 h-4 text-muted-foreground absolute left-3 top-3" />
                      <Input
                        id="whatsapp"
                        type="tel"
                        placeholder="(85) 99999-9999"
                        className="pl-9"
                        {...register("whatsapp", {
                          onChange: (e) => {
                            const formatted = formatBrazilianPhoneNumber(e.target.value);
                            setValue("whatsapp", formatted);
                          },
                        })}
                      />
                    </div>
                    {errors.whatsapp ? (
                      <p className="text-xs text-destructive font-medium">
                        {errors.whatsapp.message}
                      </p>
                    ) : (
                      <p className="text-[11px] text-muted-foreground">
                        Informe com DDD (ex.: (85) 99999-9999)
                      </p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="email" className="text-sm font-semibold">
                      E-mail <span className="text-muted-foreground text-xs">(opcional)</span>
                    </Label>
                    <div className="relative">
                      <Mail className="w-4 h-4 text-muted-foreground absolute left-3 top-3" />
                      <Input
                        id="email"
                        type="email"
                        placeholder="contato@empresa.com.br"
                        className="pl-9"
                        {...register("email")}
                      />
                    </div>
                    {errors.email && (
                      <p className="text-xs text-destructive font-medium">{errors.email.message}</p>
                    )}
                  </div>
                </div>

                {/* Checkbox Mesmo número para ligação */}
                <div className="pt-1">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="same_phone_whatsapp"
                      checked={samePhoneWhatsapp}
                      onCheckedChange={(checked) => handleToggleSamePhone(Boolean(checked))}
                    />
                    <Label
                      htmlFor="same_phone_whatsapp"
                      className="text-xs sm:text-sm font-medium leading-none cursor-pointer"
                    >
                      Meu WhatsApp é o mesmo número para ligação
                    </Label>
                  </div>

                  {!samePhoneWhatsapp && (
                    <div className="mt-3 space-y-2 animate-in fade-in duration-200">
                      <Label htmlFor="phone" className="text-sm font-semibold">
                        Telefone para ligação <span className="text-amber-600">*</span>
                      </Label>
                      <div className="relative">
                        <Phone className="w-4 h-4 text-muted-foreground absolute left-3 top-3" />
                        <Input
                          id="phone"
                          type="tel"
                          placeholder="(85) 3333-3333"
                          className="pl-9"
                          {...register("phone", {
                            onChange: (e) => {
                              const formatted = formatBrazilianPhoneNumber(e.target.value);
                              setValue("phone", formatted);
                            },
                          })}
                        />
                      </div>
                      {errors.phone ? (
                        <p className="text-xs text-destructive font-medium">
                          {errors.phone.message}
                        </p>
                      ) : (
                        <p className="text-[11px] text-muted-foreground">
                          Informe telefone fixo ou celular com DDD
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Seção INVESTIDOR (se INVESTIDOR ou AMBOS) */}
              {(selectedInterest === "INVESTIDOR" || selectedInterest === "AMBOS") && (
                <div className="space-y-4 pt-4 border-t border-amber-500/20 bg-amber-500/5 p-4 sm:p-5 rounded-xl animate-in fade-in duration-300">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400 font-bold text-sm">
                      <Coins className="w-4 h-4" />
                      <span>Investimento & Validação</span>
                    </div>
                    <p className="text-sm font-medium text-foreground">
                      Quero acompanhar os resultados da fase de validação e conversar sobre a
                      próxima etapa da CARONAA.
                    </p>
                  </div>

                  <div className="space-y-2.5 pt-2">
                    <Label className="text-xs sm:text-sm font-semibold text-foreground">
                      Como prefere receber atualizações? <span className="text-amber-600">*</span>
                    </Label>

                    <RadioGroup
                      value={currentInvestorPref || ""}
                      onValueChange={(val) =>
                        setValue("investor_update_preference", val as InvestorUpdatePreference, {
                          shouldValidate: true,
                        })
                      }
                      className="space-y-2"
                    >
                      {(
                        Object.keys(INVESTOR_UPDATE_LABELS) as unknown as InvestorUpdatePreference[]
                      ).map((key) => (
                        <label
                          key={key}
                          htmlFor={`pref-${key}`}
                          className={cn(
                            "flex items-center gap-3 p-3 rounded-lg border text-xs sm:text-sm cursor-pointer transition-colors",
                            currentInvestorPref === key
                              ? "bg-background border-amber-500 text-foreground font-medium shadow-xs"
                              : "bg-background/50 border-border hover:bg-background text-muted-foreground",
                          )}
                        >
                          <RadioGroupItem value={key} id={`pref-${key}`} />
                          <span>{INVESTOR_UPDATE_LABELS[key]}</span>
                        </label>
                      ))}
                    </RadioGroup>

                    {errors.investor_update_preference && (
                      <p className="text-xs text-destructive font-medium">
                        {errors.investor_update_preference.message}
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* Seção PARCEIRO (se PARCEIRO ou AMBOS) */}
              {(selectedInterest === "PARCEIRO" || selectedInterest === "AMBOS") && (
                <div className="space-y-4 pt-4 border-t border-amber-500/20 bg-amber-500/5 p-4 sm:p-5 rounded-xl animate-in fade-in duration-300">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400 font-bold text-sm">
                      <Building2 className="w-4 h-4" />
                      <span>Parceria & Expansão</span>
                    </div>
                    <p className="text-sm font-medium text-foreground">
                      Queremos levar a CARONAA para instituições, universidades e empresas onde
                      existam pessoas com trajetos recorrentes.
                    </p>
                  </div>

                  <div className="space-y-3 pt-2">
                    <div className="space-y-2">
                      <Label htmlFor="institution_name" className="text-sm font-semibold">
                        Nome da instituição, empresa ou universidade{" "}
                        <span className="text-amber-600">*</span>
                      </Label>
                      <Input
                        id="institution_name"
                        placeholder="Ex.: UNIFOR, Hub de Inovação, Empresa X"
                        {...register("institution_name")}
                      />
                      {errors.institution_name && (
                        <p className="text-xs text-destructive font-medium">
                          {errors.institution_name.message}
                        </p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label className="text-sm font-semibold">
                        Tipo da instituição <span className="text-amber-600">*</span>
                      </Label>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                        {(Object.keys(INSTITUTION_TYPE_LABELS) as unknown as InstitutionType[]).map(
                          (typeKey) => (
                            <button
                              type="button"
                              key={typeKey}
                              onClick={() =>
                                setValue("institution_type", typeKey, { shouldValidate: true })
                              }
                              className={cn(
                                "p-2.5 rounded-lg border text-xs font-medium text-left transition-colors",
                                currentInstitutionType === typeKey
                                  ? "bg-background border-amber-500 text-foreground shadow-xs ring-1 ring-amber-500/20 font-semibold"
                                  : "bg-background/60 border-border text-muted-foreground hover:text-foreground",
                              )}
                            >
                              {INSTITUTION_TYPE_LABELS[typeKey]}
                            </button>
                          ),
                        )}
                      </div>
                      {errors.institution_type && (
                        <p className="text-xs text-destructive font-medium">
                          {errors.institution_type.message}
                        </p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <LocationAutocomplete
                        id="institution_address"
                        label="Endereço detalhado da instituição"
                        value={watch("institution_address") || ""}
                        onChange={(val, details) =>
                          setValue("institution_address", details?.formattedAddress || val, {
                            shouldValidate: true,
                          })
                        }
                        placeholder="Ex.: Av. Washington Soares, 1321 - Edson Queiroz, Fortaleza - CE"
                        variant="simple"
                        helperText="Ajuda nossa equipe a mapear densidade e polos de deslocamento compatíveis."
                      />
                    </div>

                    <div className="space-y-2 pt-1">
                      <Label className="text-sm font-semibold">
                        Como gostaria de colaborar? <span className="text-amber-600">*</span>
                      </Label>

                      <RadioGroup
                        value={currentPartnershipType || ""}
                        onValueChange={(val) =>
                          setValue("partnership_type", val as PartnershipType, {
                            shouldValidate: true,
                          })
                        }
                        className="space-y-2"
                      >
                        {(Object.keys(PARTNERSHIP_TYPE_LABELS) as unknown as PartnershipType[]).map(
                          (key) => (
                            <label
                              key={key}
                              htmlFor={`part-${key}`}
                              className={cn(
                                "flex items-center gap-3 p-3 rounded-lg border text-xs sm:text-sm cursor-pointer transition-colors",
                                currentPartnershipType === key
                                  ? "bg-background border-amber-500 text-foreground font-medium shadow-xs"
                                  : "bg-background/50 border-border hover:bg-background text-muted-foreground",
                              )}
                            >
                              <RadioGroupItem value={key} id={`part-${key}`} />
                              <span>{PARTNERSHIP_TYPE_LABELS[key]}</span>
                            </label>
                          ),
                        )}
                      </RadioGroup>

                      {currentPartnershipType === "OUTRO" && (
                        <div className="mt-2 animate-in fade-in duration-200">
                          <Input
                            placeholder="Descreva brevemente o formato de parceria..."
                            {...register("partnership_type_custom")}
                          />
                          {errors.partnership_type_custom && (
                            <p className="text-xs text-destructive font-medium mt-1">
                              {errors.partnership_type_custom.message}
                            </p>
                          )}
                        </div>
                      )}

                      {errors.partnership_type && (
                        <p className="text-xs text-destructive font-medium">
                          {errors.partnership_type.message}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Mensagem / Dúvida / Sugestão Obrigatória */}
              <div className="space-y-2 pt-2 border-t border-border/70">
                <Label htmlFor="message" className="text-sm font-bold flex items-center gap-2">
                  <span>Existe algo que você gostaria de nos dizer, sugerir ou perguntar?</span>
                  <span className="text-amber-600">*</span>
                </Label>
                <Textarea
                  id="message"
                  rows={4}
                  placeholder="Compartilhe suas ideias, impressões sobre o pitch, perguntas sobre a tecnologia ou o modelo de validação..."
                  className="resize-none"
                  {...register("message")}
                />
                {errors.message && (
                  <p className="text-xs text-destructive font-medium">{errors.message.message}</p>
                )}
              </div>

              {/* Consentimentos */}
              <div className="space-y-3 pt-2 border-t border-border/70">
                <div className="flex items-start space-x-2.5">
                  <Checkbox
                    id="consent_contact"
                    checked={consentContactValue}
                    onCheckedChange={(checked) =>
                      setValue("consent_contact", Boolean(checked), { shouldValidate: true })
                    }
                    className="mt-0.5"
                  />
                  <Label
                    htmlFor="consent_contact"
                    className="text-xs sm:text-sm text-foreground/90 font-normal leading-snug cursor-pointer"
                  >
                    Concordo que a CARONAA utilize meus dados de contato para entrar em contato
                    comigo sobre a finalidade que selecionei.{" "}
                    <span className="text-amber-600 font-semibold">*</span>
                  </Label>
                </div>
                {errors.consent_contact && (
                  <p className="text-xs text-destructive font-medium pl-6">
                    {errors.consent_contact.message}
                  </p>
                )}

                <div className="flex items-start space-x-2.5">
                  <Checkbox
                    id="consent_newsletter"
                    checked={consentNewsletterValue}
                    onCheckedChange={(checked) =>
                      setValue("consent_newsletter", Boolean(checked), { shouldValidate: true })
                    }
                    className="mt-0.5"
                  />
                  <Label
                    htmlFor="consent_newsletter"
                    className="text-xs sm:text-sm text-muted-foreground font-normal leading-snug cursor-pointer"
                  >
                    (Opcional) Quero receber novidades e resultados da evolução da CARONAA.
                  </Label>
                </div>
              </div>

              {/* Botão de Envio */}
              <div className="pt-4">
                <Button
                  type="submit"
                  disabled={isSubmitting}
                  size="lg"
                  className="w-full bg-gradient-to-r from-amber-500 via-amber-600 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-slate-950 font-bold text-base h-13 rounded-xl shadow-lg shadow-amber-500/20 gap-2 transition-all"
                >
                  {isSubmitting ? (
                    <>Enviando contato...</>
                  ) : (
                    <>
                      <span>Quero acompanhar a CARONAA</span>
                      <ArrowRight className="w-5 h-5 stroke-[2.5]" />
                    </>
                  )}
                </Button>
                <p className="text-center text-[11px] text-muted-foreground mt-2">
                  Seus dados são protegidos e utilizados exclusivamente para comunicação da CARONAA.
                </p>
              </div>
            </form>
          </CardContent>
        </Card>
      </main>

      {/* Footer */}
      <footer className="max-w-2xl mx-auto w-full text-center py-4 text-xs text-muted-foreground">
        <p>© {new Date().getFullYear()} CARONAA — Conectando pessoas e otimizando trajetos.</p>
      </footer>
    </div>
  );
}
