/**
 * Typed view over the SEP-1649 Server Cards committed under `src/data/cards/`.
 *
 * WHERE THE DATA COMES FROM
 * Each file (`src/data/cards/<id>.json`) is a snapshot of what that MCP
 * server publishes at `<endpoint>/.well-known/mcp/server-card.json`,
 * downloaded and stably reformatted (sorted keys, fixed indentation — so a
 * `git diff` shows only what actually changed in the API) by
 * `scripts/sync-server-cards.sh`. That script is called from
 * `ops/scripts/mcp_update.sh` only after a real version bump, never on an
 * hourly cycle with nothing new. See `.superpowers/sdd/servers-section-spec.md`
 * ("Datos") for the full rationale — in short, this is a committed static
 * snapshot on purpose, not a build-time or runtime fetch: the card only
 * changes on release, so there is no reason to pay for network access (or
 * its failure modes) on every build.
 *
 * Because the snapshot is written by an external server and refreshed by
 * that script WITHOUT a human reviewing the shape, this module validates the
 * minimum it depends on before trusting a card — see
 * `validateServerCardDocument` below. A release that changes the shape fails
 * the build with a clear message naming the offending server, instead of
 * quietly propagating `undefined` onto a published page.
 *
 * WHAT THIS MODULE EXPOSES, AND WHY
 * `inputSchema`/`outputSchema` run ~2.5 KB PER TOOL (libgen's `download` tool
 * alone has a 2,120-character description). Dumping that into every page
 * would be exactly the noise the author asked NOT to add. So there are two
 * levels of access:
 *
 *   - `serverCards` / `getServerCard(id)` — the CURATED view: `name`,
 *     `title`, `description`, icons, and (for tools) the behavioural
 *     `annotations` hints, and (for prompts) `arguments`. This is what a
 *     page should render. Nothing here is invented — every field is a direct
 *     pass-through of what the card already contains, just without the
 *     schemas. Icons are filtered for safety first — see `filterIcons`.
 *   - `serverCardDocuments` / `getServerCardDocument(id)` — the FULL parsed
 *     document, schemas and all, for the rare case something genuinely needs
 *     them (it is still sitting right there in the committed JSON either
 *     way). Nothing in this site currently renders `inputSchema` or
 *     `outputSchema` — that job belongs to the inspector's live
 *     `tools/list` call (`src/lib/tool-schema.ts`), which reads it from the
 *     running server, not from this static snapshot.
 *
 * `serverInfo.title`/`description`/`websiteUrl`/`icons`, and every tool's or
 * prompt's `icons`, are all genuinely optional: gitlab 2.6.6 sends none of
 * them today (only `serverInfo.name`/`version`), and its page must keep
 * working exactly as before. A missing optional field is not an error — it
 * is simply omitted from the curated summary.
 *
 * `resourceTemplates` (parameterized resources, e.g. `gitlab://group/{id}`)
 * is kept on the full document type because it is a real SEP-1649 field, but
 * it is deliberately left OUT of the curated summary: the spec's "what pages
 * walk" list is tools/prompts/resources only, and gitlab already has 37
 * prompts to make navigable — adding 37 more entries of a kind nobody asked
 * to list was exactly the flooding this whole exercise exists to avoid. A
 * future page can read it from `serverCardDocuments` if that changes.
 *
 * ADDING A THIRD MCP: give it an entry in `scripts/sync-server-cards.sh`
 * (`CARDS`), run that script once to create `src/data/cards/<id>.json`, then
 * add one import + one entry in the `rawDocuments` map below. Deliberately
 * not globbed automatically (`import.meta.glob`): the two other per-server
 * data files in this directory (`servers.ts`, `topology.ts`) are also plain,
 * explicit, hand-maintained lists, and a glob here would be the only file in
 * `src/data/` that adds a server "by magic" instead of by a line someone
 * reviews. It also keeps this module runnable under plain `node --test`
 * (`import.meta.glob` only exists inside Vite's bundler), which the JSON
 * import syntax below already requires care for — see the `with { type:
 * "json" }` attribute, mandatory for Node's own ESM loader.
 */
import gitlabCard from "./cards/gitlab.json" with { type: "json" };
import libgenCard from "./cards/libgen.json" with { type: "json" };

/**
 * A JSON Schema object, as `inputSchema`/`outputSchema` carry it.
 *
 * Not modelled field-by-field on purpose: nothing in this module's curated
 * surface renders it (see the module doc above), so a precise type would be
 * effort spent on a shape nobody here reads.
 */
export type JsonSchema = Record<string, unknown>;

/**
 * One icon declared by the card (server-level, or on a tool/prompt).
 *
 * `src` is a `data:image/…` URI — small inline SVGs today (a few hundred
 * bytes each). It must be rendered as an `<img src>`, never inlined as
 * `<svg>` or via `set:html`: an inline SVG can carry a `<script>`, an `<img>`
 * cannot execute one. See `filterIcons` for the additional check this module
 * applies before an icon reaches the curated summary at all.
 */
export type CardIcon = {
  src: string;
  mimeType?: string;
  sizes?: string[];
};

export type CardServerInfo = {
  name: string;
  version: string;
  title?: string;
  description?: string;
  websiteUrl?: string;
  icons?: CardIcon[];
};

export type CardAuthentication = { required: boolean; schemes: string[] };

/** Hints a resource or resource template annotates itself with. */
export type CardResourceAnnotations = { audience?: string[]; priority?: number };

/** Behavioural hints a tool annotates itself with (all optional per SEP-1649). */
export type CardToolAnnotations = {
  title?: string;
  readOnlyHint?: boolean;
  destructiveHint?: boolean;
  idempotentHint?: boolean;
  openWorldHint?: boolean;
};

/**
 * One prompt argument, as `prompts[].arguments[]` declares it.
 *
 * `required` is omitted by the card (not sent as `false`) when the argument
 * is optional — verified against both live cards on 2026-08-23.
 */
export type CardPromptArgument = {
  name: string;
  title: string;
  description: string;
  required?: boolean;
};

/** A tool entry exactly as the card publishes it, schemas included. */
export type CardTool = {
  name: string;
  title: string;
  description: string;
  inputSchema: JsonSchema;
  outputSchema?: JsonSchema;
  annotations?: CardToolAnnotations;
  icons?: CardIcon[];
};

/** A prompt entry exactly as the card publishes it. */
export type CardPrompt = {
  name: string;
  title: string;
  description: string;
  arguments: CardPromptArgument[];
  icons?: CardIcon[];
};

/**
 * A static resource, as `resources[]` declares it.
 *
 * `title` is genuinely optional here, unlike on tools/prompts: 5 of gitlab's
 * 8 resources (its `gitlab://guides/*` entries) omit it — verified against
 * the live card on 2026-08-23. A page should fall back to `name` when it is
 * absent, rather than assuming every entry has one.
 */
export type CardResource = {
  uri: string;
  name: string;
  title?: string;
  description: string;
  mimeType?: string;
  annotations?: CardResourceAnnotations;
};

/** A parameterized resource, as `resourceTemplates[]` declares it. */
export type CardResourceTemplate = {
  uriTemplate: string;
  name: string;
  title: string;
  description: string;
  mimeType?: string;
  annotations?: CardResourceAnnotations;
};

/** The document exactly as downloaded: the full SEP-1649 shape. */
export type ServerCardDocument = {
  serverInfo: CardServerInfo;
  authentication: CardAuthentication;
  tools: CardTool[];
  prompts: CardPrompt[];
  resources: CardResource[];
  resourceTemplates: CardResourceTemplate[];
};

/**
 * The behavioural hints a page paints for one tool: a curated subset of
 * {@link CardToolAnnotations}. `title` is left out here — a tool's display
 * name already comes from `ToolSummary.title` — so this carries only the
 * four boolean hints.
 */
export type ToolAnnotationsSummary = Pick<
  CardToolAnnotations,
  "readOnlyHint" | "destructiveHint" | "idempotentHint" | "openWorldHint"
>;

/** What a page paints for one tool: no schema, icons filtered for safety. */
export type ToolSummary = Pick<CardTool, "name" | "title" | "description"> & {
  icons?: CardIcon[];
  annotations?: ToolAnnotationsSummary;
};

/** What a page paints for one prompt, arguments included, icons filtered for safety. */
export type PromptSummary = Pick<
  CardPrompt,
  "name" | "title" | "description" | "arguments"
> & { icons?: CardIcon[] };

/**
 * What a page paints for one resource.
 *
 * `title` may be absent — see {@link CardResource}; fall back to `name`.
 */
export type ResourceSummary = Pick<
  CardResource,
  "uri" | "name" | "title" | "description" | "mimeType"
>;

/** The curated, page-ready view of one server's card. */
export type ServerCardSummary = {
  id: string;
  serverInfo: CardServerInfo;
  authentication: CardAuthentication;
  tools: ToolSummary[];
  prompts: PromptSummary[];
  resources: ResourceSummary[];
};

/**
 * Keeps only icons whose `src` is a safe embedded image, dropping the rest.
 *
 * `src` comes straight from an externally-published, script-refreshed JSON
 * file (see the module doc). The consumer paints icons as `<img src>`,
 * which already can't execute a `javascript:` URI or script content the way
 * an inlined `<svg>` could — but that is the presentation layer's defense,
 * not this one's. This module drops anything that isn't a `data:image/…`
 * URI before it leaves the data layer at all, so a card that served
 * `javascript:…`, a remote `http(s)://` URL, or any other scheme never
 * reaches a curated summary, let alone the HTML.
 *
 * @param icons Icons as the card declares them, if any.
 * @returns The safe icons, or `undefined` when there were none to begin with
 *   or none passed the check.
 */
export function filterIcons(icons: CardIcon[] | undefined): CardIcon[] | undefined {
  if (!icons) return undefined;
  const safe = icons.filter((icon) => icon.src.startsWith("data:image/"));
  return safe.length > 0 ? safe : undefined;
}

/**
 * Reduces a tool's full `annotations` to the curated subset a page paints.
 *
 * @param annotations The tool's `annotations` object, if the card declares one.
 * @returns The four boolean hints, or `undefined` when the tool declares no
 *   `annotations` at all.
 */
function summarizeAnnotations(
  annotations: CardToolAnnotations | undefined,
): ToolAnnotationsSummary | undefined {
  if (!annotations) return undefined;
  const { readOnlyHint, destructiveHint, idempotentHint, openWorldHint } = annotations;
  return { readOnlyHint, destructiveHint, idempotentHint, openWorldHint };
}

/**
 * Validates the MINIMUM shape this module depends on, and throws — failing
 * the build loudly — when a committed snapshot doesn't meet it.
 *
 * Deliberately narrow: `serverInfo.name`, `serverInfo.version`, and that
 * `tools`/`prompts`/`resources`/`resourceTemplates` are arrays wherever the
 * card includes them. Everything else this module reads — icons, titles,
 * descriptions, annotations, `websiteUrl` — is optional per the module doc
 * and simply omitted when absent; that's not a validation failure. The
 * snapshot is written by an external MCP server and refreshed by an
 * unattended script (`scripts/sync-server-cards.sh`) with no human review of
 * shape, so a release that breaks this minimum must fail here — in the
 * build — rather than surface as a silent `undefined` on a published page.
 *
 * @param id Server id (matches the key in `rawDocuments`), for the error message.
 * @param raw Parsed JSON from `src/data/cards/<id>.json`, not yet trusted.
 * @returns `raw`, narrowed to `ServerCardDocument`. Any of the four family
 *   fields entirely absent from the JSON (rather than present-but-wrong-type)
 *   defaults to `[]`: an MCP server that implements none of a given kind is
 *   entitled to omit the key rather than send an empty array.
 */
export function validateServerCardDocument(id: string, raw: unknown): ServerCardDocument {
  if (typeof raw !== "object" || raw === null) {
    throw new Error(`Server Card "${id}" is invalid: top-level value is not an object`);
  }
  const doc = raw as Record<string, unknown>;

  const serverInfo = doc.serverInfo;
  if (typeof serverInfo !== "object" || serverInfo === null) {
    throw new Error(`Server Card "${id}" is invalid: serverInfo is missing or not an object`);
  }
  const info = serverInfo as Record<string, unknown>;
  if (typeof info.name !== "string" || info.name.length === 0) {
    throw new Error(
      `Server Card "${id}" is invalid: serverInfo.name is missing or not a non-empty string`,
    );
  }
  if (typeof info.version !== "string" || info.version.length === 0) {
    throw new Error(
      `Server Card "${id}" is invalid: serverInfo.version is missing or not a non-empty string`,
    );
  }

  const families = ["tools", "prompts", "resources", "resourceTemplates"] as const;
  for (const family of families) {
    const value = doc[family];
    if (value !== undefined && !Array.isArray(value)) {
      throw new Error(`Server Card "${id}" is invalid: ${family} is present but not an array`);
    }
  }

  return {
    ...doc,
    tools: (doc.tools as CardTool[] | undefined) ?? [],
    prompts: (doc.prompts as CardPrompt[] | undefined) ?? [],
    resources: (doc.resources as CardResource[] | undefined) ?? [],
    resourceTemplates: (doc.resourceTemplates as CardResourceTemplate[] | undefined) ?? [],
  } as ServerCardDocument;
}

// Cards as imported, before the minimum-shape check below. Typed `unknown`
// on purpose: the JSON import syntax gives each of these the literal shape
// of whatever is currently on disk, which is exactly the false confidence
// this module no longer wants to rely on now that the file is refreshed by
// an unattended script — see `validateServerCardDocument`.
const rawDocuments: Record<string, unknown> = {
  libgen: libgenCard,
  gitlab: gitlabCard,
};

/**
 * Strips one document down to the curated summary a page renders.
 *
 * @param id Server id (matches `McpServer.id` in `src/data/servers.ts`).
 * @param doc Full parsed document for that server.
 * @returns The curated summary.
 */
function summarize(id: string, doc: ServerCardDocument): ServerCardSummary {
  return {
    id,
    serverInfo: { ...doc.serverInfo, icons: filterIcons(doc.serverInfo.icons) },
    authentication: doc.authentication,
    tools: doc.tools.map(({ name, title, description, icons, annotations }) => ({
      name,
      title,
      description,
      icons: filterIcons(icons),
      annotations: summarizeAnnotations(annotations),
    })),
    prompts: doc.prompts.map(({ name, title, description, arguments: args, icons }) => ({
      name,
      title,
      description,
      // Defensive, not evidence-based: every prompt in both cards has at
      // least one argument today, but nothing guarantees a future prompt
      // keeps it that way, and `[]` is the honest reading of "none declared".
      arguments: args ?? [],
      icons: filterIcons(icons),
    })),
    resources: doc.resources.map(({ uri, name, title, description, mimeType }) => ({
      uri,
      name,
      title,
      description,
      mimeType,
    })),
  };
}

// One entry per server with a committed card, validated at import time —
// see `validateServerCardDocument` — so a malformed snapshot fails loudly
// right here, not as an `undefined` on a published page. See the module doc
// for how to add a third one.
const documents: Record<string, ServerCardDocument> = Object.fromEntries(
  Object.entries(rawDocuments).map(([id, raw]) => [id, validateServerCardDocument(id, raw)]),
);

/** Curated summary for every server with a committed card, keyed by id. */
export const serverCards: Record<string, ServerCardSummary> = Object.fromEntries(
  Object.entries(documents).map(([id, doc]) => [id, summarize(id, doc)]),
);

/** Full parsed documents, keyed by id — schemas and `resourceTemplates` included. */
export const serverCardDocuments: Record<string, ServerCardDocument> = documents;

/**
 * The curated summary for one server.
 *
 * @param id Server id, matching `McpServer.id` in `src/data/servers.ts`.
 * @returns The summary, or `undefined` if that server has no committed card.
 */
export function getServerCard(id: string): ServerCardSummary | undefined {
  return serverCards[id];
}

/**
 * The full parsed document for one server, schemas included.
 *
 * @param id Server id, matching `McpServer.id` in `src/data/servers.ts`.
 * @returns The document, or `undefined` if that server has no committed card.
 */
export function getServerCardDocument(id: string): ServerCardDocument | undefined {
  return serverCardDocuments[id];
}
