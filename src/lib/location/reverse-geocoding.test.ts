import { afterEach, describe, expect, it, vi } from "vitest";
import { CearaOnlineProvider } from "./ceara-online-provider";

describe("Photon reverse reutilizado", () => {
  afterEach(() => vi.unstubAllGlobals());
  it("resolve endereço sem trocar coordenadas GPS pelo prédio mais próximo", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValue({
        ok: true,
        json: async () => ({
          features: [
            {
              properties: { street: "Rua A", city: "Fortaleza", state: "Ceará" },
              geometry: { coordinates: [-38.5, -3.7] },
            },
          ],
        }),
      });
    vi.stubGlobal("fetch", fetch);
    const result = await new CearaOnlineProvider().reverse(-3.73, -38.52);
    expect(result).toEqual(
      expect.objectContaining({
        formattedAddress: "Rua A, Fortaleza, Ceará",
        lat: -3.73,
        lng: -38.52,
      }),
    );
    expect(fetch.mock.calls[0][0].toString()).toContain("photon.komoot.io/reverse");
  });
  it("sem resultado não inventa endereço", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, json: async () => ({ features: [] }) }),
    );
    expect(await new CearaOnlineProvider().reverse(-3.73, -38.52)).toBeNull();
  });
  it("falha HTTP fica disponível ao tratamento do serviço", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 503 }));
    await expect(new CearaOnlineProvider().reverse(-3.73, -38.52)).rejects.toThrow("503");
  });
});
