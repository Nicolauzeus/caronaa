import { afterEach, describe, expect, it, vi } from "vitest";
import { AsaasClient } from "./asaas";

afterEach(() => vi.unstubAllGlobals());
describe("Asaas sandbox adapter", () => {
  it("creates one PIX payment with a fixed driver split and secret header only on server", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok:true,
      json:async()=>({id:"pay_123456",status:"PENDING",value:101.99,netValue:100,externalReference:"checkout-id"}),
    });
    vi.stubGlobal("fetch",fetchMock);
    const client = new AsaasClient("sandbox-secret","sandbox");
    const response = await client.createPixPayment({
      customer:"cus_123",value:101.99,dueDate:"2026-10-16",
      externalReference:"checkout-id",driverWalletId:"12345678-1234-1234-1234-123456789012",
      driverFixedValue:85,
    });
    expect(response.status).toBe("PENDING");
    const [url,init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api-sandbox.asaas.com/v3/payments");
    expect(init.headers.access_token).toBe("sandbox-secret");
    expect(JSON.parse(init.body)).toMatchObject({
      billingType:"PIX",value:101.99,customer:"cus_123",
      split:[{fixedValue:85,walletId:"12345678-1234-1234-1234-123456789012"}],
    });
  });
  it("returns QR payload without treating it as payment confirmation",async()=>{
    vi.stubGlobal("fetch",vi.fn().mockResolvedValue({
      ok:true,json:async()=>({encodedImage:"base64image",payload:"pix-code"}),
    }));
    const qr = await new AsaasClient("sandbox-secret","sandbox").getPixQrCode("pay_123");
    expect(qr.payload).toBe("pix-code");
    expect(qr).not.toHaveProperty("paid");
  });
  it("checks the production account without charging any customer", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true, json: async () => ({ general: "APPROVED", documentation: "APPROVED" }),
    });
    vi.stubGlobal("fetch", fetchMock);
    const status = await new AsaasClient("production-secret", "production").getAccountStatus();
    expect(status).toEqual({ general: "APPROVED" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.asaas.com/v3/myAccount/status");
    expect(init.method).toBe("GET");
    expect(init.body).toBeUndefined();
    expect(init.headers.access_token).toBe("production-secret");
  });

  it("fails closed on malformed charge and provider errors",async()=>{
    const client=new AsaasClient("sandbox-secret","sandbox");
    await expect(client.createPixPayment({
      customer:"cus",value:0,dueDate:"2026-10-16",externalReference:"ref",
      driverWalletId:"wallet",driverFixedValue:0,
    })).rejects.toThrow();
    vi.stubGlobal("fetch",vi.fn().mockResolvedValue({ok:false,status:500}));
    await expect(client.getPayment("pay_123")).rejects.toThrow("HTTP 500");
  });
});
