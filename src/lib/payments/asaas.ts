/** Server-only Asaas adapter. Never import into client components. */
import { z } from "zod";

export const asaasPaymentResponse = z.object({
  id: z.string().min(1),
  status: z.string().min(1),
  value: z.number().nonnegative(),
  netValue: z.number().nonnegative().optional(),
  externalReference: z.string().optional().nullable(),
});
export const asaasPixResponse = z.object({
  encodedImage: z.string().min(1),
  payload: z.string().min(1),
  expirationDate: z.string().optional().nullable(),
});
const baseUrls = {
  sandbox: "https://api-sandbox.asaas.com/v3",
  production: "https://api.asaas.com/v3",
} as const;

export class AsaasClient {
  private readonly baseUrl: string;
  constructor(private readonly apiKey: string, environment: "sandbox" | "production" = "sandbox") {
    if (!apiKey.trim()) throw new Error("ASAAS_API_KEY is required");
    this.baseUrl = baseUrls[environment];
  }

  private async call(path: string, method: "GET" | "POST", data?: unknown) {
    const response = await fetch(this.baseUrl + path, {
      method,
      headers: {
        access_token: this.apiKey,
        accept: "application/json",
        "Content-Type": "application/json",
        "User-Agent": "CARONAA/1.0 (payments)",
      },
      body: data === undefined ? undefined : JSON.stringify(data),
      signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) {
      // No raw response: provider errors can contain sensitive customer information.
      throw new Error("Falha na API Asaas (HTTP " + response.status + ")");
    }
    return response.json() as Promise<unknown>;
  }

  async createPixPayment(input: {
    customer: string; value: number; dueDate: string; externalReference: string;
    driverWalletId: string; driverFixedValue: number;
  }) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(input.dueDate) ||
        !input.customer.trim() || !input.externalReference.trim() ||
        !input.driverWalletId.trim() || !Number.isFinite(input.value) ||
        !Number.isFinite(input.driverFixedValue) || input.value <= 0 ||
        input.driverFixedValue <= 0 || input.driverFixedValue > input.value) {
      throw new Error("Invalid Pix payment input");
    }
    // Only the platform backend may call this after checking persisted reservation
    // and confirmed fee/split budget. Never expose this adapter as a direct public endpoint.
    return asaasPaymentResponse.parse(await this.call("/payments", "POST", {
      customer: input.customer,
      billingType: "PIX",
      value: input.value,
      dueDate: input.dueDate,
      externalReference: input.externalReference,
      split: [{ walletId: input.driverWalletId, fixedValue: input.driverFixedValue }],
    }));
  }

  /** A harmless GET that validates the server API key and registration approval. */
  async getAccountStatus(): Promise<{ general: string }> {
    const response = z.object({ general: z.string().min(1) }).parse(
      await this.call("/myAccount/status", "GET"),
    );
    return { general: response.general };
  }

  async getPixQrCode(paymentId: string) {
    if (!/^pay_[A-Za-z0-9]+$/.test(paymentId)) throw new Error("Invalid Asaas payment identifier");
    return asaasPixResponse.parse(await this.call("/payments/" + paymentId + "/pixQrCode", "GET"));
  }

  async getPayment(paymentId: string) {
    if (!/^pay_[A-Za-z0-9]+$/.test(paymentId)) throw new Error("Invalid Asaas payment identifier");
    return asaasPaymentResponse.parse(await this.call("/payments/" + paymentId, "GET"));
  }
}
