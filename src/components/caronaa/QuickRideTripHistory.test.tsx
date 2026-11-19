import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { QuickRideTripHistory } from "./QuickRideTripHistory";

const api = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({supabase: {rpc:api.rpc}}));
vi.mock("@tanstack/react-router", () => ({
  Link: ({to, children}: {to:string;children:import("react").ReactNode}) => <a href={to}>{children}</a>,
}));
vi.mock("./QuickRidePixCard", () => ({
  QuickRidePixCard: ({rideId}: {rideId:string}) => <div>Pix autorizado para {rideId}</div>,
}));

beforeEach(() => { vi.resetAllMocks(); api.rpc.mockResolvedValue({data:[],error:null}); });
afterEach(cleanup);

describe("Corridas Rápidas no histórico", () => {
  it("lists only authenticated passenger-side rides and reveals Pix on explicit tap", async () => {
    api.rpc.mockResolvedValue({error:null,data:[
      {id:"passenger-completed",role:"PASSENGER",status:"COMPLETED",vehicle_type:"MOTO",
        municipality:"Fortaleza",fare_cents:780,created_at:"2026-11-17T16:30:00Z"},
      {id:"driver-ride",role:"DRIVER",status:"COMPLETED",vehicle_type:"CAR",fare_cents:1000},
      {id:"passenger-active",role:"PASSENGER",status:"SEARCHING",vehicle_type:"CAR"},
    ]});
    render(<QuickRideTripHistory/>);
    await waitFor(() => expect(screen.getByText("Fortaleza")).toBeTruthy());
    expect(api.rpc).toHaveBeenCalledWith("quick_ride_my_requests");
    expect(screen.getByText("Buscando motorista")).toBeTruthy();
    expect(screen.queryByText("Pix autorizado para passenger-completed")).toBeNull();
    expect(screen.queryByText("Pix autorizado para driver-ride")).toBeNull();
    const openPix = screen.getByRole("button", {name:/Consultar Pix e pagamento/i});
    fireEvent.click(openPix);
    expect(screen.getByText("Pix autorizado para passenger-completed")).toBeTruthy();
    fireEvent.click(openPix);
    expect(screen.queryByText("Pix autorizado para passenger-completed")).toBeNull();
  });

  it("keeps a readable error and retry when the authorized service fails", async () => {
    api.rpc.mockResolvedValueOnce({data:null,error:{code:"PGRST"}})
      .mockResolvedValueOnce({data:[],error:null});
    render(<QuickRideTripHistory/>);
    await waitFor(() => expect(screen.getByRole("alert")).toBeTruthy());
    fireEvent.click(screen.getByRole("button",{name:"Tentar novamente"}));
    await waitFor(() => expect(screen.getByText(/ainda não solicitou uma Corrida Rápida/i)).toBeTruthy());
  });
});
