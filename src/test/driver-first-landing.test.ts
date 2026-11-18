import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { caronaaHomeTarget, resolveCaronaaHomeSurface } from "@/lib/navigation/role-home";

const read=(path:string)=>readFileSync(path,"utf8");

describe("new CARONAA driver: online-first navigation",()=>{
  it("opens professional availability for ANY registered MOTORISTA, even if authorization is pending",()=>{
    for(const professionalAuthorized of [true,false]){
      expect(caronaaHomeTarget(resolveCaronaaHomeSurface({
        authenticated:true,activeRole:"MOTORISTA",professionalAuthorized,
      }))).toEqual({to:"/disponibilidade-profissional"});
    }
    expect(caronaaHomeTarget(resolveCaronaaHomeSurface({
      authenticated:true,activeRole:"PASSAGEIRO",professionalAuthorized:false,
    }))).toEqual({to:"/home"});
  });

  it("never sends a newly completed vehicle to shared-driver scheduling by default",()=>{
    const registration=read("src/routes/_authenticated/cadastro-veiculo.tsx");
    expect(registration).toContain('else await navigate({to:"/disponibilidade-profissional",replace:true})');
    expect(registration).not.toContain('else await navigate({to:"/home",search:{intent:"offer"},replace:true})');
    expect(registration).toContain('active_role:"MOTORISTA"');
  });

  it("redirects legacy /home bookmarks only when no activity was explicitly requested",()=>{
    const home=read("src/routes/_authenticated/home.tsx");
    expect(home).toContain('roleRow?.active_role==="MOTORISTA"&&!activityIntent');
    expect(home).toContain('(location.search as {trips?:string}).trips!=="open"');
    expect(home).toContain('throw redirect({to:"/disponibilidade-profissional",replace:true})');
    expect(home).not.toContain('if(!accessError&&access?.authorized===true)');
  });

  it("offers scheduled carpool from the side drawer rather than showing its dashboard on entry",()=>{
    const drawer=read("src/components/caronaa/MobileAccountDrawer.tsx");
    const home=read("src/routes/_authenticated/home.tsx");
    expect(drawer).toContain("Trabalhar como motorista");
    expect(drawer).toContain("Oferecer carona agendada");
    expect(drawer).toContain('search={{intent:"offer"}}');
    expect(drawer).toContain('search={{trips:"open"}}');
    expect(home).toContain('setDriverHomeOpen(false);');
    expect(home).toContain('await navigate({to:"/disponibilidade-profissional",replace:true})');
  });

  it("does not bypass professional authorization, fees or explicit GPS consent",()=>{
    const shell=read("src/components/caronaa/AppShell.tsx");
    const availability=read("src/components/caronaa/ProfessionalAvailabilityPage.tsx");
    expect(shell).toContain('professionalOnly: !roleRow.error && activeRole === "MOTORISTA"');
    expect(availability).toContain('online={enabled && authorized && !blocked}');
    expect(availability).toContain('disabled={!ready||busy||(enabled&&activeQuickRide)||(!enabled&&(blocked||(!authorized&&!pilotEnabled)))}');
    expect(availability).toContain('professionalRadarConsentKey(userId)');
    expect(availability).toContain("Concluir cadastro e habilitar corridas");
  });
});
