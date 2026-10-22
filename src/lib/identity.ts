/**
 * jmrp.io's canonical `#person` node, resolved at BUILD time.
 *
 * Downloaded from GitHub like the other documentation sites do (libgen-mcp,
 * gitlab-mcp-server, phonometry…), with one difference: the fallback snapshot
 * is NOT versioned here. Every build that downloads the document rewrites
 * `identity/person.snapshot.json`, so the snapshot follows jmrp.io by itself
 * and no pull request is needed after each change to the canonical entity
 * (the author's decision, 2026-10-22). The cost is that a machine that has
 * never downloaded it has no fallback, and its build stops on a network
 * failure instead of publishing a stale identity.
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

/**
 * The local, unversioned fallback (git-ignored). Rewritten by every build that
 * downloads the document; `pnpm run identity:sync` writes it without a build.
 */
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
 * Writes the downloaded document to the local snapshot, in the same bytes
 * `scripts/sync-identity.mjs` writes, and only when they changed: the graph is
 * built once per page, and every page calls {@link loadPersonNode}.
 *
 * Best effort: a snapshot that cannot be written costs only the next offline
 * build its fallback, so it warns instead of failing this one.
 *
 * @param document The canonical document as downloaded, `@context` included.
 */
function writeSnapshot(document: unknown): void {
  const bytes = `${JSON.stringify(document, null, 2)}\n`;
  try {
    if (
      fs.existsSync(SNAPSHOT_PATH) &&
      fs.readFileSync(SNAPSHOT_PATH, "utf8") === bytes
    ) {
      return;
    }
    fs.mkdirSync(path.dirname(SNAPSHOT_PATH), { recursive: true });
    fs.writeFileSync(SNAPSHOT_PATH, bytes);
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    console.warn(`⚠ [identity] Could not refresh ${SNAPSHOT_PATH}: ${reason}`);
  }
}

/**
 * Downloads the canonical document and refreshes the local snapshot with it;
 * on failure, falls back to that snapshot.
 *
 * The fallback's warning is deliberately loud: a stale identity must not be
 * published without anyone seeing it.
 *
 * @returns The Person node, ready for the graph.
 */
export async function loadPersonNode(): Promise<PersonNode> {
  try {
    const response = await fetch(IDENTITY_URL, {
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const document: unknown = await response.json();
    const node = normalize(document, IDENTITY_URL);
    writeSnapshot(document);
    return node;
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    console.warn(
      `\n⚠ [identity] Could not download the canonical Person entity (${reason}).\n` +
        `  Falling back to the local snapshot, written by the last build that could download it: this build may publish a stale identity.\n` +
        `  Refresh with: pnpm run identity:sync\n`,
    );
    let cached: string;
    try {
      cached = fs.readFileSync(SNAPSHOT_PATH, "utf8");
    } catch {
      throw new Error(
        `[identity] ${SNAPSHOT_PATH}: no local snapshot either. This machine has never downloaded the canonical entity, so the build stops rather than publish a page without one.`,
      );
    }
    return normalize(JSON.parse(cached) as unknown, SNAPSHOT_PATH);
  }
}
