import { createFileRoute } from "@tanstack/react-router";
export const Route = createFileRoute("/api/native/driver-location")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { handleNativeDriverLocation } = await import("@/lib/native-driver-location.server");
        return handleNativeDriverLocation(request);
      },
    },
  },
});
