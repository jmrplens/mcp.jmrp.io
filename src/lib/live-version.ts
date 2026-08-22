/**
 * Running version of a deployed MCP server, read at build time.
 *
 * The Server Cards must not contradict what a client sees once connected, and
 * hardcoding the version guaranteed they eventually would: the updater bumps
 * the containers hourly and the site is deployed far less often. Reading it at
 * build time closes most of that gap — the card is then accurate as of the
 * deploy rather than as of whenever someone last edited `servers.ts`.
 *
 * It cannot close the gap entirely (an update between two site deploys still
 * drifts), which is exactly why the Server Card spec calls cards "advisory
 * rather than binding" and tells clients to prefer the live `initialize`
 * response. The `version` in `servers.ts` remains as the fallback.
 *
 * Never fails a build: no network, a stopped container or a server that does
 * not publish a version all fall back to the declared value.
 */

/** How long to wait for /health before giving up and using the fallback. */
const TIMEOUT_MS = 2000;

/**
 * Reads the version a server reports on its health endpoint.
 *
 * @param endpoint Public endpoint of the server, e.g. `https://…/libgen`.
 * @param fallback Version declared in `src/data/servers.ts`.
 * @returns The live version, or `fallback` when it cannot be read.
 */
export async function liveVersion(
  endpoint: string,
  fallback: string,
): Promise<string> {
  try {
    const response = await fetch(`${endpoint}/health`, {
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!response.ok) return fallback;
    const body: unknown = await response.json();
    const version = (body as { version?: unknown })?.version;
    return typeof version === "string" && version ? version : fallback;
  } catch {
    // Offline build, container down, or a body that is not JSON: the declared
    // value is the honest answer, not an error.
    return fallback;
  }
}
