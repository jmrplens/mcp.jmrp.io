#!/usr/bin/env node
/**
 * Refreshes the committed snapshots of each MCP's live "surface"
 * (src/data/surface/*.json): the result of `server/discover` for libgen and
 * gitlab, and the reduced `gitlab://tools` action manifest.
 *
 * SAME PATTERN as src/lib/identity.ts and scripts/sync-server-cards.sh: the
 * live source is queried on every build and the committed snapshot is the
 * fallback for builds with no network or no secrets (CI). That is why a
 * network/token/shape failure is SOFT (warning + exit 0, snapshot untouched):
 * a CI build with no credentials has to keep compiling with what is in the
 * repo.
 *
 * PROJECTION BY ALLOWLIST, not passthrough: no unknown future field of the
 * response can slip into the repo (which is public), the icons already live
 * in src/data/cards/<id>.json and duplicating them invites divergence, and
 * the 516 KB manifest is reduced to what the site's surfaces consume: the
 * search box (id, title, domain, destructive, read_only) and, from the
 * per-domain pages, description and required_params as well. The full
 * inputSchema stays out.
 *
 * ANTI-LEAK GUARD (HARD failure, exit 1, before a single byte is written):
 * the author's GitLab instance must never appear in the repo. If any of the
 * hosts in MCP_SURFACE_FORBIDDEN_HOSTS shows up in any downloaded byte or in
 * any serialized snapshot, the whole build chain is aborted. No message in
 * this script prints that variable or the token.
 *
 * The guard has HAD ITS OWN VARIABLE since the endpoint moved to OAuth, and
 * the reason matters: the needles used to be derived from the instance being
 * called, so the moment it stopped calling the internal instance the guard
 * would have disarmed itself — exactly when nobody would be watching it. What
 * it watches is not "do not leak the host you call", it is "the internal host
 * must never get into the repo by any route", and that does not depend on who
 * is being queried. Decoupling it is what keeps it alive.
 *
 * WRITING: deterministic (fixed key order, lists sorted by byte comparison —
 * never localeCompare, which depends on ICU) and only when there is a REAL
 * change ignoring meta.generatedAt: that way `git diff` documents API
 * changes, not build passes, and generatedAt is left as the date of the last
 * real change. Atomic write (temporary file + rename in the same directory),
 * like sync_one in sync-server-cards.sh.
 *
 * The cache hints (ttlMs/cacheScope) are persisted as evidence and honoured
 * by refreshing per build, not per request. `cacheScope: "private"` on gitlab
 * means the catalog is the surface OF THE TOKEN used, not a universal one —
 * hence the site labelling it as obtained "with a Free-tier token" (the
 * site's i18n copy, not this snapshot's: the extractor cannot know the tier).
 *
 * Usage: node scripts/sync-server-surface.mjs
 */
import fs from "node:fs";
import path from "node:path";
import process from "node:process";

// The repo's .env (gitignored) carries MCP_PERSONAL_GITLAB_COM_TOKEN and
// MCP_SURFACE_FORBIDDEN_HOSTS on the
// server. Same pattern as deploy-live-mcp.mjs: `loadEnvFile` does NOT override
// what already comes from the environment (shell > .env; exporting an empty
// value opts out), and with no .env it carries on with whatever is there.
//
// The names carry a project prefix ON PURPOSE. The first version read a bare
// GITLAB_TOKEN/GITLAB_URL and this host's ~/.bashrc exports a GITLAB_TOKEN
// belonging to OTHER tooling: with shell > .env, the script silently inherited
// that token and published the surface of ANOTHER identity (~100 actions of
// difference, without the administration domains; seen on 2026-08-26). A
// generic name turns any unrelated export into an invisible collision; a
// prefixed one cannot collide blindly.
try {
  process.loadEnvFile(new URL("../.env", import.meta.url));
} catch {
  // No .env (CI): carry on with whatever the environment brings.
}

const PROTOCOL_VERSION = "2026-07-28";
const BASE = "https://mcp.jmrp.io";
const SURFACE_DIR = path.join(process.cwd(), "src", "data", "surface");
const TAG = "[sync-server-surface]";

// The endpoint runs with --auth-mode=oauth and the instance PINNED to
// gitlab.com, so the credential is a gitlab.com Bearer and the per-request
// GITLAB-URL header is no longer honoured. A -40100 means the token is no
// good (expired or revoked): soft failure, the committed snapshot is kept.
// It must NEVER end up in a log or in a snapshot.
const GITLAB_TOKEN = process.env.MCP_PERSONAL_GITLAB_COM_TOKEN;

/**
 * Hosts that cannot appear in anything downloaded, written or logged, in
 * lowercase and with their variants with and without a port. They are read
 * from MCP_SURFACE_FORBIDDEN_HOSTS (a comma-separated list) — its OWN
 * variable, not the transport's: see the note in the module header. Empty if
 * it is not defined, and then `main()` refuses to extract anything.
 */
const FORBIDDEN_HOSTS = (() => {
  const raw = process.env.MCP_SURFACE_FORBIDDEN_HOSTS;
  if (!raw) return [];
  const hosts = new Set();
  for (const item of raw.split(",")) {
    const entry = item.trim();
    if (!entry) continue;
    let parsed = [];
    try {
      const u = new URL(entry.includes("://") ? entry : `https://${entry}`);
      parsed = [u.host, u.hostname].filter(Boolean);
    } catch {
      // No scheme and no colon: new URL throws; falls through to the raw value below.
    }
    if (parsed.length === 0) {
      // A value with no scheme ("host.example.com"), OR with a colon and no
      // scheme ("host.example.com:8443"): new URL does NOT throw on the latter
      // — it parses it as a scheme plus an opaque path with an EMPTY host, and
      // without this fallback the guard would silently disarm itself with the
      // variable set. In both cases: the raw value as the host, trimmed in case
      // it carried a port.
      // SAME fallback as resolveNeedles() in
      // tests/unit/surface-guards.test.mjs: if the two resolvers diverge, the
      // build and its safety net inspect different things and a leak could get
      // published.
      parsed = [entry, entry.split(":", 1)[0]];
    }
    for (const h of parsed) {
      if (h) hosts.add(h.toLowerCase());
    }
  }
  return [...hosts];
})();

/**
 * Replaces the forbidden host in a text bound for a log. The server's error
 * messages could echo it; this guarantees not even a failure log prints it.
 */
function sanitizeForLog(text) {
  let out = String(text);
  for (const host of FORBIDDEN_HOSTS) {
    const escaped = host.replaceAll(/[.*+?^${}()|[\]\\]/g, String.raw`\$&`);
    out = out.replaceAll(new RegExp(escaped, "gi"), "[gitlab-host]");
  }
  return out;
}

/** `true` when some text contains the instance's host (case-insensitively). */
function containsForbiddenHost(texts) {
  return texts.some((t) => {
    const lower = t.toLowerCase();
    return FORBIDDEN_HOSTS.some((h) => lower.includes(h));
  });
}

/** Soft-failure warning: the committed snapshot is kept exactly as it is. */
function softWarn(file, reason) {
  console.warn(
    `${TAG} ⚠ ${file}: keeping the committed snapshot (${sanitizeForLog(reason)})`,
  );
}

/**
 * The current instant in ISO-8601 UTC without milliseconds, the format of
 * meta.generatedAt in the snapshots (e.g. "2026-08-26T10:04:00Z").
 */
function nowIso() {
  return new Date().toISOString().replace(/\.\d{3}Z$/, "Z");
}

/**
 * Pulls the JSON-RPC out of a body that may arrive as SSE: if it does not
 * start with "{", the first "data: " line is taken and the prefix stripped.
 */
function parseJsonRpc(raw) {
  const trimmed = raw.trimStart();
  if (trimmed.startsWith("{")) return JSON.parse(trimmed);
  const dataLine = raw.split("\n").find((line) => line.startsWith("data: "));
  if (!dataLine) {
    throw new Error("response with no JSON body and no SSE 'data: ' line");
  }
  return JSON.parse(dataLine.slice("data: ".length));
}

/**
 * A JSON-RPC POST to the given MCP endpoint. Returns the raw text (for the
 * anti-leak guard) and the already-parsed JSON-RPC object. Native fetch and
 * not curl: the token must not appear in any process's command line.
 */
async function postRpc(endpoint, method, params, extraHeaders = {}) {
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json, text/event-stream",
      "MCP-Protocol-Version": PROTOCOL_VERSION,
      "Mcp-Method": method,
      ...extraHeaders,
    },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
    signal: AbortSignal.timeout(30_000),
  });
  const raw = await response.text();
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} en ${endpoint}`);
  }
  return { raw, rpc: parseJsonRpc(raw) };
}

/** server/discover params, with the three _meta keys the protocol requires. */
function discoverParams() {
  return {
    _meta: {
      "io.modelcontextprotocol/protocolVersion": PROTOCOL_VERSION,
      "io.modelcontextprotocol/clientCapabilities": {},
      "io.modelcontextprotocol/clientInfo": {
        name: "mcp-jmrp-io-build",
        version: "1.0.0",
      },
    },
  };
}

/** Byte comparison (a<b), never localeCompare: ICU is not deterministic across machines. */
function byteCompare(a, b) {
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}

const isPlainObject = (v) =>
  typeof v === "object" && v !== null && !Array.isArray(v);
const isNonEmptyString = (v) => typeof v === "string" && v.length > 0;

/**
 * Validates the server/discover result and projects it onto the snapshot's
 * contract. Explicit allowlist: serverInfo is flattened out of _meta and
 * loses `icons` (they already live in src/data/cards/); resultType is
 * required to be "complete" and then discarded (it is a transport detail).
 * Throws when the shape is not the expected one (the caller degrades that to
 * a soft failure).
 */
function buildDiscoverSnapshot(endpoint, result, generatedAt) {
  if (!isPlainObject(result)) throw new Error("result is not an object");
  if (result.resultType !== "complete") {
    throw new Error(
      `resultType ${JSON.stringify(result.resultType)} !== "complete"`,
    );
  }
  const si = result._meta?.["io.modelcontextprotocol/serverInfo"];
  if (
    !isPlainObject(si) ||
    !isNonEmptyString(si.name) ||
    !isNonEmptyString(si.version)
  ) {
    throw new Error("serverInfo without a valid name/version");
  }
  if (
    !Array.isArray(result.supportedVersions) ||
    result.supportedVersions.some((v) => !isNonEmptyString(v))
  ) {
    throw new Error("supportedVersions no es un array de strings");
  }
  if (!isPlainObject(result.capabilities)) {
    throw new Error("capabilities is not an object");
  }

  const serverInfo = { name: si.name };
  if (isNonEmptyString(si.title)) serverInfo.title = si.title;
  if (isNonEmptyString(si.description)) serverInfo.description = si.description;
  serverInfo.version = si.version;
  if (isNonEmptyString(si.websiteUrl)) serverInfo.websiteUrl = si.websiteUrl;

  const snapshot = {
    meta: {
      endpoint,
      method: "server/discover",
      protocolVersion: PROTOCOL_VERSION,
      generatedAt,
    },
    serverInfo,
    supportedVersions: result.supportedVersions,
    // Literal passthrough: the shape of capabilities is the protocol's and the
    // loader (src/data/surface.ts) only reads optional sub-fields.
    capabilities: result.capabilities,
  };
  if (isNonEmptyString(result.instructions)) {
    snapshot.instructions = result.instructions;
  }
  if (typeof result.ttlMs === "number") snapshot.ttlMs = result.ttlMs;
  if (isNonEmptyString(result.cacheScope))
    snapshot.cacheScope = result.cacheScope;
  return snapshot;
}

/**
 * Validates the resources/read JSON-RPC envelope and returns the manifest
 * parsed out of contents[0].text. Extracted from buildActionsSnapshot for
 * S3776: each validation layer with its own name instead of one 29-line
 * function.
 */
function parseManifestEnvelope(result) {
  if (!isPlainObject(result)) throw new Error("result is not an object");
  const content = Array.isArray(result.contents)
    ? result.contents[0]
    : undefined;
  if (
    !isPlainObject(content) ||
    !isNonEmptyString(content.uri) ||
    typeof content.text !== "string"
  ) {
    throw new Error("contents[0] sin uri/text");
  }
  if (
    typeof result.ttlMs !== "number" ||
    !isNonEmptyString(result.cacheScope)
  ) {
    throw new Error("envelope without ttlMs/cacheScope");
  }
  return {
    manifest: JSON.parse(content.text),
    resourceUri: content.uri,
    ttlMs: result.ttlMs,
    cacheScope: result.cacheScope,
  };
}

/** The manifest's minimal shape: header keys and coherent counts. */
function validateManifestHeader(manifest) {
  if (
    !isNonEmptyString(manifest.surface) ||
    !isNonEmptyString(manifest.uri_template)
  ) {
    throw new Error("manifest without surface/uri_template");
  }
  if (
    !Number.isSafeInteger(manifest.entry_count) ||
    !Array.isArray(manifest.entries)
  ) {
    throw new TypeError("manifest without a valid entry_count/entries");
  }
  if (manifest.entry_count !== manifest.entries.length) {
    throw new Error(
      `entry_count ${manifest.entry_count} !== entries.length ${manifest.entries.length}`,
    );
  }
  if (!Array.isArray(manifest.visible_tools)) {
    throw new TypeError("manifest without visible_tools");
  }
}

/**
 * One `{name, type}` pair as 2.7.2's typed required_params publish them.
 * `type` is tolerated as ABSENT: `admin.feature_set`'s `value` ships without
 * one (a feature-flag value is genuinely mixed-type), and rejecting the whole
 * catalog over an untyped param would trade one missing annotation for 851
 * frozen entries. The page simply renders the bare name in that case.
 */
function isTypedParam(x) {
  return (
    isPlainObject(x) &&
    isNonEmptyString(x.name) &&
    (x.type === undefined || isNonEmptyString(x.type))
  );
}

/**
 * `required_params` is optional; when present, an array of `{name, type}`
 * objects (2.7.2 upgraded it from bare name strings, at this site's request —
 * the domain pages render the type next to each parameter).
 */
function hasValidRequiredParams(entry) {
  if (entry.required_params === undefined) return true;
  return (
    Array.isArray(entry.required_params) &&
    entry.required_params.every(isTypedParam)
  );
}

/**
 * `required_params_any_of` is optional: an array of GROUPS, each a non-empty
 * array of `{name, type}` — "at least one of these groups must be satisfied".
 */
function hasValidAnyOfGroups(entry) {
  if (entry.required_params_any_of === undefined) return true;
  return (
    Array.isArray(entry.required_params_any_of) &&
    entry.required_params_any_of.every(
      (group) =>
        Array.isArray(group) && group.length > 0 && group.every(isTypedParam),
    )
  );
}

/** A dynamic_action entry with all its fields correctly typed. */
function isWellTypedAction(entry) {
  return (
    isNonEmptyString(entry.title) &&
    isNonEmptyString(entry.domain) &&
    isNonEmptyString(entry.description) &&
    typeof entry.destructive === "boolean" &&
    typeof entry.read_only === "boolean" &&
    hasValidRequiredParams(entry) &&
    hasValidAnyOfGroups(entry) &&
    (entry.alias_of === undefined || isNonEmptyString(entry.alias_of))
  );
}

/** Validates entries (unique ids, known kinds, fields) and visible_tools. */
function validateManifestEntries(manifest) {
  const seenIds = new Set();
  for (const entry of manifest.entries) {
    if (!isPlainObject(entry)) throw new Error("entry that is not an object");
    if (entry.kind !== "dynamic_action" && entry.kind !== "visible_tool") {
      throw new Error(`unknown kind ${JSON.stringify(entry.kind)}`);
    }
    if (!isNonEmptyString(entry.id) || seenIds.has(entry.id)) {
      throw new Error(`missing or duplicate id ${JSON.stringify(entry.id)}`);
    }
    seenIds.add(entry.id);
    if (entry.kind === "dynamic_action" && !isWellTypedAction(entry)) {
      throw new Error(`entry ${entry.id} has badly typed fields`);
    }
  }
  for (const tool of manifest.visible_tools) {
    if (
      !isPlainObject(tool) ||
      !isNonEmptyString(tool.name) ||
      !isNonEmptyString(tool.title) ||
      typeof tool.destructive !== "boolean" ||
      typeof tool.read_only !== "boolean"
    ) {
      throw new Error("visible_tools has an unexpected shape");
    }
  }
}

/**
 * Validates the gitlab://tools manifest and reduces it to the snapshot's
 * contract: only the kind==="dynamic_action" entries, with the five fields
 * the search box needs, plus the per-domain count precomputed for the SSR.
 * `sourceVersion` ties the catalog to the discover release of the SAME
 * extraction. Throws when the shape does not add up (the caller degrades it
 * to soft).
 */
function buildActionsSnapshot(endpoint, result, sourceVersion, generatedAt) {
  const { manifest, resourceUri, ttlMs, cacheScope } =
    parseManifestEnvelope(result);
  validateManifestHeader(manifest);
  validateManifestEntries(manifest);

  // Projection: fields verbatim from upstream (snake_case read_only included —
  // this is a projection, not a transformation) and a stable order by id.
  //
  // `description` and `required_params` came in with the per-domain pages
  // (/servers/<id>/actions/<domain>/): they are the reference content those
  // pages publish. What stays out — `inputSchema`, `kind`, `tool`,
  // `backing_*`, `detail_uri` — is either derivable or consumed by no surface
  // of the site. The actions.json endpoint does NOT emit these two fields: its
  // projection is separate and stays compact.
  const entries = manifest.entries
    .filter((e) => e.kind === "dynamic_action")
    .map((e) => ({
      id: e.id,
      title: e.title,
      domain: e.domain,
      destructive: e.destructive,
      read_only: e.read_only,
      description: e.description,
      ...(e.required_params && { required_params: e.required_params }),
      ...(e.required_params_any_of && {
        required_params_any_of: e.required_params_any_of,
      }),
      ...(e.alias_of && { alias_of: e.alias_of }),
    }))
    .sort((a, b) => byteCompare(a.id, b.id));

  // Alphabetical order by domain: a change of count is a one-line diff. The
  // SSR reorders by count when rendering. Explicit *Count names so nobody
  // reads them as booleans sitting next to entries.
  const byDomain = new Map();
  for (const e of entries) {
    const d = byDomain.get(e.domain) ?? {
      domain: e.domain,
      count: 0,
      destructiveCount: 0,
      readOnlyCount: 0,
    };
    d.count += 1;
    if (e.destructive) d.destructiveCount += 1;
    if (e.read_only) d.readOnlyCount += 1;
    byDomain.set(e.domain, d);
  }
  const domains = [...byDomain.values()].sort((a, b) =>
    byteCompare(a.domain, b.domain),
  );

  // visible_tools preserves the visible tools that entries excludes:
  // entryCount (upstream provenance: actions + visible_tool entries) and
  // actionCount (the publishable figure, actions only) add up thanks to this
  // list, without depending on any release's concrete counts.
  const visibleTools = manifest.visible_tools
    .map((t) => ({
      name: t.name,
      title: t.title,
      destructive: t.destructive,
      read_only: t.read_only,
    }))
    .sort((a, b) => byteCompare(a.name, b.name));

  return {
    meta: {
      endpoint,
      resourceUri,
      surface: manifest.surface,
      // The UI derives each detail_uri from this template, it does not hardcode it.
      uriTemplate: manifest.uri_template,
      sourceVersion,
      entryCount: manifest.entry_count,
      actionCount: entries.length,
      visibleTools,
      ttlMs,
      cacheScope,
      generatedAt,
    },
    domains,
    entries,
  };
}

/** Canonical serialization of a snapshot (passes `prettier --check` as is). */
function serialize(snapshot) {
  return `${JSON.stringify(snapshot, null, 2)}\n`;
}

/**
 * Writes the snapshot only when it differs from the existing one IGNORING
 * meta.generatedAt: that way a build with no news does not dirty the git tree
 * and generatedAt documents the last real change. Atomic write: a temporary
 * file in the SAME directory (same filesystem ⇒ atomic rename) and a final
 * rename.
 */
function writeIfChanged(target, snapshot) {
  const body = serialize(snapshot);
  let existing;
  try {
    existing = fs.readFileSync(target, "utf8");
  } catch {
    existing = undefined;
  }
  if (existing !== undefined) {
    try {
      const a = JSON.parse(existing);
      const b = JSON.parse(body);
      if (isPlainObject(a.meta)) delete a.meta.generatedAt;
      if (isPlainObject(b.meta)) delete b.meta.generatedAt;
      if (JSON.stringify(a) === JSON.stringify(b)) {
        console.log(`${TAG} = ${path.basename(target)}: no changes`);
        return;
      }
    } catch {
      // Corrupt existing file: it is overwritten with the valid candidate.
    }
  }
  const tmp = path.join(
    path.dirname(target),
    `.${path.basename(target)}.${process.pid}.tmp`,
  );
  fs.writeFileSync(tmp, body);
  fs.renameSync(tmp, target);
  console.log(`${TAG} ✓ ${path.basename(target)}: updated`);
}

/** libgen — server/discover, unauthenticated. Soft failure on its own. */
async function collectLibgenDiscover(pending, generatedAt) {
  try {
    const endpoint = `${BASE}/libgen/mcp`;
    const { raw, rpc } = await postRpc(
      endpoint,
      "server/discover",
      discoverParams(),
    );
    if (rpc.error)
      throw new Error(`JSON-RPC ${rpc.error.code}: ${rpc.error.message}`);
    pending.push({
      target: path.join(SURFACE_DIR, "libgen-discover.json"),
      snapshot: buildDiscoverSnapshot(endpoint, rpc.result, generatedAt),
      raws: [raw],
    });
  } catch (error) {
    softWarn("libgen-discover.json", error.message);
  }
}

/**
 * gitlab · discover. Returns THIS pass's sourceVersion (which ties the
 * catalog to the release) or undefined when it degraded to soft.
 */
async function collectGitlabDiscover(pending, endpoint, generatedAt) {
  try {
    const { raw, rpc } = await postRpc(
      endpoint,
      "server/discover",
      discoverParams(),
      {
        Authorization: `Bearer ${GITLAB_TOKEN}`,
      },
    );
    if (rpc.error)
      throw new Error(`JSON-RPC ${rpc.error.code}: ${rpc.error.message}`);
    const snapshot = buildDiscoverSnapshot(endpoint, rpc.result, generatedAt);
    pending.push({
      target: path.join(SURFACE_DIR, "gitlab-discover.json"),
      snapshot,
      raws: [raw],
    });
    return snapshot.serverInfo.version;
  } catch (error) {
    softWarn("gitlab-discover.json", error.message);
    return; // eslint wants the bare return: the same undefined for the caller
  }
}

/** gitlab · the gitlab://tools manifest, tied to the discover's sourceVersion. */
async function collectGitlabActions(
  pending,
  endpoint,
  sourceVersion,
  generatedAt,
) {
  try {
    // resources/read requires, besides the token, params._meta with the same
    // three keys as discover and the Mcp-Name header carrying the resource's
    // URI (without it the edge answers -32020, verified).
    const uri = "gitlab://tools";
    const { raw, rpc } = await postRpc(
      endpoint,
      "resources/read",
      { uri, _meta: discoverParams()._meta },
      {
        Authorization: `Bearer ${GITLAB_TOKEN}`,
        // Mcp-Name is still mandatory: it identifies the resource being asked for.
        "Mcp-Name": uri,
      },
    );
    if (rpc.error) {
      // -32601 = the method/resource does not exist in this release: not an
      // error, there is simply nothing new to snapshot yet.
      if (rpc.error.code === -32_601) {
        console.log(
          `${TAG} = gitlab-actions.json: resources/read unavailable (-32601)`,
        );
        return;
      }
      throw new Error(`JSON-RPC ${rpc.error.code}: ${rpc.error.message}`);
    }
    pending.push({
      target: path.join(SURFACE_DIR, "gitlab-actions.json"),
      snapshot: buildActionsSnapshot(
        endpoint,
        rpc.result,
        sourceVersion,
        generatedAt,
      ),
      raws: [raw],
    });
  } catch (error) {
    softWarn("gitlab-actions.json", error.message);
  }
}

/**
 * Orchestrates the three extractions. Each one degrades to a soft failure on
 * its own (like sync-server-cards.sh: one MCP being down does not block the
 * other); only the anti-leak guard is a hard failure, and it runs BEFORE
 * anything is written. Flat on purpose (S3776): each phase lives in its own
 * named collect*.
 */
async function main() {
  fs.mkdirSync(SURFACE_DIR, { recursive: true });
  const generatedAt = nowIso();
  // Accumulated candidates: nothing is written until the anti-leak guard passes.
  const pending = [];

  await collectLibgenDiscover(pending, generatedAt);

  // gitlab — the instance is pinned by the server
  // (--gitlab-url=https://gitlab.com), so there is no longer a header choosing
  // it: all that is needed is the Bearer. The guard's variable is STILL
  // required as well, and not because the transport needs it — it does not —
  // but because without needles what was downloaded cannot be inspected, and
  // this script writes nothing derived from gitlab that it could not look at
  // first. In CI with no secrets both snapshots are kept: that IS the fallback
  // semantics.
  if (GITLAB_TOKEN && FORBIDDEN_HOSTS.length > 0) {
    const endpoint = `${BASE}/gitlab/mcp`;
    const sourceVersion = await collectGitlabDiscover(
      pending,
      endpoint,
      generatedAt,
    );
    if (sourceVersion) {
      await collectGitlabActions(pending, endpoint, sourceVersion, generatedAt);
    } else {
      softWarn("gitlab-actions.json", "no discover to tie sourceVersion to");
    }
  } else {
    const reason = GITLAB_TOKEN
      ? "MCP_SURFACE_FORBIDDEN_HOSTS is missing and without it the anti-leak guard cannot be armed"
      : "MCP_PERSONAL_GITLAB_COM_TOKEN is missing";
    softWarn("gitlab-discover.json", reason);
    softWarn("gitlab-actions.json", reason);
  }

  // ANTI-LEAK GUARD — a HARD failure before a single file is written. The RAW
  // downloaded text and each already-serialized snapshot are inspected. The
  // message is generic on purpose: printing the host here would be the leak.
  const inspectable = pending.flatMap((p) => [
    ...p.raws,
    serialize(p.snapshot),
  ]);
  if (containsForbiddenHost(inspectable)) {
    console.error(
      `${TAG} ✗ a response or snapshot contains a forbidden host; extraction aborted without writing anything`,
    );
    process.exit(1);
  }

  for (const p of pending) {
    writeIfChanged(p.target, p.snapshot);
  }
}

await main();
