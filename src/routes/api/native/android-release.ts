import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/native/android-release")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const { androidReleaseResponse } = await import("@/lib/native/android-release.server");
        const workerRequest = request as Request & {
          runtime?: { cloudflare?: { env?: { CARONAA_ANDROID_RELEASE?: string } } };
        };
        return androidReleaseResponse(
          workerRequest.runtime?.cloudflare?.env?.CARONAA_ANDROID_RELEASE,
        );
      },
    },
  },
});
