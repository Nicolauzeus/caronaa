import { beforeEach, describe, expect, it } from "vitest";

import { getCampaignAttribution } from "./funnel-events";

describe("form campaign attribution", () => {
  beforeEach(() => {
    window.sessionStorage.clear();
    window.history.replaceState({}, "", "/formulario");
  });

  it("preserves source and campaign from the URL", () => {
    window.history.replaceState({}, "", "/formulario?src=qr&campaign=sts2026");

    expect(getCampaignAttribution()).toEqual({
      source: "qr",
      campaign: "sts2026",
      campaignEvent: "Siará Tech Summit 2026",
    });
  });

  it("accepts only source and only campaign independently", () => {
    window.history.replaceState({}, "", "/formulario?source=instagram");
    expect(getCampaignAttribution()).toMatchObject({ source: "instagram", campaign: null });

    window.sessionStorage.clear();
    window.history.replaceState({}, "", "/formulario?utm_campaign=sts2026-pre-evento");
    expect(getCampaignAttribution()).toMatchObject({ source: "sts2026", campaign: "sts2026-pre-evento" });
  });

  it("uses the STS form fallback only without a valid parameter", () => {
    expect(getCampaignAttribution()).toEqual({
      source: "sts2026",
      campaign: null,
      campaignEvent: "Siará Tech Summit 2026",
    });
  });

  it("keeps the canonical attribution on reload and navigation between steps", () => {
    window.history.replaceState({}, "", "/formulario?src=qr&campaign=sts2026&event=pre-evento");
    const firstLoad = getCampaignAttribution();

    window.history.replaceState({}, "", "/formulario");
    expect(getCampaignAttribution()).toEqual(firstLoad);
  });

  it("removes control characters and limits parameter size", () => {
    window.history.replaceState({}, "", `/formulario?src=%00qr&campaign=${"x".repeat(130)}`);

    expect(getCampaignAttribution()).toMatchObject({ source: "qr", campaign: "x".repeat(120) });
  });
});
