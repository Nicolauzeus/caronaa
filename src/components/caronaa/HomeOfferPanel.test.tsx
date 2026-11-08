import { useEffect, useRef, useState } from "react";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { HomeOfferPanel, type HomeOfferPanelHandle, type HomeOfferPanelStatus } from "./HomeOfferPanel";

const api = vi.hoisted(() => ({
  publish: vi.fn(), allowed: true, onPublished: vi.fn(),
}));
vi.mock("@tanstack/react-start", () => ({ useServerFn: (handler: unknown) => handler }));
vi.mock("@tanstack/react-router", () => ({
  Link: ({children}: {children:React.ReactNode}) => <a href="/minhas-caronas">{children}</a>,
}));
vi.mock("@/lib/use-profile-gender", () => ({ useProfileGender: () => "MASCULINO" }));
vi.mock("@/lib/ride-matching.functions", () => ({ createRideOffer: api.publish }));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth:{getUser: vi.fn(async () => ({ data:{user:{id:"driver1"}} }))},
    rpc: vi.fn(async () => ({ data:{driverAllowed:api.allowed}, error:null })),
    from: vi.fn(() => ({select:() => ({eq:() => ({
      maybeSingle:async () => ({data:{vehicle_brand:"Fiat",vehicle_description:"Uno"},error:null}),
    })})})),
  },
}));
vi.mock("./OfferFarePreview", () => ({
  OfferFarePreview: ({origin,destination,onQuote}: any) => {
    useEffect(() => {
      onQuote({quoteId:"c750e08a-6f66-4877-8475-0a9ac528ef6d",
        origin,destination,pricePerPassenger:6,distanceKm:11});
    },[origin,destination,onQuote]);
    return <div>Estimativa de oferta</div>;
  },
}));
vi.mock("./RoutePolicySelector", () => ({RoutePolicySelector:()=>null}));
vi.mock("./TimeToleranceSelector", () => ({TimeToleranceSelector:()=>null}));
vi.mock("./WomenOnlyToggle", () => ({WomenOnlyToggle:()=>null}));
vi.mock("./TravelPreferences", () => ({JourneyPreferences:()=>null}));
vi.mock("./RideRoutineForm", () => ({RideRoutineForm:()=>null}));

const startingStatus:HomeOfferPanelStatus={
  step:"DETAILS",busy:false,canContinue:false,driverAllowed:null,routine:false,
};
function Harness() {
  const ref=useRef<HomeOfferPanelHandle>(null);
  const [status,setStatus]=useState(startingStatus);
  const [destination,setDestination]=useState("UNILAB, Redenção");
  const [date,setDate]=useState("2026-11-10");
  const [time,setTime]=useState("15:30");
  return <div>
    <button type="button" onClick={()=>setDestination("Centro, Fortaleza")}>Trocar destino</button>
    <HomeOfferPanel
      ref={ref}
      origin="Shopping, Fortaleza"
      destination={destination}
      originLocation={{rawText:"Shopping, Fortaleza",lat:-3.75,lng:-38.49}}
      destinationLocation={{rawText:destination,lat:destination==="UNILAB, Redenção"?-4.23:-3.72,lng:-38.73}}
      date={date} time={time} tolerance={15}
      onDateChange={setDate} onTimeChange={setTime} onToleranceChange={vi.fn()}
      onDraftChange={vi.fn()} onStatusChange={setStatus} onPublished={api.onPublished}
    />
    <button type="button" onClick={()=>ref.current?.next()}
      disabled={!status.canContinue||status.busy}>
      {status.step==="REVIEW"?"Publicar oferta":"Revisar oferta"}
    </button>
  </div>;
}
beforeEach(() => {
  vi.clearAllMocks();
  api.allowed=true;
  api.publish.mockResolvedValue({offerId:"2ca568c6-5d32-4e72-b970-1b1c19ffb25e"});
});
describe("single-map offer workflow", () => {
  it("requires a fresh server quote and explicit review before publishing", async () => {
    render(<Harness/>);
    const review=screen.getByRole("button",{name:"Revisar oferta"});
    await waitFor(()=>expect(review).toBeEnabled());
    expect(api.publish).not.toHaveBeenCalled();
    fireEvent.click(review);
    expect(screen.getByText("Revise sua oferta")).toBeInTheDocument();
    expect(api.publish).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button",{name:"Publicar oferta"}));
    await waitFor(()=>expect(api.publish).toHaveBeenCalledTimes(1));
    expect(api.publish).toHaveBeenCalledWith({data:expect.objectContaining({
      origin:"Shopping, Fortaleza", destination:"UNILAB, Redenção",
      vehicleType:"CAR",availableSeats:3,
      quoteId:"c750e08a-6f66-4877-8475-0a9ac528ef6d",
      idempotencyKey:expect.any(String),
    })});
    expect(await screen.findByText("Carona publicada!")).toBeInTheDocument();
    expect(api.onPublished).toHaveBeenCalledTimes(1);
  });

  it("resets the review if the shared destination changes and never auto-publishes", async()=>{
    render(<Harness/>);
    await waitFor(()=>expect(screen.getByRole("button",{name:"Revisar oferta"})).toBeEnabled());
    fireEvent.click(screen.getByRole("button",{name:"Revisar oferta"}));
    expect(screen.getByText("Revise sua oferta")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button",{name:"Trocar destino"}));
    await waitFor(()=>expect(screen.queryByText("Revise sua oferta")).not.toBeInTheDocument());
    expect(api.publish).not.toHaveBeenCalled();
  });

  it("disallows publishing when the driver owes unresolved commissions",async()=>{
    api.allowed=false;
    render(<Harness/>);
    await screen.findByRole("alert");
    expect(screen.getByRole("button",{name:"Revisar oferta"})).toBeDisabled();
    expect(api.publish).not.toHaveBeenCalled();
  });
});
