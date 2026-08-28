/**
 * Authorization Code + PKCE, run from the inspector in a popup.
 *
 * WHY A POPUP AND NOT A REDIRECT. A whole-page redirect would unmount the
 * island, so the PKCE `code_verifier` would have to survive in sessionStorage
 * and the authorization `code` would land in the inspector's own address bar.
 * Both break rules this component states in writing: nothing is persisted
 * anywhere, and `inspector-deeplink.ts` refuses credential parameters in the
 * URL. In a popup the island is never torn down — the verifier stays in this
 * module's local scope and dies with the tab.
 *
 * WHAT THIS DOES NOT DO. It never stores the token: it returns it to the
 * caller, which keeps it in component state exactly like a pasted one. There
 * is no refresh token handling on purpose — a refresh token is a durable
 * credential, and durable is the one thing the inspector promises not to be.
 */

/** How the caller learns what happened. */
export type OauthResult =
  | { ok: true; token: string }
  | { ok: false; reason: "cancelled" | "denied" | "failed" };

/** Everything the flow needs, straight from `servers.ts`. */
export interface OauthConfig {
  clientId: string;
  authorizationServer: string;
  scopes: string[];
}

/** URL-safe base64 with no padding, which is what RFC 7636 asks for. */
function base64url(bytes: ArrayBuffer): string {
  const binary = String.fromCodePoint(...new Uint8Array(bytes));
  // Padding only ever appears at the end of base64, so dropping every "="
  // is the same as trimming the tail — without a regex that can backtrack.
  return btoa(binary)
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replaceAll("=", "");
}

/** A high-entropy random string, used for both the verifier and the state. */
function randomToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return base64url(bytes.buffer);
}

/**
 * Runs the whole flow and resolves with an access token.
 *
 * @param config The server's OAuth facts.
 * @param redirectUri The registered callback, matched character for character.
 * @returns What happened, and the token when it worked.
 */
export async function signInWithPopup(
  config: OauthConfig,
  redirectUri: string,
): Promise<OauthResult> {
  const verifier = randomToken();
  const state = randomToken();
  const challenge = base64url(
    await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier)),
  );

  const authorize = new URL("/oauth/authorize", config.authorizationServer);
  authorize.searchParams.set("client_id", config.clientId);
  authorize.searchParams.set("redirect_uri", redirectUri);
  authorize.searchParams.set("response_type", "code");
  authorize.searchParams.set("scope", config.scopes.join(" "));
  authorize.searchParams.set("state", state);
  authorize.searchParams.set("code_challenge", challenge);
  authorize.searchParams.set("code_challenge_method", "S256");

  const popup = globalThis.open(
    authorize.href,
    "mcp-inspector-oauth",
    "width=620,height=780",
  );
  if (!popup) return { ok: false, reason: "cancelled" };

  const code = await new Promise<string | null>((resolve) => {
    const onMessage = (event: MessageEvent) => {
      // Both checks matter. The origin check stops any other document from
      // feeding us a code; the state check stops a code from a flow this tab
      // did not start (CSRF, RFC 6749 §10.12).
      if (event.origin !== globalThis.location.origin) return;
      const data = event.data as Record<string, unknown> | null;
      if (data?.source !== "mcp-inspector-oauth") return;
      if (data.state !== state) return;
      cleanup();
      resolve(typeof data.code === "string" ? data.code : null);
    };
    // The visitor can also just close the popup. Polling is the only way to
    // notice: a closed window fires no event.
    const poll = setInterval(() => {
      if (!popup.closed) return;
      cleanup();
      resolve(null);
    }, 500);
    const cleanup = () => {
      globalThis.removeEventListener("message", onMessage);
      clearInterval(poll);
    };
    globalThis.addEventListener("message", onMessage);
  });

  if (!code) return { ok: false, reason: "cancelled" };

  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    client_id: config.clientId,
    redirect_uri: redirectUri,
    code_verifier: verifier,
  });
  // No client secret: the application is public (PKCE). Sending one from a web
  // page would mean publishing it, which is why it is not configured anywhere.
  const response = await fetch(
    new URL("/oauth/token", config.authorizationServer),
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    },
  );
  if (!response.ok) return { ok: false, reason: "denied" };
  const json = (await response.json()) as { access_token?: string };
  return json.access_token
    ? { ok: true, token: json.access_token }
    : { ok: false, reason: "failed" };
}
