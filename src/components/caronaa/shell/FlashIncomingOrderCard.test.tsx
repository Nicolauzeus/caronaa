import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { FlashIncomingOrderCard } from "./FlashIncomingOrderCard";
import type { FlashDriverOrder } from "@/services/flash-driver-service";

const order:FlashDriverOrder={
  id:"ride-1",mode:"ON_ROUTE",seats:2,distanceKm:1.8,
  driverEarnings:8.5,pickupLabel:"Praça",dropoffLabel:"Universidade",
  expiresAt:"2035-11-15T17:00:00Z",
};
afterEach(()=>{cleanup();vi.useRealTimers();});
describe("Flash Incoming Order overlay",()=>{
  it("shows authorized fare, meeting details and accept action",()=>{
    const onAnswer=vi.fn().mockResolvedValue(undefined);
    render(<FlashIncomingOrderCard order={order} onAnswer={onAnswer}/>);
    expect(screen.getByText("NA ROTA")).toBeTruthy();
    expect(screen.getByText("Praça")).toBeTruthy();
    expect(screen.getByText(/8,50/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button",{name:"Aceitar Chamado"}));
    expect(onAnswer).toHaveBeenCalledWith(true);
    expect(onAnswer).toHaveBeenCalledTimes(1);
  });
  it("declines automatically at 15 seconds, exactly once",async()=>{
    vi.useFakeTimers();
    const onAnswer=vi.fn().mockResolvedValue(undefined);
    render(<FlashIncomingOrderCard order={order} onAnswer={onAnswer}/>);
    await act(async()=>{vi.advanceTimersByTime(15_500);});
    expect(onAnswer).toHaveBeenCalledTimes(1);
    expect(onAnswer).toHaveBeenCalledWith(false);
    await act(async()=>{vi.advanceTimersByTime(1000);});
    expect(onAnswer).toHaveBeenCalledTimes(1);
  });
  it("does not auto-decline after the user rejects manually",async()=>{
    vi.useFakeTimers();
    const onAnswer=vi.fn().mockResolvedValue(undefined);
    render(<FlashIncomingOrderCard order={order} onAnswer={onAnswer}/>);
    fireEvent.click(screen.getByRole("button",{name:"Recusar"}));
    await act(async()=>{vi.advanceTimersByTime(17_000);});
    expect(onAnswer).toHaveBeenCalledTimes(1);
    expect(onAnswer).toHaveBeenCalledWith(false);
  });
});
