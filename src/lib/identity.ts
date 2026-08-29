/**
 * jmrp.io's canonical `#person` node, resolved at BUILD time.
 *
 * THE SAME METHOD as the other documentation sites (libgen-mcp,
 * gitlab-mcp-server, phonometry…): it is downloaded from GitHub with a
 * committed snapshot as a fallback. One method for all six sites, and a build
 * that reproduces on any machine.
 *
 * This used to read `/var/www/jmrp.io/public/identity/person.jsonld` off disk,
 * taking advantage of building on the same machine. That was dropped: GitHub
 * Actions' CI does NOT have that path, so the same commit would have produced
 * a build with an identity in production and without one in CI. Two paths
 * depending on where you build is exactly how one of the two rots without
 * anyone noticing.
 *
 * It is downloaded from `raw.githubusercontent.com` and not from
 * `https://jmrp.io` for the same reason as the other sites: jmrp.io sits
 * behind Cloudflare, CrowdSec and the MikroTik bouncer, where a blocked runner
 * IP would silently degrade the site to a stale snapshot. GitHub serves the
 * same bytes and is already a hard dependency of the build.
 *
 * `import … from "….jsonld"` is NOT used: Vite does not know that extension
 * and rolldown parses the file as JavaScript (PARSE_ERROR, verified).
 *
 * THIS MODULE MUST NEVER BE IMPORTED FROM AN ISLAND (`Inspector.tsx`):
 * `node:fs` in the client bundle breaks the build — which is, in fact, the
 * safety net that guarantees nobody does it by accident.
 */
import fs from "node:fs";
import path from "node:path";

/** The canonical document `jmrp.io/scripts/ci/build-identity.mjs` generates. */
export const IDENTITY_URL =
  process.env.IDENTITY_URL ??
  "https://raw.githubusercontent.com/jmrplens/jmrp.io/main/public/identity/person.jsonld";

/** The committed fallback. Refreshed with `pnpm run identity:sync`. */
export const SNAPSHOT_PATH = path.join(
  process.cwd(),
  "identity",
  "person.snapshot.json",
);

/** The `@id` the document MUST declare; if it changes, the contract broke. */
export const PERSON_ID = "https://jmrp.io/#person";

/** A Person node ready to splice into a `@graph` (its own `@context` removed). */
export type PersonNode = Record<string, unknown>;

/**
 * Checks the contract and strips the document's own `@context`.
 *
 * The `@context` is redundant because the node goes into a `@graph` that
 * already declares one, and a `@context` nested in a graph node is not valid
 * JSON-LD.
 *
 * @param parsed The already-parsed document.
 * @param origin Where it came from, for the error message.
 * @returns The normalized node.
 */
function normalize(parsed: unknown, origin: string): PersonNode {
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new Error(`[identity] ${origin}: not a JSON-LD object`);
  }
  const node = parsed as Record<string, unknown>;
  if (node["@type"] !== "Person" || node["@id"] !== PERSON_ID) {
    throw new Error(
      `[identity] ${origin}: contract broken — @type=${String(node["@type"])} @id=${String(node["@id"])}`,
    );
  }
  // Filtering rather than rest destructuring: `no-unused-vars` has no
  // `varsIgnorePattern` configured in this repo.
  return Object.fromEntries(
    Object.entries(node).filter(([key]) => key !== "@context"),
  );
}

/**
 * Downloads the canonical document; on failure, falls back to the committed
 * snapshot.
 *
 * The fallback's warning is deliberately loud: a stale identity must not be
 * published without anyone seeing it. `scripts/sync-identity.mjs --check`
 * watches in CI that the snapshot is up to date.
 *
 * @returns The Person node, ready for the graph.
 */
export async function loadPersonNode(): Promise<PersonNode> {
  try {
    const response = await fetch(IDENTITY_URL, {
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return normalize(await response.json(), IDENTITY_URL);
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    console.warn(
      `\n⚠ [identity] Could not download the canonical Person entity (${reason}).\n` +
        `  Falling back to the committed snapshot — this build may publish a stale identity.\n` +
        `  Refresh with: pnpm run identity:sync\n`,
    );
    return normalize(
      JSON.parse(fs.readFileSync(SNAPSHOT_PATH, "utf8")) as unknown,
      SNAPSHOT_PATH,
    );
  }
}
