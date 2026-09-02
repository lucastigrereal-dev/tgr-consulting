import { describe, expect, it } from "vitest";
import { OAUTH_STATE_COOKIE } from "@shared/const";
import {
  DEV_OAUTH_STATE_COOKIE,
  getOAuthStateCookieForProtocol,
  resolveLoginDestination,
} from "./const";

describe("OAuth state cookie client options", () => {
  it("mantém __Host seguro em HTTPS e usa cookie local em HTTP", () => {
    expect(getOAuthStateCookieForProtocol("https:")).toEqual({
      name: OAUTH_STATE_COOKIE,
      attributes: "Path=/; Max-Age=600; SameSite=None; Secure",
    });
    expect(getOAuthStateCookieForProtocol("http:")).toEqual({
      name: DEV_OAUTH_STATE_COOKIE,
      attributes: "Path=/; Max-Age=600; SameSite=Lax",
    });
  });
});

describe("login destination", () => {
  it("leva staging_password para login local e preserva OAuth nos demais modos", () => {
    expect(resolveLoginDestination("staging_password")).toBe("/login");
    expect(resolveLoginDestination("oauth")).toBe("oauth");
    expect(resolveLoginDestination(undefined)).toBe("oauth");
  });
});
