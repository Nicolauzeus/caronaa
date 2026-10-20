import { describe, expect, it } from "vitest";
import { oauthReturnPath } from "./oauth-return-path";

describe("OAuth return paths", () => {
  it("preserves consent authorization and fragment", () => {
    expect(oauthReturnPath("/.lovable/oauth/consent?authorization_id=abc#decision")).toBe("/.lovable/oauth/consent?authorization_id=abc#decision");
  });
  it.each(["https://outside.invalid", "//outside.invalid", "/\\outside.invalid", "/bad\npath", null])("rejects unsafe return path %s", value => {
    expect(oauthReturnPath(value)).toBe("/");
  });
});