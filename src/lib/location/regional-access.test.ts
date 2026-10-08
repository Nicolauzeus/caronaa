import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  CEARA_ONLY_MESSAGE,
  checkCearaAccess,
  isCearaState,
  regionalAccessMessage,
} from "./regional-access";
import { reverseGeocodeServerFn } from "@/lib/location.functions";

vi.mock("@/lib/location.functions", () => ({ reverseGeocodeServerFn: vi.fn() }));
const originalGeolocation = Object.getOwnPropertyDescriptor(navigator, "geolocation");
const originalSecureContext = Object.getOwnPropertyDescriptor(window, "isSecureContext");

describe("regional access", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.defineProperty(window, "isSecureContext", { configurable: true, value: true });
    Object.defineProperty(navigator, "geolocation", {
      configurable: true,
      value: {
        getCurrentPosition: vi.fn((success: (position: unknown) => void) =>
          success({ coords: { latitude: -3.73, longitude: -38.52, accuracy: 30 } }),
        ),
      },
    });
  });

  afterEach(() => {
    if (originalGeolocation) {
      Object.defineProperty(navigator, "geolocation", originalGeolocation);
    } else {
      Reflect.deleteProperty(navigator, "geolocation");
    }
    if (originalSecureContext) {
      Object.defineProperty(window, "isSecureContext", originalSecureContext);
    } else {
      Reflect.deleteProperty(window, "isSecureContext");
    }
  });

  it("recognizes Ceará and its state abbreviation regardless of accents or case", () => {
    expect(isCearaState("Ceará")).toBe(true);
    expect(isCearaState("CE")).toBe(true);
    expect(isCearaState("ceara")).toBe(true);
    expect(isCearaState("Piauí")).toBe(false);
    expect(isCearaState(null)).toBe(false);
  });

  it("shows the requested message to people outside Ceará", () => {
    expect(regionalAccessMessage("OUTSIDE_CEARA")).toBe(CEARA_ONLY_MESSAGE);
    expect(CEARA_ONLY_MESSAGE).toContain("Em breve estaremos aí com vocês");
  });

  it("does not silently allow access when location cannot be verified", () => {
    expect(regionalAccessMessage("LOCATION_UNAVAILABLE")).toContain(
      "Não foi possível confirmar sua localização",
    );
  });

  it("allows only a fresh device position reverse-geocoded to Ceará", async () => {
    vi.mocked(reverseGeocodeServerFn).mockResolvedValue({ state: "Ceará" } as never);
    await expect(checkCearaAccess()).resolves.toEqual({ allowed: true });
  });

  it("blocks a device position reverse-geocoded to another state", async () => {
    vi.mocked(reverseGeocodeServerFn).mockResolvedValue({ state: "Piauí" } as never);
    await expect(checkCearaAccess()).resolves.toEqual({
      allowed: false,
      reason: "OUTSIDE_CEARA",
    });
  });

  it("fails closed if the location permission is denied or geocoding is unavailable", async () => {
    Object.defineProperty(navigator, "geolocation", {
      configurable: true,
      value: { getCurrentPosition: vi.fn((_success: unknown, reject: (error: Error) => void) => reject(new Error("denied"))) },
    });
    await expect(checkCearaAccess()).resolves.toEqual({
      allowed: false,
      reason: "LOCATION_UNAVAILABLE",
    });

    Object.defineProperty(navigator, "geolocation", {
      configurable: true,
      value: {
        getCurrentPosition: vi.fn((success: (position: unknown) => void) =>
          success({ coords: { latitude: -3.73, longitude: -38.52, accuracy: 30 } }),
        ),
      },
    });
    vi.mocked(reverseGeocodeServerFn).mockResolvedValue(null as never);
    await expect(checkCearaAccess()).resolves.toEqual({
      allowed: false,
      reason: "LOCATION_UNAVAILABLE",
    });
  });
});
