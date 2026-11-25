import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { QuickRideDriverSettlement } from "./QuickRideDriverSettlement";
import { QuickRidePixCard } from "./QuickRidePixCard";
import { CompletedRidePix, DriverPixSettings } from "./DriverPix";
import { buildPixPayload } from "@/lib/pix";

const { rpc, renderQr } = vi.hoisted(() => ({ rpc: vi.fn(), renderQr: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: {
  rpc: (name: string, args: unknown) => {
    const response = rpc(name, args);
    return Object.assign(response, { abortSignal: () => response });
  },
} }));
vi.mock("qrcode", () => ({ default: { toDataURL: renderQr } }));

const rideA = "11111111-1111-4111-8111-111111111111";
const rideB = "22222222-2222-4222-8222-222222222222";
const sample = (rideId = rideA) => ({
  rideId, available: true, key: "Pix@Example.Test", name: "Motorista",
  amountCents: 3000, paymentMethod: "MANUAL_DRIVER_PIX", automaticConfirmation: false, pilotOnly: false,
});
const ok = (data: unknown) => ({ data, error: null });
const failed = () => ({ data: null, error: { code: "22023" } });
const declared = [{ passenger_declared_at: "2026-11-24T18:00:00Z", driver_acknowledged_at: null }];
const readCode = async () => (await screen.findByLabelText<HTMLTextAreaElement>("Código Pix Copia e Cola")).value;
const expectedCode = (ride: string, key = "pix@example.test", value = 30) =>
  buildPixPayload(key, "Motorista", value, "CR" + ride.replace(/-/g, "").slice(0, 20));
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(complete => { resolve = complete; });
  return { promise, resolve };
}

beforeEach(() => {
  vi.resetAllMocks();
  renderQr.mockResolvedValue("data:image/png;base64,test");
  rpc.mockImplementation(async (name, args) => name === "get_completed_quick_ride_pix" ? ok(sample(args.p_ride_id)) : ok([]));
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe("Pix on the passenger and driver screens", () => {
  it.each(["passenger", "driver"])("keeps the exact BR Code usable without canvas or clipboard for %s", async role => {
    const onReady = vi.fn();
    const copy = vi.fn().mockRejectedValue(new Error("negado"));
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText: copy } });
    renderQr.mockRejectedValue(new Error("Canvas indisponível"));
    render(role === "driver" ? <QuickRideDriverSettlement rideId={rideA} onPixReady={onReady} /> : <QuickRidePixCard rideId={rideA} />);
    const code = await readCode();
    expect(code).toBe(expectedCode(rideA));
    expect(renderQr).toHaveBeenCalledWith(code, expect.objectContaining({ margin: 4 }));
    fireEvent.click(screen.getByRole("button", { name: "Copiar Pix Copia e Cola" }));
    expect(copy).toHaveBeenCalledWith(code);
    await waitFor(() => expect(screen.getByLabelText("Código Pix Copia e Cola")).toHaveFocus());
    expect(screen.getByText("Ver código Pix").closest("details")).toHaveAttribute("open");
    if (role === "driver") expect(onReady).toHaveBeenLastCalledWith(true);
  });

  it.each(["passenger", "driver"])("ignores a late response from a different ride for %s", async role => {
    const old = deferred<ReturnType<typeof ok>>();
    rpc.mockImplementation(async (name, args) => {
      if (name !== "get_completed_quick_ride_pix") return ok([]);
      return args.p_ride_id === rideA ? old.promise : ok({ ...sample(rideB), amountCents: 600 });
    });
    const view = (ride: string) => role === "driver" ? <QuickRideDriverSettlement rideId={ride} /> : <QuickRidePixCard rideId={ride} />;
    const card = render(view(rideA));
    card.rerender(view(rideB));
    const current = expectedCode(rideB, "pix@example.test", 6);
    expect(await readCode()).toBe(current);
    await act(async () => old.resolve(ok(sample())));
    expect(await readCode()).toBe(current);
  });

  it("drops a replaced image when a late QR render completes", async () => {
    const old = deferred<string>();
    renderQr.mockImplementationOnce(() => old.promise).mockResolvedValue("new-image");
    let row = sample();
    rpc.mockImplementation(async name => name === "get_completed_quick_ride_pix" ? ok(row) : ok([]));
    render(<QuickRidePixCard rideId={rideA} />);
    expect(await readCode()).toBe(expectedCode(rideA));
    row = { ...row, key: "changed@example.test" };
    fireEvent(window, new Event("online"));
    const img = await screen.findByRole("img");
    expect(img).toHaveAttribute("src", "new-image");
    await act(async () => old.resolve("old-image"));
    expect(img).toHaveAttribute("src", "new-image");
    expect(await readCode()).toBe(expectedCode(rideA, row.key));
  });

  it("keeps the verified code consultable while declaration status is unavailable", async () => {
    const delayed = deferred<ReturnType<typeof failed>>();
    rpc.mockImplementation(async name => name === "get_completed_quick_ride_pix" ? ok(sample()) : delayed.promise);
    render(<QuickRidePixCard rideId={rideA} />);
    expect(await readCode()).toBe(expectedCode(rideA));
    expect(screen.queryByRole("button", { name: "Já fiz o Pix" })).toBeNull();
    await act(async () => delayed.resolve(failed()));
    await screen.findByText(/Não foi possível atualizar a situação/);
    expect(await readCode()).toBe(expectedCode(rideA));
  });

  it("removes a stale charge after a refused refresh and recovers on retry", async () => {
    let refuse = false;
    rpc.mockImplementation(async name => name === "get_completed_quick_ride_pix" ? (refuse ? failed() : ok(sample())) : ok([]));
    const ready = vi.fn();
    render(<QuickRideDriverSettlement rideId={rideA} onPixReady={ready} />);
    await readCode();
    refuse = true;
    fireEvent(window, new Event("caronaa:app-refresh"));
    await screen.findByRole("alert");
    expect(screen.queryByLabelText("Código Pix Copia e Cola")).toBeNull();
    expect(ready).toHaveBeenLastCalledWith(false);
    refuse = false;
    fireEvent.click(screen.getByRole("button", { name: "Atualizar cobrança" }));
    expect(await readCode()).toBe(expectedCode(rideA));
  });

  it("only marks the driver ready after the corrected key produces a charge", async () => {
    let key = "inválida";
    rpc.mockImplementation(async (name, args) => {
      if (name === "save_my_pix_key") { key = args.p_key; return ok(null); }
      return name === "get_completed_quick_ride_pix" ? ok({ ...sample(), key }) : ok([]);
    });
    const ready = vi.fn();
    render(<QuickRideDriverSettlement rideId={rideA} onPixReady={ready} />);
    fireEvent.change(await screen.findByLabelText("Chave Pix do motorista"), { target: { value: "(85) 99999-0101" } });
    expect(ready).toHaveBeenLastCalledWith(false);
    fireEvent.click(screen.getByRole("button", { name: "Salvar chave Pix" }));
    expect(await readCode()).toBe(expectedCode(rideA, "+5585999990101"));
    expect(ready).toHaveBeenLastCalledWith(true);
  });

  it("recognizes an already committed passenger declaration after a lost response", async () => {
    let committed = false;
    rpc.mockImplementation(async name => {
      if (name === "get_completed_quick_ride_pix") return ok(sample());
      if (name === "quick_ride_declare_manual_pix") { committed = true; throw new Error("Resposta perdida"); }
      return ok(committed ? declared : []);
    });
    render(<QuickRidePixCard rideId={rideA} />);
    fireEvent.click(await screen.findByRole("button", { name: "Já fiz o Pix" }));
    await screen.findByText(/Você já declarou/);
    expect(screen.queryByRole("button", { name: "Já fiz o Pix" })).toBeNull();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("reconciles a repeated driver acknowledgement and hides the pay action", async () => {
    let acknowledged = false;
    vi.spyOn(window, "confirm").mockReturnValue(true);
    rpc.mockImplementation(async name => {
      if (name === "get_completed_quick_ride_pix") return ok(sample());
      if (name === "quick_ride_acknowledge_manual_pix") { acknowledged = true; return ok(false); }
      return ok(acknowledged ? [{ ...declared[0], driver_acknowledged_at: "2026-11-24T18:02:00Z" }] : declared);
    });
    render(<QuickRideDriverSettlement rideId={rideA} />);
    fireEvent.click(await screen.findByRole("button", { name: "Recebi o Pix no banco" }));
    await screen.findByText(/já registraram suas confirmações/);
    expect(screen.queryByRole("button", { name: "Recebi o Pix no banco" })).toBeNull();
  });
});

describe("Pix for shared rides and driver profile", () => {
  it("copies the complete code for the contracted seat count and rejects a mismatched total", async () => {
    let amount = 30;
    rpc.mockImplementation(async name => name === "get_ride_pix"
      ? ok({ key: "Pix@Example.Test", name: "Motorista", amount, pricePerPassenger: 15, passengerCount: 2,
          paymentMethod: "MANUAL_DRIVER_PIX", automaticConfirmation: false })
      : ok({ passengerConfirmed: false, driverConfirmed: false, bothConfirmed: false,
          paymentMethod: "MANUAL_DRIVER_PIX", autoBankVerified: false }));
    render(<CompletedRidePix rideId={rideA} role="passenger" />);
    expect(await readCode()).toBe(buildPixPayload("pix@example.test", "Motorista", 30));
    amount = 24;
    fireEvent(window, new Event("online"));
    expect(await screen.findByRole("alert")).toHaveTextContent("valor");
    expect(screen.queryByLabelText("Código Pix Copia e Cola")).toBeNull();
  });

  it("lets the driver identify an unformatted national phone before saving", async () => {
    rpc.mockImplementation(async name => name === "get_my_pix_key" ? ok("driver@example.test") : ok(null));
    render(<DriverPixSettings />);
    fireEvent.change(await screen.findByLabelText("Chave Pix do motorista"), { target: { value: "85999990101" } });
    const select = screen.getByLabelText("Tipo de chave de 11 dígitos");
    expect(select).toBeRequired();
    fireEvent.change(select, { target: { value: "phone" } });
    fireEvent.click(screen.getByRole("button", { name: "Salvar chave Pix" }));
    await waitFor(() => expect(rpc).toHaveBeenCalledWith("save_my_pix_key", { p_key: "+5585999990101" }));
  });
});
