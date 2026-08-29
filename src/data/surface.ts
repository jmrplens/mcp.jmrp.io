/**
 * Typed view over the committed "surface" snapshots under
 * `src/data/surface/`: each server's `server/discover` result and the
 * reduced `gitlab://tools` action manifest.
 *
 * WHERE THE DATA COMES FROM
 * `scripts/sync-server-surface.mjs` refreshes these files on every build
 * (same pattern as `src/lib/identity.ts`: build-time fetch, committed
 * snapshot as the fallback for builds without network or secrets). The
 * extractor is the party that validates HARD before writing — whitelisted
 * projection, anti-leak guard, deterministic serialization — so this module
 * only re-checks the minimum it depends on.
 *
 * WHY `fs.readFileSync` AND NOT A STATIC `import ... with { type: "json" }`
 * A static import of a missing JSON file fails at resolve time and kills
 * the build. Absence here must DEGRADE instead: a checkout without the
 * snapshots (or with a corrupt one) still builds, the consuming page simply
 * renders without the surface section. Corruption reuses the same
 * degradation path as absence — a loud `console.warn` names the file and
 * the reason, and the caller gets `undefined`.
 *
 * THIS MODULE MUST NEVER BE IMPORTED FROM AN ISLAND (`ActionsSearch.tsx`,
 * `Inspector.tsx`): `node:fs` in a client bundle breaks the build — which
 * is, deliberately, the safety net that guarantees nobody does it by
 * accident. The search island gets its data injected by the SSR page, not
 * from this module.
 */
import fs from "node:fs";
import path from "node:path";

/** Servers with committed surface snapshots. */
export type SurfaceServerId = "gitlab" | "libgen";

/** Provenance block shared by every discover snapshot. */
export interface SurfaceMeta {
  endpoint: string;
  method: string;
  protocolVersion: string;
  generatedAt: string;
}

/**
 * `serverInfo` flattened out of `result._meta` by the extractor, without
 * `icons` (those already live in `src/data/cards/<id>.json`).
 */
export interface DiscoverServerInfo {
  name: string;
  title?: string;
  description?: string;
  version: string;
  websiteUrl?: string;
}

/** Verbatim pass-through of the discover result's `capabilities`. */
export interface DiscoverCapabilities {
  completions?: object;
  prompts?: { listChanged?: boolean };
  resources?: { listChanged?: boolean; subscribe?: boolean };
  tools?: { listChanged?: boolean };
}

/**
 * Curated `server/discover` snapshot. `instructions` is the verbatim text
 * the server hands to clients — the server page renders it as-is.
 * `ttlMs`/`cacheScope` are persisted as evidence; the cache hints are
 * honored by refreshing per build, not per request.
 */
export interface DiscoverSnapshot {
  meta: SurfaceMeta;
  serverInfo: DiscoverServerInfo;
  supportedVersions: string[];
  capabilities: DiscoverCapabilities;
  instructions?: string;
  ttlMs?: number;
  cacheScope?: string;
}

/**
 * One `dynamic_action` from the manifest, fields verbatim upstream
 * (snake_case `read_only` included: this is a projection, not a
 * transformation).
 */
export interface GitlabActionEntry {
  id: string;
  title: string;
  domain: string;
  destructive: boolean;
  read_only: boolean;
  /**
   * Full upstream description — the reference content the per-domain pages
   * (`/servers/<id>/actions/<domain>/`) publish. The compact actions.json
   * endpoint deliberately does NOT emit it: its projection is its own.
   */
  description: string;
  /**
   * Upstream `required_params`, verbatim; absent when the action takes none.
   * 2.7.2 upgraded each entry from a bare name to `{name, type}` (at this
   * site's request); `type` may still be absent for genuinely mixed-type
   * params (`admin.feature_set`'s `value`).
   */
  required_params?: GitlabActionParam[];
  /**
   * Alternative requirement groups: at least ONE group must be fully
   * provided, on top of `required_params`. E.g. snippet.create needs `title`
   * plus (`file_name` + `content`) or (`files`).
   */
  required_params_any_of?: GitlabActionParam[][];
  /** Canonical id this entry is a declared alias of (3 pairs in 2.7.2). */
  alias_of?: string;
}

/** One required parameter, as the manifest publishes it since 2.7.2. */
export interface GitlabActionParam {
  name: string;
  type?: string;
}

/** Per-domain counts precomputed by the extractor for the SSR breakdown. */
export interface GitlabActionDomain {
  domain: string;
  count: number;
  destructiveCount: number;
  readOnlyCount: number;
}

/** One of the manifest's `visible_tools` (the MCP-visible tool pair). */
export interface GitlabVisibleTool {
  name: string;
  title: string;
  destructive: boolean;
  read_only: boolean;
}

/**
 * Provenance of the reduced manifest. `entryCount` is the upstream count
 * (actions + the visible-tool entry the projection excludes);
 * `actionCount` is what `entries`/`domains` actually cover — the citable
 * figure. `cacheScope: "private"` records that the catalog is the surface
 * OF THE TOKEN used, not a universal one.
 */
export interface GitlabActionsMeta {
  endpoint: string;
  resourceUri: string;
  surface: string;
  uriTemplate: string;
  sourceVersion: string;
  entryCount: number;
  actionCount: number;
  visibleTools: GitlabVisibleTool[];
  ttlMs: number;
  cacheScope: string;
  generatedAt: string;
}

/** The committed `gitlab-actions.json` snapshot. */
export interface GitlabActionsSnapshot {
  meta: GitlabActionsMeta;
  domains: GitlabActionDomain[];
  entries: GitlabActionEntry[];
}

const SURFACE_DIR = path.join(process.cwd(), "src", "data", "surface");

/**
 * Module-level memo. Caches `undefined` results as well: a missing snapshot
 * should be decided (and warned about, when invalid) once per build, not
 * once per page.
 */
const cache = new Map<string, unknown>();

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);
const isString = (v: unknown): v is string => typeof v === "string";
const isOptionalString = (v: unknown): boolean =>
  v === undefined || typeof v === "string";
const isNumber = (v: unknown): v is number => typeof v === "number";
const isBoolean = (v: unknown): v is boolean => typeof v === "boolean";

/**
 * Minimal shape check for a discover snapshot: only the fields consumers
 * read. Returns the reason it is invalid, or `undefined` when it passes.
 */
function validateDiscover(parsed: unknown): string | undefined {
  if (!isRecord(parsed)) return "root is not an object";
  const { meta, serverInfo, supportedVersions, capabilities } = parsed;
  if (
    !isRecord(meta) ||
    !isString(meta.endpoint) ||
    !isString(meta.method) ||
    !isString(meta.protocolVersion) ||
    !isString(meta.generatedAt)
  ) {
    return "meta is missing or badly typed";
  }
  if (
    !isRecord(serverInfo) ||
    !isString(serverInfo.name) ||
    !isString(serverInfo.version) ||
    !isOptionalString(serverInfo.title) ||
    !isOptionalString(serverInfo.description) ||
    !isOptionalString(serverInfo.websiteUrl)
  ) {
    return "serverInfo is missing or badly typed";
  }
  if (
    !Array.isArray(supportedVersions) ||
    supportedVersions.some((v) => !isString(v))
  ) {
    return "supportedVersions is not a string array";
  }
  if (!isRecord(capabilities)) return "capabilities is not an object";
  if (!isOptionalString(parsed.instructions))
    return "instructions is not a string";
  if (parsed.ttlMs !== undefined && !isNumber(parsed.ttlMs))
    return "ttlMs is not a number";
  if (!isOptionalString(parsed.cacheScope)) return "cacheScope is not a string";
  return undefined;
}

/**
 * Minimal shape check for the actions snapshot, plus the two internal
 * consistency sums the SSR math relies on: `actionCount === entries.length`
 * and `sum(domains.count) === actionCount`.
 */
/** One `{name, type}` pair; `type` tolerated as absent (mixed-type params). */
function isValidParam(x: unknown): boolean {
  return (
    isRecord(x) &&
    isString(x.name) &&
    (x.type === undefined || isString(x.type))
  );
}

/** `required_params`, when present: an array of valid params. */
function isValidParams(value: unknown): boolean {
  return (
    value === undefined || (Array.isArray(value) && value.every(isValidParam))
  );
}

/** `required_params_any_of`, when present: groups of valid params. */
function isValidAnyOf(value: unknown): boolean {
  return (
    value === undefined ||
    (Array.isArray(value) &&
      value.every(
        (g) => Array.isArray(g) && g.length > 0 && g.every(isValidParam),
      ))
  );
}

function validateActions(parsed: unknown): string | undefined {
  if (!isRecord(parsed)) return "root is not an object";
  const { meta, domains, entries } = parsed;
  if (
    !isRecord(meta) ||
    !isString(meta.endpoint) ||
    !isString(meta.resourceUri) ||
    !isString(meta.surface) ||
    !isString(meta.uriTemplate) ||
    !isString(meta.sourceVersion) ||
    !isNumber(meta.entryCount) ||
    !isNumber(meta.actionCount) ||
    !isNumber(meta.ttlMs) ||
    !isString(meta.cacheScope) ||
    !isString(meta.generatedAt)
  ) {
    return "meta is missing or badly typed";
  }
  if (
    !Array.isArray(meta.visibleTools) ||
    meta.visibleTools.some(
      (t: unknown) =>
        !(
          isRecord(t) &&
          isString(t.name) &&
          isString(t.title) &&
          isBoolean(t.destructive) &&
          isBoolean(t.read_only)
        ),
    )
  ) {
    return "meta.visibleTools is missing or badly typed";
  }
  if (
    !Array.isArray(domains) ||
    domains.some(
      (d: unknown) =>
        !(
          isRecord(d) &&
          isString(d.domain) &&
          isNumber(d.count) &&
          isNumber(d.destructiveCount) &&
          isNumber(d.readOnlyCount)
        ),
    )
  ) {
    return "domains is missing or badly typed";
  }
  if (
    !Array.isArray(entries) ||
    entries.some(
      (e: unknown) =>
        !(
          isRecord(e) &&
          isString(e.id) &&
          isString(e.title) &&
          isString(e.domain) &&
          isBoolean(e.destructive) &&
          isBoolean(e.read_only) &&
          isString(e.description) &&
          isValidParams(e.required_params) &&
          isValidAnyOf(e.required_params_any_of) &&
          (e.alias_of === undefined || isString(e.alias_of))
        ),
    )
  ) {
    return "entries is missing or badly typed";
  }
  if (meta.actionCount !== entries.length) {
    return `actionCount ${meta.actionCount} !== entries.length ${entries.length}`;
  }
  // Validated above, so the cast to the checked shape is sound here.
  const domainSum = (domains as { count: number }[]).reduce(
    (sum, d) => sum + d.count,
    0,
  );
  if (domainSum !== meta.actionCount) {
    return `sum(domains.count) ${domainSum} !== actionCount ${meta.actionCount}`;
  }
  return undefined;
}

/**
 * Reads, parses and validates one snapshot, memoized. Never throws: an
 * absent file quietly yields `undefined` (that is the committed-fallback
 * semantics working as intended in a checkout without snapshots); a present
 * but invalid file warns loudly and yields `undefined` too.
 */
function loadSnapshot(
  file: string,
  validate: (parsed: unknown) => string | undefined,
): unknown {
  if (cache.has(file)) return cache.get(file);
  let value: unknown;
  let raw: string | undefined;
  try {
    raw = fs.readFileSync(path.join(SURFACE_DIR, file), "utf8");
  } catch {
    raw = undefined;
  }
  if (raw !== undefined) {
    try {
      const parsed: unknown = JSON.parse(raw);
      const problem = validate(parsed);
      if (problem === undefined) {
        value = parsed;
      } else {
        console.warn(
          `[surface] src/data/surface/${file} is invalid (${problem}) — ` +
            "pages degrade as if the snapshot were absent. " +
            "Regenerate it with: node scripts/sync-server-surface.mjs",
        );
      }
    } catch (error) {
      console.warn(
        `[surface] src/data/surface/${file} is not valid JSON (${String(error)}) — ` +
          "pages degrade as if the snapshot were absent. " +
          "Regenerate it with: node scripts/sync-server-surface.mjs",
      );
    }
  }
  cache.set(file, value);
  return value;
}

/**
 * The curated `server/discover` snapshot for one server, or `undefined`
 * when the snapshot is absent or invalid (the page then simply omits the
 * discover-driven section).
 */
export function getDiscover(
  server: SurfaceServerId,
): DiscoverSnapshot | undefined {
  return loadSnapshot(`${server}-discover.json`, validateDiscover) as
    DiscoverSnapshot | undefined;
}

/**
 * The reduced `gitlab://tools` manifest, or `undefined` when the snapshot
 * is absent or invalid.
 */
export function getGitlabActions(): GitlabActionsSnapshot | undefined {
  return loadSnapshot("gitlab-actions.json", validateActions) as
    GitlabActionsSnapshot | undefined;
}

/**
 * Detail URI for one action, derived from the manifest's own
 * `uri_template` — never hardcoded, so a future template change upstream
 * flows through the snapshot instead of silently diverging.
 */
export function gitlabActionDetailUri(
  actions: GitlabActionsSnapshot,
  id: string,
): string {
  // Function replacement so "$"-patterns in ids are never interpreted.
  return actions.meta.uriTemplate.replace("{id}", () => id);
}

/**
 * Registro ÚNICO de los servidores con catálogo de acciones committeado en
 * `src/data/surface/` (hoy solo gitlab). Los cuatro publicadores del catálogo
 * (`/servers.json`, `/servers/[server]/actions.json` y las rutas de dominio
 * de ambos idiomas) consumen ESTE mapa: declararlo en cada uno era invitar a
 * que un servidor nuevo apareciera en una superficie y no en otra.
 *
 * @returns Mapa id → snapshot; la clave existe aunque el loader devuelva
 *   undefined (checkout sin snapshot), y cada consumidor filtra.
 */
export function actionCatalogs(): Record<
  string,
  GitlabActionsSnapshot | undefined
> {
  return { gitlab: getGitlabActions() };
}

/** Una ruta estática de página de dominio, con sus props ya montadas. */
export interface ActionsDomainPath {
  params: { server: string; domain: string };
  props: {
    server: string;
    domain: string;
    actions: GitlabActionEntry[];
    /** Dominio real de cada id apuntado por un alias_of de esta página. */
    aliasDomains: Record<string, string>;
  };
}

/**
 * El cuerpo de `getStaticPaths` de las páginas de dominio, compartido por las
 * rutas EN y ES para que no puedan derivar: una corrección al resolutor de
 * alias o a la forma de las props se hace UNA vez aquí.
 *
 * @returns Una ruta por (servidor con catálogo, dominio).
 */
export function actionsDomainPaths(): ActionsDomainPath[] {
  return Object.entries(actionCatalogs())
    .filter(
      (pair): pair is [string, GitlabActionsSnapshot] => pair[1] !== undefined,
    )
    .flatMap(([server, catalog]) => {
      // Dominio real de cada id, para resolver el destino de los alias_of —
      // el objetivo puede vivir en OTRO dominio (issue.list_group →
      // group.issues) y la página no puede derivarlo del prefijo del id.
      const domainOf = new Map(catalog.entries.map((e) => [e.id, e.domain]));
      return catalog.domains.map((d) => {
        const actions = catalog.entries.filter((e) => e.domain === d.domain);
        const aliasDomains = Object.fromEntries(
          actions
            .filter((e) => e.alias_of !== undefined)
            .map((e) => [
              e.alias_of as string,
              domainOf.get(e.alias_of as string),
            ])
            .filter((pair): pair is [string, string] => pair[1] !== undefined),
        );
        return {
          params: { server, domain: d.domain },
          props: { server, domain: d.domain, actions, aliasDomains },
        };
      });
    });
}
