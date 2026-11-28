import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const state=vi.hoisted(()=>({native:false,user:null as null|{id:string},role:"MOTORISTA",read:vi.fn(),webRead:vi.fn(),webGps:vi.fn(),nativeSettings:vi.fn()}));
vi.mock("@/lib/auth-context",()=>({useAuth:()=>({user:state.user})}));
vi.mock("@/integrations/supabase/client",()=>({supabase:{from:()=>({select:()=>({eq:()=>({maybeSingle:async()=>({data:{active_role:state.role},error:null})})})})}}));
vi.mock("@/lib/native/capacitor-bridge",()=>({isNativeAndroid:()=>state.native,onNativeAppResume:()=>()=>{}}));
vi.mock("@/lib/native/driver-notifications",()=>({testRideAlertSound:vi.fn()}));
vi.mock("@/lib/native/web-permission-setup",()=>({readWebSetupStatus:state.webRead,requestWebSetupLocation:state.webGps,requestWebSetupNotifications:vi.fn()}));
vi.mock("@/lib/native/permission-setup",()=>({readSetupStatus:state.read,openSetupSettings:state.nativeSettings,requestSetupGps:vi.fn(),requestSetupNotifications:vi.fn(),setupSeenKey:(id:string,driver:boolean,platform:string)=>platform+id+driver,setupStatusLabel:(v?:boolean)=>v===true?"Ativo":v===false?"Pendente":"Verificar",nextSetupStep:()=>undefined}));
import { NativePermissionSetup, NativePermissionSetupFab, NativePermissionSetupHeaderButton } from "@/components/caronaa/NativePermissionSetup";
beforeEach(()=>{vi.clearAllMocks();localStorage.clear();state.native=false;state.user=null;state.webRead.mockResolvedValue({notifications:false,siteLocation:false});state.read.mockResolvedValue({notifications:false,preciseLocation:false});state.webGps.mockResolvedValue(true);state.nativeSettings.mockResolvedValue(true);});
afterEach(cleanup);
describe("permission center UI",()=>{
  it("opens from the map on web and requests site location only on tap",async()=>{
    render(<><NativePermissionSetupFab/><NativePermissionSetup><span>Tutorial</span></NativePermissionSetup></>);
    fireEvent.click(screen.getByRole("button",{name:"Abrir painel de permissões"}));
    expect(await screen.findByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText("Localização do site")).toBeInTheDocument();
    expect(state.webGps).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button",{name:"Permitir localização"}));
    await waitFor(()=>expect(state.webGps).toHaveBeenCalledOnce());
    expect(state.nativeSettings).not.toHaveBeenCalled();
  });
  it("opens from the persistent header for an Android driver",async()=>{
    state.native=true;state.user={id:"driver"};localStorage.setItem("androiddrivertrue","yes");
    render(<><NativePermissionSetupHeaderButton/><NativePermissionSetup><span>Tutorial</span></NativePermissionSetup></>);
    await screen.findByText("Tutorial");
    fireEvent.click(screen.getByRole("button",{name:"Configurar permissões"}));
    expect(await screen.findByText("Bateria sem restrições")).toBeInTheDocument();
    expect(screen.getByText("Localização precisa")).toBeInTheDocument();
    expect(screen.queryByText("Localização do site")).toBeNull();
    fireEvent.click(screen.getByRole("button",{name:"Configurar notificações"}));
    await waitFor(()=>expect(state.nativeSettings).toHaveBeenCalledWith("notifications"));
  });
  it("opens first access in the browser without asking permissions silently",async()=>{
    state.user={id:"new-user"};
    render(<NativePermissionSetup><span>Tutorial</span></NativePermissionSetup>);
    expect(await screen.findByRole("dialog")).toBeInTheDocument();
    expect(state.webGps).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button",{name:"Continuar para o app"}));
    expect(await screen.findByText("Tutorial")).toBeInTheDocument();
  });
});
