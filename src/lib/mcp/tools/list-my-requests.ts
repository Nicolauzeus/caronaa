import { defineTool, ToolError } from "@lovable.dev/mcp-js";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "list_my_requests",
  title: "Meus pedidos de carona",
  description: "Lista até 20 pedidos recentes do usuário conectado, respeitando suas permissões.",
  inputSchema: {},
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async (_args, ctx) => {
    const client = await supabaseForUser(ctx);
    const { data, error } = await client.from("ride_requests")
      .select("request_id,origin,destination,ride_date,departure_time,status")
      .eq("user_id", ctx.getUserId()).order("created_at", { ascending: false }).limit(20);
    if (error) throw new ToolError("Não foi possível consultar seus pedidos.");
    return { content: [{ type: "text", text: JSON.stringify(data ?? []) }] };
  },
});