import { beforeEach,describe,expect,it,vi } from "vitest";
import { fireEvent,render,screen,waitFor } from "@testing-library/react";
import { PublicResearchForm } from "@/components/research/PublicResearchForm";
import { UNIFOR_FORM_ID } from "@/lib/unifor-launch";

const api=vi.hoisted(()=>({config:vi.fn()}));
vi.mock("@/integrations/supabase/client",()=>({
  supabase:{
    rpc: async () => ({ error: null, data: { startsOn: null, endsOn: null, state: "ABERTO" } }),
    from:(table:string)=>{
      const chain={
        select:()=>chain,ilike:()=>chain,eq:()=>chain,not:()=>chain,
        order:()=>chain,limit:()=>chain,
        maybeSingle:async()=>({error:null,data:table==="research_forms"?
          {id:UNIFOR_FORM_ID,title:"UNIFOR",mobility_configured:true,
            brand_image_path:null,brand_image_alt:null,brand_display_name:null}:
          {id:"version",schema_json:{sections:[{title:"Seção da UNIFOR",questions:[
            {id:"first",label:"Qual é sua rotina?",type:"single_choice",required:true,options:["A","B"]},
            {id:"second",label:"Qual é sua região?",type:"short_text",required:true,options:[]},
          ]}]}}
        }),
      };
      return chain;
    },
  },
}));
vi.mock("@/lib/formulario/research-configuration-service",()=>({
  getPublicResearchConfiguration:api.config,
  submitConfiguredResearch:vi.fn(),
}));
vi.mock("@/components/formulario/LocationAutocomplete",()=>({
 LocationAutocomplete:()=>null,
}));

describe("UNIFOR fullscreen progressive form",()=>{
  beforeEach(()=>{
    api.config.mockResolvedValue({revision:1,settings:{
      templateKey:"UNIVERSIDADE_URBANA_CARONAA",institutionName:"UNIFOR",
      publicName:"UNIFOR",campus:"",serviceState:"PLANEJADO",
      launchDate:"2026-11-04",profiles:["PASSAGEIRO","MOTORISTA","AMBOS"],
      modes:["CARONA"],days:[1,2,3,4,5],outboundTimes:["07:00"],
      returnTimes:["18:00"],flexibilityMinutes:15,safeMeetingPoints:[],
      institutionId:"UNIFOR",region:"Fortaleza",address:"",latitude:null,longitude:null,
      priceReference:"",partnershipConfirmed:false,partnershipDescription:"",
      usagePolicy:"Pesquisa sem reserva"
    }});
  });
  it("first selects an explicit profile, then shows only one question per screen",async()=>{
    const {container}=render(<PublicResearchForm code="UNIFOR" />);
    await screen.findByText("Como pretende participar?");
    expect(container.querySelector("main")?.className).toContain("overflow-hidden");
    expect(screen.queryByText("Qual é sua rotina?")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("radio",{name:/Quero encontrar carona/}));
    fireEvent.click(screen.getByRole("button",{name:/Continuar/}));
    expect(await screen.findByText("Qual é sua rotina?")).toBeInTheDocument();
    expect(screen.queryByText("Qual é sua região?")).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(/Qual é sua rotina/),{target:{value:"A"}});
    fireEvent.click(screen.getByRole("button",{name:/Continuar/}));
    expect(await screen.findByText("Qual é sua região?")).toBeInTheDocument();
    expect(screen.queryByText("Qual é sua rotina?")).not.toBeInTheDocument();
    expect(screen.getByText(/Etapa 3 de/)).toBeInTheDocument();
  });
});
