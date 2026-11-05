import { createServerFn } from "@tanstack/react-start";

/**
 * This is a BROWSER key: the client must receive it to load Google Maps JS.
 * It is not interchangeable with GOOGLE_MAPS_API_KEY (private Places backend).
 * Restrict this key to CARONAA HTTP referrers and approved APIs in Google Cloud.
 *
 * Serving it from a project secret avoids committing it into GitHub or Vite's
 * source .env, but it does NOT make the key confidential to browser users.
 */
export const getGoogleMapsBrowserKey = createServerFn({ method: "GET" })
  .handler(async () => {
    const key = process.env.GOOGLE_MAPS_BROWSER_API_KEY?.trim();
    return key || null;
  });
