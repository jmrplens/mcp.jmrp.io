/**
 * Instance/egress topology for the two MCP servers — how many instances run
 * behind each nginx upstream, and which exit node (and country) each one
 * leaves through. The prose it backs is `instancesBody`/`egressBody` in
 * `internals.ts`, and the request-path figure on `/internals/` draws its
 * node pool and its exits from `topology.libgen`.
 *
 * `topology.libgen` is the figure's ILLUSTRATIVE pool of real nodes: the
 * figure shows the mechanism every server uses (client → Cloudflare → nginx
 * → one of N nodes → that node's exit → destination), never libgen vs gitlab
 * — see `InternalsPage.astro`'s header comment for why an earlier version
 * that forked into two branches was rejected. `topology.gitlab` stays here,
 * real and unused by the figure, because the egress prose states both
 * servers' numbers and this file is their one source of truth.
 *
 * GENERATED, not written: the data is `topology.json`, refreshed from the
 * egress census in ops/ by `scripts/sync-topology.sh` and committed. Until
 * 2026-09-01 this file held a hand-written literal "verified against the
 * live upstream" on a date, and by the time anyone looked again it was
 * wrong: a third exit node existed and the page still drew two. Same fix
 * as the Server Cards — a committed snapshot the deploy path refreshes.
 *
 * Kept OUT of `servers.ts` on purpose: `/servers.json`, the JSON-LD graph,
 * the API catalog and the Server Card all build their public output by
 * listing fields explicitly, never by spreading a whole `McpServer`, so
 * this would stay private even living there. It lives here anyway so that
 * guarantee never has to be re-verified for a future consumer of
 * `servers.ts`: `/internals/` is the only reader, by construction.
 *
 * What is published is deliberately small — an exit id and a country per
 * instance. No endpoints, no keys, no host names, no ports.
 */
import raw from "./topology.json";

/** One running instance: the exit node it leaves through, and that node's country. */
export type McpInstance = {
  /** Census id of the exit node (`uk`, `es`, `cam`). Distinct per node, even when two share a country. */
  egress: string;
  /** ISO 3166-1 alpha-2 of that node — what "the country a request appears to come from" means. */
  egressCountry: "ES" | "GB";
};

type ServerId = "libgen" | "gitlab";

/**
 * The same minimum `scripts/sync-topology.sh` enforces before writing the
 * JSON, checked again here so a hand-edited or truncated file fails the
 * build with a message that names the field, not a TypeError deep in the
 * figure's geometry.
 */
function validate(input: unknown): Record<ServerId, McpInstance[]> {
  if (typeof input !== "object" || input === null) {
    throw new Error("topology.json: not an object");
  }
  const out = {} as Record<ServerId, McpInstance[]>;
  for (const server of ["libgen", "gitlab"] as const) {
    const list = (input as Record<string, unknown>)[server];
    if (!Array.isArray(list) || list.length === 0) {
      throw new Error(`topology.json: "${server}" must be a non-empty array`);
    }
    out[server] = list.map((item, i) => {
      const o = item as Record<string, unknown>;
      const egress = o.egress;
      const country = o.egressCountry;
      if (typeof egress !== "string" || egress.length === 0) {
        throw new Error(`topology.json: ${server}[${i}].egress missing`);
      }
      if (country !== "ES" && country !== "GB") {
        throw new Error(
          `topology.json: ${server}[${i}].egressCountry must be "ES" or "GB", got ${JSON.stringify(country)}`,
        );
      }
      return { egress, egressCountry: country };
    });
  }
  return out;
}

export const topology: Record<ServerId, McpInstance[]> = validate(raw);
