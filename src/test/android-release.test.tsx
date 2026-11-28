import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AndroidUpdateNotice } from "@/components/caronaa/AndroidUpdateNotice";
import { checkAndroidUpdate } from "@/lib/native/android-release-client";
import { androidReleaseResponse } from "@/lib/native/android-release.server";

const app = vi.hoisted(() => ({ native: true, getInfo: vi.fn() }));
vi.mock("@capacitor/app", () => ({ App: { getInfo: app.getInfo } }));
vi.mock("@/lib/native/capacitor-bridge", () => ({
  isNativePluginAvailable: () => app.native,
  onNativeAppResume: () => () => {},
}));

const release = {
  versionCode: 10,
  versionName: "1.10",
  downloadUrl: "https://downloads.caronaa.com/android/caronaa-1.10.apk",
};
const fetchManifest = vi.fn();

beforeEach(() => {
  app.native = true;
  app.getInfo.mockReset().mockResolvedValue({ id: "com.caronaa.app", build: "9" });
  fetchManifest.mockReset().mockImplementation(async () => Response.json(release));
  vi.stubGlobal("fetch", fetchManifest);
  localStorage.clear();
});
afterEach(() => vi.unstubAllGlobals());

describe("Android release endpoint", () => {
  it("returns only the public manifest without caching", async () => {
    const response = androidReleaseResponse(JSON.stringify({ ...release, extra: "ignored" }));
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.json()).toEqual(release);
  });

  it.each([
    "",
    "{",
    JSON.stringify({ ...release, versionCode: 0 }),
    JSON.stringify({
      ...release,
      downloadUrl: "https://downloads.caronaa.com.example/android/app.apk",
    }),
    JSON.stringify({
      ...release,
      downloadUrl: "https://downloads.caronaa.com/android/app.apk?redirect=bad",
    }),
    JSON.stringify({
      ...release,
      downloadUrl: "https://downloads.caronaa.com/android/not-an-apk.html",
    }),
  ])("leaves the update disabled for an invalid release (%s)", async (raw) => {
    const response = androidReleaseResponse(raw);
    expect(response.status).toBe(204);
    expect(await response.text()).toBe("");
  });
});

describe("Android update check", () => {
  it("compares the numeric Android build, without sending account credentials", async () => {
    expect(await checkAndroidUpdate(new AbortController().signal)).toEqual(release);
    expect(fetchManifest).toHaveBeenCalledWith(
      "/api/native/android-release",
      expect.objectContaining({ credentials: "omit", cache: "no-store", redirect: "error" }),
    );
  });

  it.each(["10", "11"])("keeps the existing app on current or newer build %s", async (build) => {
    app.getInfo.mockResolvedValue({ id: "com.caronaa.app", build });
    expect(await checkAndroidUpdate(new AbortController().signal)).toBeNull();
  });

  it("skips web browsers and other application IDs", async () => {
    app.native = false;
    expect(await checkAndroidUpdate(new AbortController().signal)).toBeNull();
    expect(app.getInfo).not.toHaveBeenCalled();
    app.native = true;
    app.getInfo.mockResolvedValue({ id: "another.app", build: "9" });
    expect(await checkAndroidUpdate(new AbortController().signal)).toBeNull();
    expect(fetchManifest).not.toHaveBeenCalled();
  });

  it("keeps the app usable without an announced version", async () => {
    fetchManifest.mockResolvedValue(new Response(null, { status: 204 }));
    expect(await checkAndroidUpdate(new AbortController().signal)).toBeNull();
  });

  it("can dismiss the home notice and still get the APK in Profile", async () => {
    const query = new QueryClient();
    const notice = (fromProfile: boolean) => (
      <QueryClientProvider client={query}>
        <AndroidUpdateNotice fromProfile={fromProfile} />
      </QueryClientProvider>
    );
    const { rerender } = render(notice(false));
    const link = await screen.findByRole("link", { name: "Atualizar app" });
    expect(link).toHaveAttribute("href", release.downloadUrl);
    fireEvent.click(screen.getByRole("button", { name: /Adiar aviso/ }));
    expect(screen.queryByRole("link", { name: "Atualizar app" })).not.toBeInTheDocument();
    rerender(notice(true));
    expect(screen.getByRole("link", { name: "Atualizar app" })).toBeInTheDocument();
    expect(fetchManifest).toHaveBeenCalledTimes(1);
  });
});
