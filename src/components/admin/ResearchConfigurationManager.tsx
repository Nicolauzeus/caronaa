import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  newResearchConfiguration,
  type ResearchConfiguration,
} from "@/lib/formulario/research-configuration";
import { saveResearchConfiguration } from "@/lib/formulario/research-configuration-service";
import { ResearchConfigurationFields } from "./ResearchConfigurationFields";
import { Button } from "@/components/ui/button";
import { CORPORATE_INTERNAL_KEY, validateCorporateInternalConfiguration } from "@/lib/formulario/corporate-internal";
import { CorporateResearchAccessManager } from "./CorporateResearchAccessManager";
export function ResearchConfigurationManager({ formId }: { formId: string }) {
  const [settings, setSettings] = useState<ResearchConfiguration>(newResearchConfiguration);
  const [revision, setRevision] = useState(0),
    [loading, setLoading] = useState(true),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  const [loadFailed, setLoadFailed] = useState(false);
  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    setLoadFailed(false);
    void (
      supabase as unknown as {
        from: (name: string) => {
          select: (s: string) => {
            eq: (
              key: string,
              id: string,
            ) => {
              maybeSingle: () => Promise<{
                data: { revision: number; settings: ResearchConfiguration } | null;
                error: unknown;
              }>;
            };
          };
        };
      }
    )
      .from("research_configurations")
      .select("revision,settings")
      .eq("form_id", formId)
      .maybeSingle()
      .then((result) => {
        if (!active) return;
        if (result.error) {
          setLoadFailed(true);
          setError("Configuração indisponível. Verifique a implantação com a equipe responsável.");
        } else {
          setSettings({
            ...newResearchConfiguration(),
            ...result.data?.settings,
            profileSchedules: result.data?.settings?.profileSchedules ?? [],
          });
          setRevision(result.data?.revision ?? 0);
        }
      })
      .catch(() => {
        if (active) {
          setLoadFailed(true);
          setError("Não foi possível carregar a configuração.");
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [formId]);
  if (loading) return <p role="status">Carregando configuração…</p>;
  return (
    <section className="space-y-3">
      <h3 className="text-lg font-semibold">Configuração institucional</h3>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      {notice && (
        <p role="status" className="text-sm">
          {notice}
        </p>
      )}
      <ResearchConfigurationFields value={settings} onChange={setSettings} />
      {settings.templateKey===CORPORATE_INTERNAL_KEY && <CorporateResearchAccessManager formId={formId} />}
      <Button
        disabled={busy || loadFailed}
        onClick={async () => {
          setBusy(true);
          setNotice("");
          try {
            if (settings.templateKey===CORPORATE_INTERNAL_KEY) {
              const issues=validateCorporateInternalConfiguration(settings);
              if (issues.length) throw Error(issues[0]);
            }
            const next = await saveResearchConfiguration(formId, settings, revision);
            setRevision(next);
            setError("");
            setNotice("Configuração salva. As respostas anteriores mantêm o contexto original.");
          } catch (reason) {
            setError(reason instanceof Error ? reason.message : "Não foi possível salvar.");
          } finally {
            setBusy(false);
          }
        }}
      >
        Salvar configuração
      </Button>
    </section>
  );
}
