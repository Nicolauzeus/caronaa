import { act, renderHook } from "@testing-library/react";
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { useUserLocation } from "./use-user-location";

let fix: PositionCallback;
let move: PositionCallback;
let fail: PositionErrorCallback;
const clearWatch = vi.fn();
const getCurrentPosition = vi.fn((success: PositionCallback, error: PositionErrorCallback) => {
  fix = success;
  fail = error;
});
const watchPosition = vi.fn((success: PositionCallback) => {
  move = success;
  return 42;
});
const position = (lat = -3.73, accuracy = 12) =>
  ({
    coords: { latitude: lat, longitude: -38.52, accuracy },
    timestamp: Date.now(),
  }) as GeolocationPosition;
describe("Localização da home", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.defineProperty(window, "isSecureContext", { configurable: true, value: true });
    Object.defineProperty(document, "hidden", { configurable: true, value: false });
    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      value: () => ({ matches: true }),
    });
    Object.defineProperty(navigator, "geolocation", {
      configurable: true,
      value: { getCurrentPosition, watchPosition, clearWatch },
    });
  });
  afterEach(() => vi.restoreAllMocks());
  it("sinaliza baixa precisão apenas acima de 80 metros", () => {
    const { result } = renderHook(useUserLocation);
    expect(result.current.accuracyM).toBeNull();
    expect(result.current.isLowAccuracy).toBe(false);
    act(() => fix(position(-3.73, 80)));
    expect(result.current.accuracyM).toBe(80);
    expect(result.current.isLowAccuracy).toBe(false);
    act(() => move(position(-3.73, 81)));
    expect(result.current.accuracyM).toBe(81);
    expect(result.current.isLowAccuracy).toBe(true);
  });
  it("substitui fix de 1029m por watchPosition realmente mais preciso, sem oscilações", () => {
    const { result } = renderHook(useUserLocation);
    act(() => fix(position(-3.73, 1029)));
    expect(result.current.addressPosition?.accuracy).toBe(1029);
    act(() => move(position(-3.731, 20)));
    expect(result.current.addressPosition).toEqual({
      lat: -3.731, lng: -38.52, accuracy: 20,
    });
    act(() => move(position(-3.735, 120)));
    expect(result.current.position?.lat).toBe(-3.735);
    expect(result.current.addressPosition?.lat).toBe(-3.731);
  });
  it("solicita posição no mobile e acompanha após permissão", () => {
    const { result } = renderHook(useUserLocation);
    expect(getCurrentPosition).toHaveBeenCalledOnce();
    act(() => fix(position()));
    expect(result.current.position).toEqual({ lat: -3.73, lng: -38.52, accuracy: 12 });
    expect(watchPosition).toHaveBeenCalledOnce();
    expect(result.current.locating).toBe(false);
  });
  it.each([
    [1, "PERMISSION_DENIED"],
    [2, "POSITION_UNAVAILABLE"],
    [3, "TIMEOUT"],
  ])("distingue falha %s sem bloquear a tela", (code, expected) => {
    const { result } = renderHook(useUserLocation);
    act(() => fail({ code } as GeolocationPositionError));
    expect(result.current.failure).toBe(expected);
    expect(watchPosition).toHaveBeenCalledOnce();
    if (code === 1) expect(clearWatch).toHaveBeenCalledWith(42);
    expect(result.current.locating).toBe(false);
  });
  it("recupera um TIMEOUT inicial com o GPS recebido pelo watcher", () => {
    const { result } = renderHook(useUserLocation);
    act(() => fail({ code: 3 } as GeolocationPositionError));
    expect(result.current.failure).toBe("TIMEOUT");
    expect(watchPosition).toHaveBeenCalledOnce();
    act(() => move(position(-3.733, 40)));
    expect(result.current.failure).toBeNull();
    expect(result.current.addressPosition?.lat).toBe(-3.733);
    expect(result.current.locating).toBe(false);
    expect(result.current.recenterVersion).toBe(1);
  });
  it("não substitui um fix preciso por resposta inicial atrasada e grosseira", () => {
    const { result } = renderHook(useUserLocation);
    act(() => move(position(-3.733, 18)));
    act(() => fix(position(-3.74, 500)));
    expect(result.current.addressPosition?.lat).toBe(-3.733);
    expect(result.current.addressPosition?.accuracy).toBe(18);
    expect(result.current.recenterVersion).toBe(1);
  });
  it("atualiza posição sem reverse geocoding a cada movimento", () => {
    const { result } = renderHook(useUserLocation);
    act(() => fix(position()));
    act(() => move(position(-3.74, 250)));
    expect(result.current.position?.lat).toBe(-3.74);
    expect(result.current.position?.accuracy).toBe(250);
    expect(result.current.addressPosition?.lat).toBe(-3.73);
  });
  it("arrasto desliga follow e recentralização reativa com fix novo", () => {
    const { result } = renderHook(useUserLocation);
    act(() => fix(position()));
    act(() => result.current.setFollowing(false));
    expect(result.current.isFollowingUser).toBe(false);
    act(() => result.current.locate());
    expect(clearWatch).toHaveBeenCalledWith(42);
    act(() => fix(position(-3.75)));
    expect(result.current.isFollowingUser).toBe(true);
    expect(result.current.recenterVersion).toBe(2);
  });
  it("limpa watcher e descarta callbacks após unmount", () => {
    const { unmount } = renderHook(useUserLocation);
    act(() => fix(position()));
    unmount();
    expect(clearWatch).toHaveBeenCalledWith(42);
    act(() => move(position(-3.8)));
    expect(watchPosition).toHaveBeenCalledOnce();
  });
  it("descarta o fix atrasado após desmontagem, sem criar outro watcher", () => {
    const { unmount } = renderHook(useUserLocation);
    unmount();
    act(() => fix(position()));
    expect(watchPosition).toHaveBeenCalledOnce();
    expect(clearWatch).toHaveBeenCalledWith(42);
  });
  it("suspende no background e retoma apenas um watcher", () => {
    const { result } = renderHook(useUserLocation);
    act(() => fix(position()));
    Object.defineProperty(document, "hidden", { configurable: true, value: true });
    act(() => document.dispatchEvent(new Event("visibilitychange")));
    expect(clearWatch).toHaveBeenCalledWith(42);
    act(() => move(position(-3.9)));
    expect(result.current.position?.lat).toBe(-3.73);
    Object.defineProperty(document, "hidden", { configurable: true, value: false });
    act(() => document.dispatchEvent(new Event("visibilitychange")));
    expect(getCurrentPosition).toHaveBeenCalledTimes(2);
  });
  it("explica HTTP inseguro sem solicitar GPS", () => {
    Object.defineProperty(window, "isSecureContext", { configurable: true, value: false });
    const { result } = renderHook(useUserLocation);
    expect(result.current.failure).toBe("INSECURE");
    expect(getCurrentPosition).not.toHaveBeenCalled();
  });
  it("distingue navegador sem suporte", () => {
    Object.defineProperty(navigator, "geolocation", { configurable: true, value: undefined });
    const { result } = renderHook(useUserLocation);
    expect(result.current.failure).toBe("UNSUPPORTED");
  });
});
