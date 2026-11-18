import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useUserLocation } from "@/lib/location/use-user-location";
let fix: PositionCallback, fail: PositionErrorCallback, move: PositionCallback;
const gps = { getCurrentPosition: vi.fn(), watchPosition: vi.fn(), clearWatch: vi.fn() };
const position = (latitude = -4.22) =>
  ({ coords: { latitude, longitude: -38.71, accuracy: 10 }, timestamp:Date.now() }) as GeolocationPosition;
beforeEach(() => {
  vi.clearAllMocks();
  Object.defineProperty(document, "hidden", { configurable: true, value: false });
  Object.defineProperty(window, "isSecureContext", { configurable: true, value: true });
  Object.defineProperty(navigator, "geolocation", { configurable: true, value: gps });
  gps.getCurrentPosition.mockImplementation((yes, no) => {
    fix = yes;
    fail = no;
  });
  gps.watchPosition.mockImplementation((yes) => {
    move = yes;
    return 7;
  });
});
describe("Automatic operational location", () => {
  it("updates a provisional GPS origin on meaningful movement without an address lookup", () => {
    const { result, unmount } = renderHook(() => useUserLocation({ autoLocate: true }));
    expect(gps.getCurrentPosition).toHaveBeenCalledOnce();
    act(() => fix(position()));
    expect(result.current.addressPosition?.lat).toBe(-4.22);
    act(() => move(position(-4.23)));
    expect(result.current.position?.lat).toBe(-4.23);
    expect(result.current.addressPosition?.lat).toBe(-4.23);
    // A tiny fluctuating GPS sample is not a new pickup.
    act(() => move(position(-4.23001)));
    expect(result.current.addressPosition?.lat).toBe(-4.23);
    unmount();
    expect(gps.clearWatch).toHaveBeenCalledWith(7);
  });
  it("does not repeatedly request permission after denial", () => {
    const { result } = renderHook(() => useUserLocation({ autoLocate: true }));
    act(() => fail({ code: 1 } as GeolocationPositionError));
    expect(result.current.failure).toBe("PERMISSION_DENIED");
    act(() => document.dispatchEvent(new Event("visibilitychange")));
    expect(gps.getCurrentPosition).toHaveBeenCalledOnce();
    expect(result.current.locating).toBe(false);
  });
  it("supports manual fallback when the API is missing", () => {
    Object.defineProperty(navigator, "geolocation", { configurable: true, value: undefined });
    const { result } = renderHook(() => useUserLocation({ autoLocate: true }));
    expect(result.current.failure).toBe("UNSUPPORTED");
    expect(result.current.locating).toBe(false);
  });
  it("defers an initially hidden page until it becomes visible", () => {
    Object.defineProperty(document, "hidden", { configurable: true, value: true });
    renderHook(() => useUserLocation({ autoLocate: true }));
    expect(gps.getCurrentPosition).not.toHaveBeenCalled();
    act(() => {
      Object.defineProperty(document, "hidden", { configurable: true, value: false });
      document.dispatchEvent(new Event("visibilitychange"));
    });
    expect(gps.getCurrentPosition).toHaveBeenCalledOnce();
  });
});
