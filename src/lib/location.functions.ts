import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import {
  searchLocationsService,
  getLocationDetailsService,
  isLocationServiceConfigured,
  getLocationProviderName,
  getMissingLocationConfig,
} from "./location/service";

const searchQuerySchema = z.object({
  query: z.string().max(200),
});

const placeDetailsSchema = z.object({
  placeId: z.string().trim().min(1).max(250),
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

export const getLocationConfigStatusServerFn = createServerFn({ method: "GET" })
  .handler(async () => {
    return {
      isConfigured: isLocationServiceConfigured(),
      provider: getLocationProviderName(),
      missingEnvVars: getMissingLocationConfig(),
    };
  });
