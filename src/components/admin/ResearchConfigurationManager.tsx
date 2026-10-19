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
import {
  getResearchLaunchAdminState,
  setResearchLaunchReleased,
  type ResearchLaunchAdminState,
} from "@/lib/research-launch";
export function ResearchConfigurationManager({ formId }: { formId: string }) {
  const [settings, setSettings] = useState<ResearchConfiguration>(newResearchConfiguration);
  const [launch, setLaunch] = useState<ResearchLaunchAdminState | null>(null);
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
  useEffect(() => {
    let alive = true;
    void getResearchLaunchAdminState(formId)
      .then(result => { if (alive) setLaunch(result); })
      .catch(() => { if (alive) setLaunch(null); });
    return () => { alive = false; };
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
      {settings.launchDate && (
        <section aria-label="Controle de lançamento" className="space-y-2 rounded-xl border border-primary/25 bg-primary/5 p-4">
          <h4 className="text-sm font-bold">Acesso antes do lançamento</h4>
          <p className="text-xs leading-5 text-muted-foreground">
            Participantes vinculados ao formulário verão uma tela de espera até {settings.launchDate},
            sem acesso a corridas. A data usa o fuso horário definido na configuração.
            A vinculação comprova participação, não matrícula ou vínculo empregatício.
          </p>
          <p className="text-xs font-semibold">{launch ? (launch.released
            ? "Acesso liberado antecipadamente"
            : "Acesso bloqueado até a data programada") : "Consultando a situação do lançamento…"}</p>
          <Button variant="outline" type="button" disabled={busy || !launch || settings.launchDate!==launch.launchDate}
            onClick={async()=>{
              if(!launch) return;
              const next = !launch.released;
              const question = next
                ? "Liberar agora o aplicativo para os participantes vinculados a este formulário?"
                : "Reativar a tela de espera até a data programada?";
              if(!window.confirm(question)) return;
              setBusy(true);setNotice("");setError("");
              try {
                await setResearchLaunchReleased(formId,next);
                setLaunch(await getResearchLaunchAdminState(formId));
                setNotice(next?"Acesso liberado antecipadamente.":"Tela de espera reativada.");
              } catch(err) {
                setError(err instanceof Error?err.message:"Não foi possível alterar a liberação.");
              } finally { setBusy(false); }
            }}>
            {launch?.released?"Reativar espera":"Liberar acesso agora"}
          </Button>
          {settings.launchDate!==launch?.launchDate &&
            <p className="text-xs text-amber-600">Salve a nova data antes de alterar a liberação.</p>}
        </section>
      )}
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
            setLaunch(await getResearchLaunchAdminState(formId).catch(()=>null));
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
