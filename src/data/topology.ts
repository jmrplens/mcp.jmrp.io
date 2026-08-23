/**
 * Instance/egress topology for the two MCP servers — how many instances run
 * behind nginx for each one, in the same order as its real `upstream` block
 * (see `docs/nginx-vhost-reference.conf`), and which country each instance's
 * egress proxy exits through. The prose it backs is `instancesBody`/
 * `egressBody` in `internals.ts` (three instances per server, egress split
 * cross-wise between the two).
 *
 * `InternalsPage.astro`'s request-path diagram also draws from this: it
 * uses `topology.libgen` as ITS illustrative pool of real nodes. That is
 * deliberate, not an oversight — the diagram draws ONE static strip (client
 * → Cloudflare → nginx → one of N nodes → egress → destination) plus a
 * five-bubble annotation sequence that describes the mechanism in general
 * terms, never singling out libgen vs gitlab or which node a given request
 * actually lands on (see that component's header comment for the full
 * rationale, and for why an earlier version that forked into a libgen
 * branch and a gitlab branch was rejected). So it no longer needs, or
 * draws, two separate node pools side by side. `topology.gitlab` stays
 * here, real and unused by the diagram, because the egress prose above
 * still states its numbers precisely and this file is their one source of
 * truth.
 *
 * Kept OUT of `servers.ts` on purpose, even though nothing there would leak
 * it today: `/servers.json` (`servers.json.ts`), the JSON-LD graph
 * (`jsonld.ts`), the API catalog (`api-catalog.ts`) and the Server Card
 * (`server-card.ts`) all build their public output by listing fields
 * explicitly, never by spreading a whole `McpServer` — so this array would
 * stay private even living there. It lives here anyway so that guarantee
 * never has to be re-verified for a future consumer of `servers.ts`:
 * `/internals/` is the only reader of this file, by construction, and
 * `servers.ts`'s own header comment describes it as the source for
 * `/servers.json`, the site pages and the inspector — capability metadata,
 * not infrastructure topology.
 *
 * Descriptive, not generative: changing this array does not change nginx.
 * If the real upstream changes, this is updated by hand in the same commit —
 * same discipline `servers.ts` already asks for `version`/`tools`.
 */
export type McpInstance = { egressCountry: "ES" | "GB" };

export const topology: Record<"libgen" | "gitlab", McpInstance[]> = {
  // Verified against the live upstream 2026-08-22: 3 instances, egress split
  // cross-wise between the two servers.
  libgen: [{ egressCountry: "ES" }, { egressCountry: "ES" }, { egressCountry: "GB" }],
  gitlab: [{ egressCountry: "GB" }, { egressCountry: "GB" }, { egressCountry: "ES" }],
};
