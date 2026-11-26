// Public half of the CARONAA Web Push VAPID pair. Safe to ship to browsers;
// the private half lives only in the server secret VAPID_PRIVATE_KEY.
export const VAPID_PUBLIC_KEY =
  (import.meta.env["VITE_VAPID_PUBLIC_KEY"] as string | undefined) ||
  "BEwgC_Ah0P2aoI8QmYxMx_DJ55MpK9TvGL_nRtWcTKUlpfH0XkhFrb5t9JBnPZGAMac5YLcec9hscweSW3lx7sg";
