import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import {
  searchLocationsService,
  getLocationDetailsService,
  geocodeAddressService,
  isLocationServiceConfigured,
  getLocationProviderName,
  getMissingLocationConfig,
  reverseGeocodeService,
} from "./location/service";

export const reverseGeocodeServerFn = createServerFn({ method: "POST" })
  .validator((input: unknown) =>
    z
      .object({
        lat: z.number().finite().min(-90).max(90),
        lng: z.number().finite().min(-180).max(180),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    try {
      const { optionalGoogleSearchFetch } = await import("./google-search-access.server");
      const request = await optionalGoogleSearchFetch("details", "reverseGeocodeServerFn");
      return await reverseGeocodeService(data.lat, data.lng, request);
    } catch {
      console.warn("[Location] Reverse geocoding unavailable");
      return null;
    }
  });

const searchQuerySchema = z.object({
  query: z.string().max(200),
  sessionToken: z.string().trim().max(100).uuid().optional(),
});

const placeDetailsSchema = z.object({
  placeId: z.string().trim().min(1).max(250),
  sessionToken: z.string().trim().max(100).uuid().optional(),
});

const geocodeQuerySchema = z.object({
  address: z.string().trim().min(1).max(300),
});

export const searchLocationsServerFn = createServerFn({ method: "POST" })
  .validator((input: unknown) => searchQuerySchema.parse(input))
  .handler(async ({ data }) => {
    const { optionalGoogleSearchFetch } = await import("./google-search-access.server");
    return await searchLocationsService(data.query, data.sessionToken, await optionalGoogleSearchFetch("autocomplete", "searchLocationsServerFn"));
  });

export const getLocationDetailsServerFn = createServerFn({ method: "POST" })
  .validator((input: unknown) => placeDetailsSchema.parse(input))
  .handler(async ({ data }) => {
    const { optionalGoogleSearchFetch } = await import("./google-search-access.server");
    return await getLocationDetailsService(data.placeId, data.sessionToken, await optionalGoogleSearchFetch("details", "getLocationDetailsServerFn"));
  });

export const geocodeAddressServerFn = createServerFn({ method: "POST" })
  .validator((input: unknown) => geocodeQuerySchema.parse(input))
  .handler(async ({ data }) => {
    const { optionalGoogleSearchFetch } = await import("./google-search-access.server");
    return await geocodeAddressService(data.address, await optionalGoogleSearchFetch("details", "geocodeAddressServerFn"));
  });

export const getLocationConfigStatusServerFn = createServerFn({
  method: "GET",
}).handler(async () => {
  return {
    isConfigured: isLocationServiceConfigured(),
    provider: getLocationProviderName(),
    missingEnvVars: getMissingLocationConfig(),
  };
});
