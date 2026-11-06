import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getDrivingRoute } from "./road-routing";

const schema = z.object({
  points: z
    .array(
      z.object({
        lat: z.number().finite().min(-90).max(90),
        lng: z.number().finite().min(-180).max(180),
      }),
    )
    .min(2)
    .max(16),
});

// Read-only preview for public forms and the home map. Never persists GPS or
// quotes a fare; publication/participant endpoints keep their authorization.
export const getMapDrivingRoute = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => schema.parse(input))
  .handler(async ({ data }) => getDrivingRoute(data.points));
