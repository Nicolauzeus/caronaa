import { auth, defineMcp } from "@lovable.dev/mcp-js";
import listMyOffers from "./tools/list-my-offers";
import listMyRequests from "./tools/list-my-requests";

const projectRef = import.meta.env.VITE_SUPABASE_PROJECT_ID ?? "project-ref-unset";

export default defineMcp({
  name: "caronaa",
  title: "Caronaa",
  version: "0.1.0",
  instructions: "Consulte os pedidos e ofertas do usuário conectado à CARONAA. As ferramentas são somente leitura e preservam as permissões da conta. Não publicam, aceitam ou cancelam caronas e não acessam chaves Pix.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
    requireOAuthClientClaim: true,
  }),
  tools: [listMyOffers, listMyRequests],
});