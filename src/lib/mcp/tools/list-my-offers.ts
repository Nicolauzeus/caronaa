import { defineTool, ToolError } from "@lovable.dev/mcp-js";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "list_my_offers",
  title: "Minhas ofertas de carona",
  description: "Lista até 20 ofertas recentes do usuário conectado, sem dados de outros usuários ou pagamento.",
  inputSchema: {},
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async (_args, ctx) => {
    const client = await supabaseForUser(ctx);
    const { data, error } = await client.from("ride_offers")
      .select("offer_id,origin,destination,ride_date,departure_time,status")
      .eq("user_id", ctx.getUserId()).order("created_at", { ascending: false }).limit(20);
    if (error) throw new ToolError("Não foi possível consultar suas ofertas.");
    return { content: [{ type: "text", text: JSON.stringify(data ?? []) }] };
  },
});