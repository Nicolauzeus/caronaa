import { createServerFn } from "@tanstack/react-start";
import { resolveGoogleMapsBrowserKey } from "./google-maps-key";

// The returned key is public. Restrict browser usage to approved CARONAA HTTP
// referrers/APIs; configure a dedicated browser key ahead of the shared key.
export const getGoogleMapsBrowserKey = createServerFn({
  method: "GET",
}).handler(
  async () => resolveGoogleMapsBrowserKey(process.env, import.meta.env) || null,
);
