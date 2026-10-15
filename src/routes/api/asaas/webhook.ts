import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { classifyAsaasPaymentEvent, validWebhookToken } from "@/lib/payments/asaas-events";
import { verifyAsaasWebhookPayment } from "@/lib/payments/webhook-verification";

// Intentionally inbox-only: financial status transitions are NOT performed by this endpoint.
// Reconciliation and provider split settlement must be implemented/tested separately.
const checkoutSchema = z.object({
  id: z.string().uuid(),
  asaas_payment_id: z.string().min(1),
  passenger_total_cents: z.coerce.number().int().positive(),
  driver_fixed_cents: z.coerce.number().int().positive(),
  platform_target_cents: z.coerce.number().int().positive(),
});
type DbError = { code?: string; message: string } | null;
type DbTable = {
  select: (cols: string) => {
    eq: (field: string, value: string) => {
      maybeSingle: () => Promise<{ data: unknown; error: DbError }>;
    };
  };
  insert: (value: Record<string, unknown>) => Promise<{ error: DbError }>;
};

export const Route = createFileRoute("/api/asaas/webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        if (!validWebhookToken(
          request.headers.get("asaas-access-token"),
          process.env["ASAAS_WEBHOOK_AUTH_TOKEN"],
        )) return Response.json({ error: "Unauthorized" }, { status: 401 });

        // Until a separate production release gate is audited, accept sandbox events only.
        if (process.env["ASAAS_ENV"] !== "sandbox")
          return Response.json({ error: "Sandbox only" }, { status: 503 });

        const raw = await request.text();
        if (raw.length > 131072) return Response.json({ error: "Payload too large" }, { status: 413 });

        let payload: unknown;
        try {
          payload = JSON.parse(raw);
        } catch {
          return Response.json({ error: "Invalid JSON" }, { status: 400 });
        }

        let decision: ReturnType<typeof classifyAsaasPaymentEvent>;
        try {
          decision = classifyAsaasPaymentEvent(payload);
        } catch {
          return Response.json({ error: "Invalid payment event" }, { status: 400 });
        }
        if (decision.type === "IGNORE")
          return Response.json({ accepted: true, ignored: true });

        try {
          const [{ AsaasClient }, { supabaseAdmin }] = await Promise.all([
            import("@/lib/payments/asaas"),
            import("@/integrations/supabase/client.server"),
          ]);
          const key = process.env["ASAAS_API_KEY"];
          if (!key) return Response.json({ error: "Payment provider unavailable" }, { status: 503 });
          const db = supabaseAdmin as unknown as { from: (name: string) => DbTable };
          const { data, error } = await db.from("asaas_checkout_intents")
            .select("id,asaas_payment_id,passenger_total_cents,driver_fixed_cents,platform_target_cents")
            .eq("asaas_payment_id", decision.paymentId).maybeSingle();
          if (error || !data)
            return Response.json({ error: "Checkout not ready" }, { status: 503 });
          const persisted = checkoutSchema.parse(data);
          const provider = await new AsaasClient(key, "sandbox").getPayment(decision.paymentId);
          const verified = verifyAsaasWebhookPayment(payload, provider, {
            id: persisted.id, asaasPaymentId: persisted.asaas_payment_id,
            passengerTotalCents: persisted.passenger_total_cents,
            driverFixedCents: persisted.driver_fixed_cents,
            platformTargetNetCents: persisted.platform_target_cents,
          });
          if (!verified) return Response.json({ accepted: true, ignored: true });
          const { error: insertError } = await db.from("asaas_webhook_inbox").insert({
            event_id: verified.decision.eventId,
            payment_id: verified.decision.paymentId,
            event_type: verified.decision.type,
            payload,
            // Stay unprocessed until a separate transactional processor confirms state.
            process_error: verified.reconciliation === "DIVERGENT"
              ? "NET_AMOUNT_MISMATCH" : null,
          });
          if (insertError?.code === "23505") return Response.json({ accepted: true, duplicate: true });
          if (insertError) return Response.json({ error: "Could not persist webhook" }, { status: 503 });
          return Response.json({ accepted: true, queued: true });
        } catch {
          // Do not leak provider responses, tokens or customer data in public errors.
          return Response.json({ error: "Webhook processing unavailable" }, { status: 503 });
        }
      },
    },
  },
});
