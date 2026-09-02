import { OAUTH_STATE_COOKIE, encodeOAuthState } from "@shared/const";

export { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";

export const DEV_OAUTH_STATE_COOKIE = "oauth_state";

export function resolveLoginDestination(authMode: string | undefined) {
  return authMode === "staging_password" ? "/login" : "oauth";
}

export function getOAuthStateCookieForProtocol(protocol: string) {
  const isSecure = protocol === "https:";
  return {
    name: isSecure ? OAUTH_STATE_COOKIE : DEV_OAUTH_STATE_COOKIE,
    attributes: isSecure
      ? "Path=/; Max-Age=600; SameSite=None; Secure"
      : "Path=/; Max-Age=600; SameSite=Lax",
  };
}

function getOAuthStateCookieForCurrentOrigin() {
  return getOAuthStateCookieForProtocol(window.location.protocol);
}

// Start the Manus OAuth login. Call this from an event handler or effect at the
// moment you want to navigate, e.g. `onClick={() => startLogin()}`.
//
// It has SIDE EFFECTS — it mints a one-time nonce, writes the __Host- state
// cookie, and navigates immediately — so the cookie nonce always matches the
// `state` it sends. Do NOT call it during render (no `href={startLogin()}` /
// `loginUrl={...}`): each call overwrites the cookie, so a stray render-phase
// call would desync it from an in-flight login and the callback would reject it
// with "invalid oauth state". It returns void by design, so there is no URL to
// stash across renders.
export const startLogin = () => {
  if (resolveLoginDestination(import.meta.env.VITE_AUTH_MODE) === "/login") {
    window.location.href = "/login";
    return;
  }
  const oauthPortalUrl = import.meta.env.VITE_OAUTH_PORTAL_URL;
  const appId = import.meta.env.VITE_APP_ID;
  const redirectUri = `${window.location.origin}/api/oauth/callback`;

  const nonce = crypto.randomUUID();
  const stateCookie = getOAuthStateCookieForCurrentOrigin();
  document.cookie = `${stateCookie.name}=${nonce}; ${stateCookie.attributes}`;
  const state = encodeOAuthState({ redirectUri, nonce });

  const url = new URL(`${oauthPortalUrl}/app-auth`);
  url.searchParams.set("appId", appId);
  url.searchParams.set("redirectUri", redirectUri);
  url.searchParams.set("state", state);
  url.searchParams.set("type", "signIn");

  window.location.href = url.toString();
};
