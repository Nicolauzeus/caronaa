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
  .inputValidator((input: unknown) =>
    z
      .object({
        lat: z.number().finite().min(-90).max(90),
        lng: z.number().finite().min(-180).max(180),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    try {
      return await reverseGeocodeService(data.lat, data.lng);
    } catch (error) {
      console.warn("[Location] Reverse geocoding unavailable", error);
      return null;
    }
  });

const searchQuerySchema = z.object({
  query: z.string().max(200),
});

const placeDetailsSchema = z.object({
  placeId: z.string().trim().min(1).max(250),
});

const geocodeQuerySchema = z.object({
  address: z.string().trim().min(1).max(300),
});

export const searchLocationsServerFn = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => searchQuerySchema.parse(input))
  .handler(async ({ data }) => {
    return await searchLocationsService(data.query);
  });

export const getLocationDetailsServerFn = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => placeDetailsSchema.parse(input))
  .handler(async ({ data }) => {
    return await getLocationDetailsService(data.placeId);
  });

export const geocodeAddressServerFn = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => geocodeQuerySchema.parse(input))
  .handler(async ({ data }) => {
    return await geocodeAddressService(data.address);
  });

export const getLocationConfigStatusServerFn = createServerFn({ method: "GET" }).handler(
  async () => {
    return {
      isConfigured: isLocationServiceConfigured(),
      provider: getLocationProviderName(),
      missingEnvVars: getMissingLocationConfig(),
    };
  },
);
