import { beforeEach,describe,expect,it,vi } from "vitest";
import { readFileSync } from "node:fs";
import {
  academicResearchTemplate,displaySurveyDate,
  getResearchWindowState,validateSurveyWindow,validSurveyDate,
} from "./research-window";
import { URBAN_UNIVERSITY_KEY } from "./urban-university";
import { REGIONAL_UNIVERSITY_KEY } from "./regional-university";
import { createUniforGroups } from "./unifor-compact-groups";
import type { SurveySchema } from "./research-templates";
const api=vi.hoisted(()=>({rpc:vi.fn()}));
vi.mock("@/integrations/supabase/client",()=>({supabase:{rpc:api.rpc}}));
const read=(path:string)=>readFileSync(path,"utf8");

describe("Timed university research: independent schedule and consistent presentation",()=>{
 beforeEach(()=>vi.clearAllMocks());
 it("requires a valid start and end, and accepts the same day inclusively",()=>{
  expect(validSurveyDate("2026-11-01")).toBe(true);
  expect(validSurveyDate("2026-02-30")).toBe(false);
  expect(validSurveyDate("2026-2-1")).toBe(false);
  expect(validateSurveyWindow("2026-11-01","2026-11-01")).toBeNull();
  expect(validateSurveyWindow("","2026-11-02")).toMatch(/início/);
  expect(validateSurveyWindow("2026-11-03","2026-11-02")).toMatch(/encerramento/);
  expect(displaySurveyDate("2026-11-01")).toBe("01/11/2026");
 });
 it("uses the same compact presentation for both university models without changing their schemas",()=>{
  expect(academicResearchTemplate(URBAN_UNIVERSITY_KEY)).toBe(true);
  expect(academicResearchTemplate(REGIONAL_UNIVERSITY_KEY)).toBe(true);
  expect(academicResearchTemplate("CUSTOM")).toBe(false);
  expect(academicResearchTemplate(null,true)).toBe(true);
  const schema:SurveySchema={sections:[{title:"Rotina",questions:[
   {id:"one",label:"Uma pergunta",type:"yes_no",options:[],required:true},
   {id:"two",label:"Outra pergunta",type:"yes_no",options:[],required:true},
   {id:"three",label:"Última pergunta",type:"yes_no",options:[],required:true},
  ]}]};
  const grouped=createUniforGroups(schema,{},true);
  expect(grouped[0]).toHaveLength(2);
  expect(grouped[0].flatMap(x=>x.questions).map(x=>x.id)).toEqual(["one","two","three"]);
  expect(schema.sections[0].questions).toHaveLength(3);
  expect(createUniforGroups(schema,{})[0]).toHaveLength(3);
 });
 it("distinguishes scheduled, open and closed public surveys",async()=>{
  api.rpc.mockResolvedValueOnce({data:{startsOn:"2026-11-01",endsOn:"2026-11-15",state:"AGENDADO"},error:null});
  await expect(getResearchWindowState("CODE")).resolves.toMatchObject({state:"AGENDADO"});
  expect(api.rpc).toHaveBeenCalledWith("get_research_window_state",{p_code:"CODE"});
  api.rpc.mockResolvedValueOnce({data:{startsOn:null,endsOn:null,state:"ABERTO"},error:null});
  await expect(getResearchWindowState("LEGACY")).resolves.toMatchObject({state:"ABERTO"});
  api.rpc.mockResolvedValueOnce({data:{startsOn:"2026-11-01",endsOn:"2026-11-15",state:"ENCERRADO"},error:null});
  await expect(getResearchWindowState("ENDED")).resolves.toMatchObject({state:"ENCERRADO"});
 });
 it("enforces response windows server-side and keeps optional launch independent",()=>{
  const sql=read("drizzle/migrations/0110_research_survey_window.sql");
  expect(sql).toContain("CREATE OR REPLACE FUNCTION public.create_scheduled_research_form(");
  expect(sql).toContain("CREATE TRIGGER research_answer_window_guard");
  expect(sql).toContain("BEFORE INSERT ON public.research_answers");
  expect(sql).toContain("p_ends_on < p_starts_on");
  expect(sql).toContain("caronaa_presence_on");
  expect(sql).toContain("America/Fortaleza");
  expect(sql).toContain("p_settings IS NULL");
  expect(sql).not.toMatch(/DELETE FROM public.research_forms/);
  expect(sql).not.toMatch(/UPDATE public.research_answers/);
  const catalog=read("src/components/admin/ResearchCatalog.tsx");
  expect(catalog).toContain("Início das respostas *");
  expect(catalog).toContain("Encerramento das respostas *");
  expect(catalog).toContain("Data prevista de presença ou operação do CARONAA (opcional)");
  const publicForm=read("src/components/research/PublicResearchForm.tsx");
  expect(publicForm).toContain('windowState?.state === "AGENDADO"');
  expect(publicForm).toContain('windowState?.state === "ENCERRADO"');
  expect(publicForm).toContain("form.caronaaPresenceOn || form.configuration?.settings.launchDate");
 });
});
