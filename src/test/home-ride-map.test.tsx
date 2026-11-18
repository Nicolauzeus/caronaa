import { act, render, waitFor, fireEvent, screen, cleanup } from "@testing-library/react";
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { HomeRideMap } from "@/components/caronaa/HomeRideMap";
import { getGoogleMapsBrowserKey } from "@/lib/google-maps-browser.functions";
import { getMapDrivingRoute } from "@/lib/map-routing.functions";
import { loadGoogleMaps, onGoogleMapsAuthFailure } from "@/lib/google-maps-loader";
const api = vi.hoisted(() => ({
  create: vi.fn(), panTo: vi.fn(), setCenter: vi.fn(), fitBounds: vi.fn(),
  on: vi.fn(), marker: vi.fn(), markerMove:vi.fn(), circle: vi.fn(), clear: vi.fn(), polyline: vi.fn(),
}));
vi.mock("@tanstack/react-start", () => ({ useServerFn: (fn: unknown) => fn }));
vi.mock("@/lib/google-maps-browser.functions", () => ({getGoogleMapsBrowserKey: vi.fn()}));
vi.mock("@/lib/google-maps-loader", () => ({loadGoogleMaps: vi.fn(),onGoogleMapsAuthFailure: vi.fn(() => vi.fn())}));
vi.mock("@/lib/map-routing.functions", () => ({getMapDrivingRoute: vi.fn()}));
const base = {
  userPosition: {lat:-3.73,lng:-38.52,accuracy:20},
  originIsCurrent:true,following:true,recenterVersion:0,locating:false,
  onDrag:vi.fn(),onRecenter:vi.fn(),
};
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getGoogleMapsBrowserKey).mockResolvedValue("test-browser");
  vi.mocked(loadGoogleMaps).mockResolvedValue();
  vi.mocked(getMapDrivingRoute).mockResolvedValue({
    routePath:[{lat:-3.73,lng:-38.52},{lat:-3.79,lng:-38.48}],distanceKm:11,durationMinutes:20,
    legs:[{distanceKm:11,durationMinutes:20}],
  });
  vi.stubGlobal("matchMedia",vi.fn(()=>({matches:false,addEventListener:vi.fn(),removeEventListener:vi.fn()})));
  vi.stubGlobal("google", {maps: {
    Map:class {
      constructor(_element:unknown,options:unknown){api.create(options);}
      addListener=api.on;panTo=api.panTo;setCenter=api.setCenter;fitBounds=api.fitBounds;
    },
    Marker:class {
      point:{lat:number;lng:number};title:string;
      constructor(options:{position:{lat:number;lng:number};title:string}){
        this.point=options.position;this.title=options.title;api.marker(options);
      }
      setMap=api.clear;
      getTitle=()=>this.title;
      setTitle=(title:string)=>{this.title=title;};
      getPosition=()=>({lat:()=>this.point.lat,lng:()=>this.point.lng});
      setPosition=(point:{lat:number;lng:number})=>{this.point=point;api.markerMove(point);};
    },
    Circle:class {
      radius:number;
      constructor(options:{radius:number}){this.radius=options.radius;api.circle(options);}
      setMap=api.clear;
      getRadius=()=>this.radius;
      setCenter=vi.fn();
      setRadius=(value:number)=>{this.radius=value;};
    },
    Polyline:class {constructor(options:unknown){api.polyline(options);}setMap=api.clear;},
    LatLngBounds:class {extend=vi.fn();},SymbolPath:{CIRCLE:"circle"},
  }});
});
afterEach(()=>{cleanup();vi.unstubAllGlobals();});
describe("Google home map",()=>{
  it("renders Google markers, GPS accuracy and official road geometry",async()=>{
    const {container}=render(<HomeRideMap {...base} origin={{lat:-3.73,lng:-38.52}} destination={{lat:-3.79,lng:-38.48}}/>);
    await waitFor(()=>expect(api.fitBounds).toHaveBeenCalled());
    expect(container.querySelector('[data-map-provider="google"]')).toBeTruthy();
    expect(loadGoogleMaps).toHaveBeenCalledWith("test-browser");
    expect(api.circle).toHaveBeenCalledWith(expect.objectContaining({radius:20}));
    expect(screen.getByText(/11,0 km/)).toBeInTheDocument();
  });
  it("labels GPS and destination but marks available radar drivers as unassigned",async()=>{
    render(<HomeRideMap {...base} destination={{lat:-3.79,lng:-38.48}} professionalDrivers={[{
      driver_key:"available-1",lat:-3.75,lng:-38.51,seen_at:new Date().toISOString(),
    }]}/>);
    await waitFor(()=>expect(api.marker.mock.calls.length).toBeGreaterThanOrEqual(3));
    const markers=api.marker.mock.calls.map(([options])=>options as {title:string;icon:{url:string}});
    const decoded=(title:string)=>{
      const marker=markers.find(m=>m.title.includes(title));expect(marker).toBeDefined();
      return decodeURIComponent(marker!.icon.url.split(",")[1]);
    };
    expect(decoded("Você · localização GPS")).toContain("Você");
    expect(decoded("Destino")).toContain("Destino");
    expect(decoded("Motorista disponível no radar")).toContain('width="48"');
    expect(screen.getByText(/ainda não atribuídos à viagem/i)).toBeInTheDocument();
  });
  it("não desenha o pino Você nem círculo para GPS de 1029m no modo estrito",async()=>{
    render(<HomeRideMap {...base} userPosition={{lat:-3.73,lng:-38.52,accuracy:1029}}
      origin={{lat:-3.73,lng:-38.52}} destination={{lat:-3.76,lng:-38.50}}/>);
    await waitFor(()=>expect(api.marker).toHaveBeenCalled());
    expect(api.marker.mock.calls.map(([config])=>config.title)).toEqual(["Destino"]);
    expect(api.circle).not.toHaveBeenCalled();expect(api.polyline).not.toHaveBeenCalled();
  });
  it.each([85,150,300])("mostra prévia real de passageiro com precisão %sm",async accuracy=>{
    const point={lat:-4.224,lng:-38.71,accuracy};
    render(<HomeRideMap {...base} passengerPreview userPosition={point}
      origin={{lat:point.lat,lng:point.lng}} originAccuracyM={accuracy}/>);
    await waitFor(()=>expect(api.marker).toHaveBeenCalledWith(expect.objectContaining({
      title:"Você · localização aproximada",position:{lat:point.lat,lng:point.lng},
    })));
    expect(api.circle).toHaveBeenCalledWith(expect.objectContaining({
      radius:accuracy,center:{lat:point.lat,lng:point.lng},fillOpacity:0.08,strokeOpacity:0.4,
    }));
    expect(api.panTo).toHaveBeenCalledWith({lat:point.lat,lng:point.lng});
  });
  it("mantém o rótulo GPS confiável para prévia com 20m",async()=>{
    render(<HomeRideMap {...base} passengerPreview/>);
    await waitFor(()=>expect(api.marker).toHaveBeenCalledWith(expect.objectContaining({title:"Você · localização GPS"})));
    expect(api.marker.mock.calls.some(([m])=>m.title==="Você · localização aproximada")).toBe(false);
  });
  it.each([301,1029,-1,Number.NaN,Number.POSITIVE_INFINITY])("não cria posição fictícia com precisão inválida %s",async accuracy=>{
    render(<HomeRideMap {...base} passengerPreview userPosition={{lat:-4.224,lng:-38.71,accuracy}}
      origin={{lat:-4.224,lng:-38.71}} originAccuracyM={accuracy} destination={{lat:-3.76,lng:-38.50}}/>);
    await waitFor(()=>expect(api.marker).toHaveBeenCalled());
    expect(api.marker.mock.calls.map(([m])=>m.title)).toEqual(["Destino"]);
    expect(api.circle).not.toHaveBeenCalled();expect(api.panTo).not.toHaveBeenCalled();
    expect(getMapDrivingRoute).not.toHaveBeenCalled();
  });
  it("não flexibiliza o mapa profissional ou consumidores sem opt-in de passageiro",async()=>{
    render(<HomeRideMap {...base} userPosition={{lat:-4.224,lng:-38.71,accuracy:150}}
      origin={{lat:-4.224,lng:-38.71}} originAccuracyM={150}/>);
    await waitFor(()=>expect(api.create).toHaveBeenCalledOnce());
    expect(api.marker).not.toHaveBeenCalled();expect(api.circle).not.toHaveBeenCalled();
    expect(api.panTo).not.toHaveBeenCalled();
  });
  it("desenha a rota quando o destino foi escolhido antes do primeiro GPS",async()=>{
    const destination={lat:-3.79,lng:-38.48};
    const {rerender}=render(<HomeRideMap {...base} passengerPreview userPosition={null} locating destination={destination}/>);
    await waitFor(()=>expect(api.create).toHaveBeenCalledOnce());
    expect(getMapDrivingRoute).not.toHaveBeenCalled();
    rerender(<HomeRideMap {...base} passengerPreview userPosition={{lat:-3.73,lng:-38.52,accuracy:150}}
      origin={{lat:-3.73,lng:-38.52}} originAccuracyM={150} destination={destination} recenterVersion={1}/>);
    await waitFor(()=>expect(getMapDrivingRoute).toHaveBeenCalledWith(expect.objectContaining({
      data:{points:[{lat:-3.73,lng:-38.52},destination]},
    })));
    expect(api.panTo).toHaveBeenCalledWith({lat:-3.73,lng:-38.52});
  });
  it("não consome a recentralização enquanto o ponto de GPS ainda está pendente",async()=>{
    const {rerender}=render(<HomeRideMap {...base} passengerPreview userPosition={null} following={false}/>);
    await waitFor(()=>expect(api.create).toHaveBeenCalledOnce());
    rerender(<HomeRideMap {...base} passengerPreview userPosition={null} following={false} recenterVersion={1}/>);
    expect(api.panTo).not.toHaveBeenCalled();
    rerender(<HomeRideMap {...base} passengerPreview userPosition={{lat:-4.2,lng:-38.7,accuracy:150}}
      following={false} recenterVersion={1}/>);
    await waitFor(()=>expect(api.panTo).toHaveBeenCalledWith({lat:-4.2,lng:-38.7}));
  });
  it("centraliza quando o GPS chega antes da inicialização do Google Maps",async()=>{
    let finish!:()=>void;
    vi.mocked(loadGoogleMaps).mockImplementationOnce(()=>new Promise<void>(resolve=>{finish=resolve;}));
    const {rerender}=render(<HomeRideMap {...base} passengerPreview userPosition={null}/>);
    await waitFor(()=>expect(loadGoogleMaps).toHaveBeenCalledOnce());
    rerender(<HomeRideMap {...base} passengerPreview userPosition={{lat:-4.2,lng:-38.7,accuracy:150}} recenterVersion={1}/>);
    await act(async()=>finish());
    await waitFor(()=>expect(api.panTo).toHaveBeenCalledWith({lat:-4.2,lng:-38.7}));
    expect(api.create).toHaveBeenCalledOnce();
  });
  it("aceita latitude e longitude zero sem confundir com localização ausente",async()=>{
    render(<HomeRideMap {...base} passengerPreview userPosition={{lat:0,lng:0,accuracy:150}}
      origin={{lat:0,lng:0}} originAccuracyM={150}/>);
    await waitFor(()=>expect(api.marker).toHaveBeenCalledWith(expect.objectContaining({position:{lat:0,lng:0}})));
    expect(api.panTo).toHaveBeenCalledWith({lat:0,lng:0});
    expect(api.circle).toHaveBeenCalledWith(expect.objectContaining({radius:150}));
  });
  it("respeita movimento reduzido ao centralizar uma prévia",async()=>{
    vi.stubGlobal("matchMedia",vi.fn(()=>({matches:true})));
    render(<HomeRideMap {...base} passengerPreview userPosition={{lat:-4.2,lng:-38.7,accuracy:150}}/>);
    await waitFor(()=>expect(api.setCenter).toHaveBeenCalledWith({lat:-4.2,lng:-38.7}));
    expect(api.panTo).not.toHaveBeenCalled();
  });
  it("representa saída manual sem segundo pino falso quando o GPS é impreciso",async()=>{
    const selected={lat:-3.746,lng:-38.533};
    render(<HomeRideMap {...base} userPosition={{lat:-3.73,lng:-38.52,accuracy:1029}}
      originIsCurrent={false} following={false} origin={selected}/>);
    await waitFor(()=>expect(api.marker).toHaveBeenCalled());
    expect(api.marker.mock.calls).toHaveLength(1);
    const marker=api.marker.mock.calls[0][0] as {position:unknown;title:string;icon:{url:string}};
    expect(marker.position).toEqual(selected);expect(marker.title).toContain("Sua saída escolhida");
    expect(decodeURIComponent(marker.icon.url.split(",")[1])).toContain("Você");
    expect(api.circle).not.toHaveBeenCalled();expect(api.panTo).toHaveBeenCalledWith(selected);
  });
  it("mantém saída anteriormente válida quando a leitura ao vivo piora",async()=>{
    const selected={lat:-3.748,lng:-38.535};
    render(<HomeRideMap {...base} userPosition={{lat:-3.73,lng:-38.52,accuracy:310}}
      originIsCurrent originAccuracyM={20} origin={selected} destination={{lat:-3.78,lng:-38.55}}/>);
    await waitFor(()=>expect(api.marker).toHaveBeenCalled());
    const titles=api.marker.mock.calls.map(([m])=>m.title as string);
    expect(titles).toContain("Sua saída registrada · último ponto válido (não ao vivo)");
    expect(titles).not.toContain("Você · localização GPS");expect(api.circle).not.toHaveBeenCalled();
    await waitFor(()=>expect(screen.getByText(/Trajeto pelas ruas/)).toBeInTheDocument());
  });
  it("usa saída manual como único Você mesmo quando GPS distante tem boa precisão",async()=>{
    const selected={lat:-3.77,lng:-38.55};
    const {rerender}=render(<HomeRideMap {...base} passengerPreview originIsCurrent={false} following={false} origin={selected}/>);
    await waitFor(()=>expect(api.marker).toHaveBeenCalled());
    const markers=api.marker.mock.calls.map(([marker])=>marker as {title:string;position:{lat:number;lng:number}});
    expect(markers).toHaveLength(1);expect(markers[0].title).toContain("Sua saída escolhida");
    expect(markers[0].position).toEqual(selected);expect(api.circle).not.toHaveBeenCalled();
    api.panTo.mockClear();api.marker.mockClear();api.markerMove.mockClear();
    rerender(<HomeRideMap {...base} passengerPreview originIsCurrent={false} following={false}
      origin={selected} userPosition={{lat:-4.2,lng:-38.7,accuracy:150}}/>);
    // A previously selected manual origin must keep the same marker instance.
    expect(api.marker).not.toHaveBeenCalled();
    expect(api.markerMove).not.toHaveBeenCalled();
    expect(api.panTo).not.toHaveBeenCalled();expect(api.circle).not.toHaveBeenCalled();
  });
  it("permite escolher saída no mapa apenas quando esse modo é habilitado",async()=>{
    const onPickOrigin=vi.fn();
    const {rerender}=render(<HomeRideMap {...base} onPickOrigin={onPickOrigin}/>);
    await waitFor(()=>expect(api.on).toHaveBeenCalledWith("dragstart",expect.any(Function)));
    expect(api.on.mock.calls.some(([name])=>name==="click")).toBe(false);
    rerender(<HomeRideMap {...base} selectingOrigin onPickOrigin={onPickOrigin}/>);
    await waitFor(()=>expect(api.on).toHaveBeenCalledWith("click",expect.any(Function)));
    const callback=api.on.mock.calls.find(([name])=>name==="click")![1] as (event:any)=>void;
    act(()=>callback({latLng:{lat:()=>-3.754,lng:()=>-38.531}}));
    expect(onPickOrigin).toHaveBeenCalledWith({lat:-3.754,lng:-38.531});
  });
  it("updates GPS markers without recreating map or following after drag",async()=>{
    const {rerender,unmount}=render(<HomeRideMap {...base}/>);
    await waitFor(()=>expect(api.on).toHaveBeenCalledWith("dragstart",expect.any(Function)));
    act(()=>api.on.mock.calls[0][1]());expect(base.onDrag).toHaveBeenCalledOnce();api.panTo.mockClear();
    const originalMarkers=api.marker.mock.calls.length;
    rerender(<HomeRideMap {...base} following={false} userPosition={{lat:-3.74,lng:-38.53,accuracy:80}}/>);
    await waitFor(()=>expect(api.markerMove).toHaveBeenCalledWith({lat:-3.74,lng:-38.53}));
    expect(api.marker).toHaveBeenCalledTimes(originalMarkers);
    expect(api.panTo).not.toHaveBeenCalled();expect(api.create).toHaveBeenCalledOnce();
    fireEvent.click(screen.getByRole("button",{name:"Centralizar na minha localização"}));expect(base.onRecenter).toHaveBeenCalledOnce();
    rerender(<HomeRideMap {...base} recenterVersion={1}/>);
    expect(api.panTo).toHaveBeenCalledWith({lat:-3.73,lng:-38.52});unmount();expect(api.clear).toHaveBeenCalled();
  });
  it("draws authorized meeting point and real walking geometry then removes overlay",async()=>{
    const pickupPreview={
      passenger:{lat:-3.73,lng:-38.52},route:[{lat:-3.73,lng:-38.53},{lat:-3.79,lng:-38.48}],
      pickup:{point:{lat:-3.731,lng:-38.521},label:"Na rota, próximo a Posto",source:"PLACE_REFERENCE" as const,placeId:"place",needsConfirmation:true as const},
      walk:{distanceKm:0.15,durationMinutes:2,routePath:[{lat:-3.73,lng:-38.52},{lat:-3.7305,lng:-38.5202},{lat:-3.731,lng:-38.521}]},
      strict:true,highway:false,
    };
    const {rerender}=render(<HomeRideMap {...base} pickupPreview={pickupPreview}/>);
    await waitFor(()=>expect(api.polyline).toHaveBeenCalledWith(expect.objectContaining({path:pickupPreview.walk.routePath,strokeOpacity:0,icons:expect.any(Array)})));
    expect(api.marker).toHaveBeenCalledWith(expect.objectContaining({position:pickupPreview.pickup.point,title:pickupPreview.pickup.label}));
    api.clear.mockClear();rerender(<HomeRideMap {...base} pickupPreview={null}/>);expect(api.clear).toHaveBeenCalled();
  });
  it("reuses existing driver markers during repeated radar GPS updates",async()=>{
    const driver={
      driver_key:"driver-stable",lat:-3.731,lng:-38.53,
      seen_at:"2026-11-18T14:40:00Z",vehicle_type:"MOTO" as const,
    };
    const {rerender}=render(<HomeRideMap {...base}
      professionalDrivers={[driver]} userPosition={null}/>);
    await waitFor(()=>expect(api.marker).toHaveBeenCalled());
    const markerCount=api.marker.mock.calls.length;
    api.markerMove.mockClear();api.clear.mockClear();
    rerender(<HomeRideMap {...base} userPosition={null}
      professionalDrivers={[{...driver,lat:-3.733,lng:-38.531,seen_at:"2026-11-18T14:40:15Z"}]}/>);
    expect(api.marker).toHaveBeenCalledTimes(markerCount);
    expect(api.markerMove).toHaveBeenCalled();
    expect(api.clear).not.toHaveBeenCalled();
  });
  it("shows reload action on script failure without another map",async()=>{
    vi.mocked(loadGoogleMaps).mockRejectedValue(new Error("network"));
    const {container}=render(<HomeRideMap {...base}/>);
    expect(await screen.findByRole("alert")).toHaveTextContent("Não foi possível carregar o Google Maps");
    expect(screen.getByRole("button",{name:"Recarregar mapa"})).toBeInTheDocument();
    expect(api.create).not.toHaveBeenCalled();expect(container.querySelectorAll("iframe")).toHaveLength(0);
  });
  it("shows error state when Google rejects domain authentication after loading",async()=>{
    render(<HomeRideMap {...base}/>);await waitFor(()=>expect(api.create).toHaveBeenCalledOnce());
    act(()=>vi.mocked(onGoogleMapsAuthFailure).mock.calls[0][0]());expect(screen.getByRole("alert")).toBeInTheDocument();
  });
});
