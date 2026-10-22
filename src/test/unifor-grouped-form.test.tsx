import {beforeEach,describe,expect,it,vi} from "vitest";
import {fireEvent,render,screen} from "@testing-library/react";
import {PublicResearchForm} from "@/components/research/PublicResearchForm";
import {UNIFOR_FORM_ID} from "@/lib/unifor-launch";

const api=vi.hoisted(()=>({configuration:vi.fn()}));
vi.mock("@/integrations/supabase/client",()=>({
 supabase:{
  rpc: async () => ({ error: null, data: { startsOn: null, endsOn: null, state: "ABERTO" } }),
  from:(table:string)=>{
   const chain={
    select:()=>chain,ilike:()=>chain,eq:()=>chain,not:()=>chain,order:()=>chain,limit:()=>chain,
    maybeSingle:async()=>({error:null,data:table==="research_forms"
     ?{id:UNIFOR_FORM_ID,title:"UNIFOR",mobility_configured:true,brand_image_path:null}
     :{id:"version2",schema_json:{sections:[{
       title:"Sua rotina",questions:[
        {id:"academic",label:"Qual é seu vínculo com a universidade?",type:"single_choice",semanticCode:"ACADEMIC_ROLE",required:true,options:["ESTUDANTE","COLABORADOR"]},
        {id:"transport",label:"Como costuma ir ou voltar?",type:"multiple_choice",semanticCode:"TRANSPORT_MODE",required:true,options:["ONIBUS","CARRO"]},
        {id:"cost",label:"Quanto gasta por trecho?",type:"number",semanticCode:"COST_PER_TRIP",required:false,options:[]},
        {id:"pains",label:"Quais são as duas maiores dificuldades?",type:"multiple_choice",semanticCode:"MOBILITY_PAINS",required:true,options:["DOR_01","DOR_02"],maxValue:2},
        {id:"primary",label:"Qual a principal dificuldade?",type:"single_choice",semanticCode:"URBAN_PRIMARY_PAIN",required:true,options:["DOR_01","DOR_02"]},
       ]}]}}
    })
   };return chain;
  },
 },
}));
vi.mock("@/lib/formulario/research-configuration-service",()=>({
 getPublicResearchConfiguration:api.configuration,submitConfiguredResearch:vi.fn(),
}));
vi.mock("@/components/formulario/LocationAutocomplete",()=>({LocationAutocomplete:()=>null}));

describe("UNIFOR grouped journey on mobile",()=>{
 beforeEach(()=>{vi.clearAllMocks();api.configuration.mockResolvedValue({revision:1,settings:{
   templateKey:"UNIVERSIDADE_URBANA_CARONAA",institutionName:"UNIFOR",publicName:"UNIFOR",
   campus:"",launchDate:"2026-11-04",profiles:["PASSAGEIRO","MOTORISTA","AMBOS"],
   modes:["CARONA"],days:[1,2,3,4,5],outboundTimes:["07:00"],returnTimes:["18:00"],
   flexibilityMinutes:15,safeMeetingPoints:[],address:"",latitude:null,longitude:null,
 }})});
 it("puts academic role on the same first screen and groups transport with cost",async()=>{
  const {container}=render(<PublicResearchForm code="0K9K09K" />);
  expect(await screen.findByText("Como pretende participar?")).toBeInTheDocument();
  expect(screen.getByLabelText(/Qual é seu vínculo com a universidade/i)).toBeInTheDocument();
  expect(screen.getByText(/Etapa 1 de 6/)).toBeInTheDocument();
  expect(container.querySelector("#research-step-content")?.className).not.toContain("flex-1");
  fireEvent.click(screen.getByRole("radio",{name:/Quero encontrar carona/i}));
  fireEvent.change(screen.getByLabelText(/Qual é seu vínculo com a universidade/i),{target:{value:"ESTUDANTE"}});
  fireEvent.click(screen.getByRole("button",{name:/Continuar/}));
  expect(await screen.findByRole("group",{name:/Como costuma ir ou voltar/i})).toBeInTheDocument();
  expect(screen.getByLabelText("Quanto gasta por trecho?")).toBeInTheDocument();
  expect(screen.getByText(/Etapa 2 de 6/)).toBeInTheDocument();
  fireEvent.click(screen.getByRole("checkbox",{name:/Ônibus|Onibus/i}));
  fireEvent.click(screen.getByRole("button",{name:/Continuar/}));
  expect(await screen.findByRole("group",{name:/Quais são suas maiores dificuldades no deslocamento/i})).toBeInTheDocument();
  expect(screen.queryByText("Qual a principal dificuldade?")).not.toBeInTheDocument();
  expect(screen.getByText(/primeira escolhida/i)).toBeInTheDocument();
 });
});
