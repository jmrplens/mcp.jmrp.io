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
 *     `annotations` hints plus BOTH schemas, and (for prompts) `arguments`.
 *     This is what a page should render. Nothing here is invented — every
 *     field is a direct pass-through of what the card already contains.
 *     Icons are filtered for safety first — see `filterIcons` — and so is
 *     `serverInfo.websiteUrl` — see `filterWebsiteUrl`.
 *
 *     The schemas used to stop here, on the argument that ~2.5 KB per tool
 *     of raw JSON was noise. It was the wrong cut: a tool page showed what a
 *     tool was FOR and never what to send it or what came back, while a
 *     prompt directly below listed every argument it takes. The author put
 *     it plainly — "las tools no muestran qué campos tienen ni qué
 *     devuelven". What the page renders is not the raw schema either way:
 *     `ServerPage.astro` runs both through `schemaFields`, the same reader
 *     the inspector uses on the live `tools/list`, and paints name, type,
 *     required and description — so a field reads identically on the ficha
 *     and in the live catalog, and the weight is the part worth reading.
 *   - `serverCardDocuments` / `getServerCardDocument(id)` — the FULL parsed
 *     document, schemas and all, for the rare case something genuinely needs
 *     them (it is still sitting right there in the committed JSON either
 *     way) — a raw `$ref`, a composition keyword, anything `schemaFields`
 *     deliberately does not try to read. The inspector still prefers its
 *     own live `tools/list` over this static snapshot, which is the honest
 *     source when a server is actually running.
 *
 * `serverInfo.title`/`description`/`websiteUrl`/`icons`, and every tool's or
 * prompt's `icons`, are all genuinely optional: gitlab 2.6.6 sends none of
 * them today (only `serverInfo.name`/`version`), and its page must keep
 * working exactly as before. A missing optional field is not an error — it
 * is simply omitted from the curated summary.
 *
 * `resourceTemplates` (parameterized resources, e.g. `gitlab://group/{id}`)
 * DOES enter the curated summary since gitlab 2.7.x: the server page was
 * already painting every template (reaching into the full document to do
 * it), and each entry now carries a subscribable flag this module curates —
 * `_meta[SUBSCRIBABLE_META_KEY] === true` becomes a plain boolean, and the
 * raw `_meta` never leaves the data layer (see `ResourceTemplateSummary`).
 * With that flag curated, a page reads `ServerCardSummary.resourceTemplates`
 * and no longer needs `serverCardDocuments` at all.
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

/** One capability family's flags, as `capabilities.<family>` declares them. */
export type CardCapabilityFlags = {
  listChanged?: boolean;
  subscribe?: boolean;
};

/**
 * Top-level `capabilities`: family → flags. `completions` arrives as `{}` —
 * an empty object is a valid declaration, not a missing one.
 */
export type CardCapabilities = Record<string, CardCapabilityFlags>;

/**
 * One entry of `subscriptions.methods`. `requires`/`since_protocol` are
 * verbatim server prose/data. The snake_case is the server's own spelling,
 * kept exactly as published — this module never renames a card field.
 */
export type CardSubscriptionMethod = {
  available: boolean;
  requires?: string;
  since_protocol?: string;
};

/**
 * The top-level `subscriptions` block (gitlab publishes it since 2.7.x;
 * libgen sends none). Keys under `methods` are JSON-RPC method names, e.g.
 * `resources/subscribe`.
 */
export type CardSubscriptions = {
  methods: Record<string, CardSubscriptionMethod>;
  subscribable_uri_templates: string[];
};

/** Hints a resource or resource template annotates itself with. */
export type CardResourceAnnotations = {
  audience?: string[];
  priority?: number;
};

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
  /** 2.7.2: resources carry the same 3-icon arrays tools do. */
  icons?: CardIcon[];
};

/** A parameterized resource, as `resourceTemplates[]` declares it. */
export type CardResourceTemplate = {
  uriTemplate: string;
  name: string;
  title: string;
  description: string;
  mimeType?: string;
  annotations?: CardResourceAnnotations;
  _meta?: Record<string, unknown>;
  /** 2.7.2: templates carry icons too. */
  icons?: CardIcon[];
};

/** The `_meta` key gitlab uses to flag a template as subscribable (26/37 carry it on 2.7.1). */
export const SUBSCRIBABLE_META_KEY = "io.github.jmrplens/subscribable";

/**
 * The document exactly as downloaded: the full SEP-1649 shape.
 *
 * `capabilities`/`subscriptions` are optional on purpose: libgen publishes
 * no `subscriptions`, and a minimal card may declare neither.
 */
export type ServerCardDocument = {
  serverInfo: CardServerInfo;
  authentication: CardAuthentication;
  capabilities?: CardCapabilities;
  subscriptions?: CardSubscriptions;
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
export type ToolSummary = Pick<
  CardTool,
  "name" | "title" | "description" | "inputSchema" | "outputSchema"
> & {
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
> & { icons?: CardIcon[] };

/**
 * What a page paints for one resource template. `subscribable` is curated
 * from `_meta[SUBSCRIBABLE_META_KEY] === true` — the raw `_meta` never
 * leaves the data layer.
 */
export type ResourceTemplateSummary = Pick<
  CardResourceTemplate,
  "uriTemplate" | "name" | "title" | "description" | "mimeType"
> & { subscribable: boolean; icons?: CardIcon[] };

/** The curated, page-ready view of one server's card. */
export type ServerCardSummary = {
  id: string;
  serverInfo: CardServerInfo;
  authentication: CardAuthentication;
  // Pass-through verbatim: both carry only strings/booleans a page prints
  // as-is, so unlike icons/websiteUrl there is nothing to filter. Absent
  // when the card doesn't declare them (libgen has no `subscriptions`).
  capabilities?: CardCapabilities;
  subscriptions?: CardSubscriptions;
  tools: ToolSummary[];
  prompts: PromptSummary[];
  resources: ResourceSummary[];
  resourceTemplates: ResourceTemplateSummary[];
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
export function filterIcons(
  icons: CardIcon[] | undefined,
): CardIcon[] | undefined {
  if (!icons) return undefined;
  const safe = icons.filter((icon) => icon.src.startsWith("data:image/"));
  return safe.length > 0 ? safe : undefined;
}

/**
 * Keeps `serverInfo.websiteUrl` only when it is an `https:` URL, dropping it
 * otherwise.
 *
 * Same reasoning as {@link filterIcons}, applied to the other card field that
 * lands verbatim in an HTML attribute: a page paints it as
 * `<a href={websiteUrl}>` labelled as that server's OFFICIAL site, and the
 * value comes from the externally-published, script-refreshed snapshot. This
 * is not the XSS gate — the deployed CSP already stops a `javascript:` href
 * from executing — it is about never presenting an arbitrary scheme under
 * that label.
 *
 * Dropping instead of throwing is the deliberate difference from
 * `validateServerCardDocument`: an odd `websiteUrl` costs the card one
 * optional link, which is not worth failing a build over, whereas a broken
 * minimum shape is.
 *
 * @param websiteUrl `serverInfo.websiteUrl` as the card declares it, if any.
 * @returns The URL when it is `https:`, `undefined` otherwise.
 */
export function filterWebsiteUrl(
  websiteUrl: string | undefined,
): string | undefined {
  if (!websiteUrl) return undefined;
  // Parsed rather than prefix-matched the way `filterIcons` matches
  // `data:image/`: a URL scheme is case-insensitive, so a `startsWith` check
  // would drop a perfectly valid `HTTPS://…`. The value itself is returned
  // verbatim — this decides, it does not rewrite — and anything `URL` cannot
  // parse at all (a relative path, say) is not a link to publish either.
  try {
    return new URL(websiteUrl).protocol === "https:" ? websiteUrl : undefined;
  } catch {
    return undefined;
  }
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
  const { readOnlyHint, destructiveHint, idempotentHint, openWorldHint } =
    annotations;
  return { readOnlyHint, destructiveHint, idempotentHint, openWorldHint };
}

/** `serverInfo` with a non-empty `name` and `version`, or throws. */
function validateServerInfoBlock(
  id: string,
  doc: Record<string, unknown>,
): void {
  const serverInfo = doc.serverInfo;
  if (typeof serverInfo !== "object" || serverInfo === null) {
    throw new Error(
      `Server Card "${id}" is invalid: serverInfo is missing or not an object`,
    );
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
}

/**
 * `authentication` in the exact shape the page dereferences, or throws.
 *
 * `TypeError` rather than the plain `Error` the checks around it throw:
 * these test nothing but the type of a field, which is the case the
 * subclass exists for (`src/lib/tool-schema.ts` uses it the same way for
 * its own external input). The message keeps the shape of its neighbours',
 * which is all a build failure ever shows.
 */
function validateAuthenticationBlock(
  id: string,
  doc: Record<string, unknown>,
): void {
  const authentication = doc.authentication;
  if (typeof authentication !== "object" || authentication === null) {
    throw new TypeError(
      `Server Card "${id}" is invalid: authentication is missing or not an object`,
    );
  }
  const auth = authentication as Record<string, unknown>;
  if (typeof auth.required !== "boolean") {
    throw new TypeError(
      `Server Card "${id}" is invalid: authentication.required is missing or not a boolean`,
    );
  }
  if (!Array.isArray(auth.schemes)) {
    throw new TypeError(
      `Server Card "${id}" is invalid: authentication.schemes is missing or not an array`,
    );
  }
}

/**
 * `subscriptions`, when present, in the shape the page dereferences
 * (`methods` with a boolean `available` each, plus the URI list), or throws.
 * `requires`/`since_protocol` are NOT validated: a page only paints them
 * when present — an absent optional is not a failure.
 */
function validateSubscriptionsBlock(
  id: string,
  doc: Record<string, unknown>,
): void {
  const subscriptions = doc.subscriptions;
  if (subscriptions === undefined) return;
  if (
    typeof subscriptions !== "object" ||
    subscriptions === null ||
    Array.isArray(subscriptions)
  ) {
    throw new TypeError(
      `Server Card "${id}" is invalid: subscriptions is present but not an object`,
    );
  }
  const subs = subscriptions as Record<string, unknown>;
  if (
    typeof subs.methods !== "object" ||
    subs.methods === null ||
    Array.isArray(subs.methods)
  ) {
    throw new TypeError(
      `Server Card "${id}" is invalid: subscriptions.methods is missing or not an object`,
    );
  }
  for (const [methodName, method] of Object.entries(
    subs.methods as Record<string, unknown>,
  )) {
    const available =
      typeof method === "object" && method !== null
        ? (method as Record<string, unknown>).available
        : undefined;
    if (typeof available !== "boolean") {
      throw new TypeError(
        `Server Card "${id}" is invalid: subscriptions.methods["${methodName}"].available is missing or not a boolean`,
      );
    }
  }
  if (!Array.isArray(subs.subscribable_uri_templates)) {
    throw new TypeError(
      `Server Card "${id}" is invalid: subscriptions.subscribable_uri_templates is missing or not an array`,
    );
  }
}

/**
 * Validates the MINIMUM shape this module depends on, and throws — failing
 * the build loudly — when a committed snapshot doesn't meet it.
 *
 * Deliberately narrow: `serverInfo.name`, `serverInfo.version`,
 * `authentication`, and that `tools`/`prompts`/`resources`/`resourceTemplates`
 * are arrays wherever the card includes them. `authentication` is in that list
 * — unlike every other object here — because it is the one non-optional
 * object a page dereferences unguarded (`card.authentication.required` /
 * `.schemes`): without the check a card that dropped it would fail the build
 * with an anonymous `TypeError` from deep inside a template instead of the
 * message below, which names the offending card. Everything else this module reads — icons,
 * titles, descriptions, annotations, `websiteUrl` — is optional per the
 * module doc and simply omitted when absent; that's not a validation
 * failure. The snapshot is written by an external MCP server and refreshed
 * by an unattended script (`scripts/sync-server-cards.sh`) with no human
 * review of shape, so a release that breaks this minimum must fail here — in
 * the build — rather than surface as a silent `undefined` on a published page.
 *
 * @param id Server id (matches the key in `rawDocuments`), for the error message.
 * @param raw Parsed JSON from `src/data/cards/<id>.json`, not yet trusted.
 * @returns `raw`, narrowed to `ServerCardDocument`. Any of the four family
 *   fields entirely absent from the JSON (rather than present-but-wrong-type)
 *   defaults to `[]`: an MCP server that implements none of a given kind is
 *   entitled to omit the key rather than send an empty array.
 */
export function validateServerCardDocument(
  id: string,
  raw: unknown,
): ServerCardDocument {
  if (typeof raw !== "object" || raw === null) {
    throw new Error(
      `Server Card "${id}" is invalid: top-level value is not an object`,
    );
  }
  const doc = raw as Record<string, unknown>;

  validateServerInfoBlock(id, doc);
  validateAuthenticationBlock(id, doc);

  const families = [
    "tools",
    "prompts",
    "resources",
    "resourceTemplates",
  ] as const;
  for (const family of families) {
    const value = doc[family];
    if (value !== undefined && !Array.isArray(value)) {
      throw new Error(
        `Server Card "${id}" is invalid: ${family} is present but not an array`,
      );
    }
  }

  // `capabilities` and `subscriptions` are genuinely optional (libgen sends
  // neither `subscriptions` nor any `_meta`) — but when `subscriptions` IS
  // present, a page dereferences `methods` and reads
  // `subscribable_uri_templates.length` without a guard, which is the same
  // reason `authentication` is validated above.
  const capabilities = doc.capabilities;
  if (
    capabilities !== undefined &&
    (typeof capabilities !== "object" ||
      capabilities === null ||
      Array.isArray(capabilities))
  ) {
    throw new TypeError(
      `Server Card "${id}" is invalid: capabilities is present but not an object`,
    );
  }

  validateSubscriptionsBlock(id, doc);

  return {
    ...doc,
    tools: (doc.tools as CardTool[] | undefined) ?? [],
    prompts: (doc.prompts as CardPrompt[] | undefined) ?? [],
    resources: (doc.resources as CardResource[] | undefined) ?? [],
    resourceTemplates:
      (doc.resourceTemplates as CardResourceTemplate[] | undefined) ?? [],
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
 * Exported so a test can reach the WIRING and not just the filters. While
 * this was private, the only documents reachable from a test were the two
 * committed cards, and neither carries a value that `filterWebsiteUrl` or
 * `filterIcons` actually changes: libgen's `websiteUrl` is already `https:`
 * and gitlab publishes none, so unhooking either filter from `serverInfo`
 * below left the whole suite green while a page went back to painting an
 * arbitrary scheme under the "official site" label. A caller that brings its
 * own document can tell those two versions apart.
 *
 * @param id Server id (matches `McpServer.id` in `src/data/servers.ts`).
 * @param doc Full parsed document for that server.
 * @returns The curated summary.
 */
export function summarizeServerCardDocument(
  id: string,
  doc: ServerCardDocument,
): ServerCardSummary {
  return {
    id,
    serverInfo: {
      ...doc.serverInfo,
      websiteUrl: filterWebsiteUrl(doc.serverInfo.websiteUrl),
      icons: filterIcons(doc.serverInfo.icons),
    },
    authentication: doc.authentication,
    // Verbatim pass-through — see `ServerCardSummary` for why no filtering.
    capabilities: doc.capabilities,
    subscriptions: doc.subscriptions,
    tools: doc.tools.map(
      ({
        name,
        title,
        description,
        icons,
        annotations,
        inputSchema,
        outputSchema,
      }) => ({
        name,
        title,
        description,
        icons: filterIcons(icons),
        annotations: summarizeAnnotations(annotations),
        // Passed through, not summarized: the page runs them through the same
        // `schemaFields` the inspector uses, so a field reads identically on
        // the ficha and in the live catalog. See this module's header comment
        // for why they used to stop here.
        inputSchema,
        outputSchema,
      }),
    ),
    prompts: doc.prompts.map(
      ({ name, title, description, arguments: args, icons }) => ({
        name,
        title,
        description,
        // Defensive, not evidence-based: every prompt in both cards has at
        // least one argument today, but nothing guarantees a future prompt
        // keeps it that way, and `[]` is the honest reading of "none declared".
        arguments: args ?? [],
        icons: filterIcons(icons),
      }),
    ),
    resources: doc.resources.map(
      ({ uri, name, title, description, mimeType, icons }) => ({
        uri,
        name,
        title,
        description,
        mimeType,
        icons: filterIcons(icons),
      }),
    ),
    resourceTemplates: doc.resourceTemplates.map(
      ({ uriTemplate, name, title, description, mimeType, _meta, icons }) => ({
        uriTemplate,
        name,
        title,
        description,
        mimeType,
        icons: filterIcons(icons),
        // Strict `=== true` on purpose: only the server's explicit boolean
        // marks a template subscribable — a string "true" (or any other
        // truthy junk in `_meta`) must not.
        subscribable: _meta?.[SUBSCRIBABLE_META_KEY] === true,
      }),
    ),
  };
}

// One entry per server with a committed card, validated at import time —
// see `validateServerCardDocument` — so a malformed snapshot fails loudly
// right here, not as an `undefined` on a published page. See the module doc
// for how to add a third one.
const documents: Record<string, ServerCardDocument> = Object.fromEntries(
  Object.entries(rawDocuments).map(([id, raw]) => [
    id,
    validateServerCardDocument(id, raw),
  ]),
);

/** Curated summary for every server with a committed card, keyed by id. */
export const serverCards: Record<string, ServerCardSummary> =
  Object.fromEntries(
    Object.entries(documents).map(([id, doc]) => [
      id,
      summarizeServerCardDocument(id, doc),
    ]),
  );

/** Full parsed documents, keyed by id — schemas and `resourceTemplates` included. */
export const serverCardDocuments: Record<string, ServerCardDocument> =
  documents;

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
export function getServerCardDocument(
  id: string,
): ServerCardDocument | undefined {
  return serverCardDocuments[id];
}
