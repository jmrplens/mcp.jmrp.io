/**
 * Typed view over the SEP-1649 Server Cards committed under `src/data/cards/`.
 *
 * WHERE THE DATA COMES FROM
 * Each file (`src/data/cards/<id>.json`) is a snapshot of what that MCP
 * server publishes at `<endpoint>/.well-known/mcp/server-card.json`,
 * downloaded and stably reformatted (sorted keys, fixed indentation — so a
 * `git diff` shows only what actually changed in the API) by
 * `ops/scripts/mcp_server_cards_sync.sh`. That script is called from
 * `ops/scripts/mcp_update.sh` only after a real version bump, never on an
 * hourly cycle with nothing new. See `.superpowers/sdd/servers-section-spec.md`
 * ("Datos") for the full rationale — in short, this is a committed static
 * snapshot on purpose, not a build-time or runtime fetch: the card only
 * changes on release, so there is no reason to pay for network access (or
 * its failure modes) on every build.
 *
 * WHAT THIS MODULE EXPOSES, AND WHY
 * `inputSchema`/`outputSchema` run ~2.5 KB PER TOOL (libgen's `download` tool
 * alone has a 2,120-character description). Dumping that into every page
 * would be exactly the noise the author asked NOT to add. So there are two
 * levels of access:
 *
 *   - `serverCards` / `getServerCard(id)` — the CURATED view: `name`,
 *     `title`, `description`, and (for prompts) `arguments`. This is what a
 *     page should render. Nothing here is invented — every field is a direct
 *     pass-through of what the card already contains, just without the
 *     schemas.
 *   - `serverCardDocuments` / `getServerCardDocument(id)` — the FULL parsed
 *     document, schemas and all, for the rare case something genuinely needs
 *     them (it is still sitting right there in the committed JSON either
 *     way). Nothing in this site currently renders `inputSchema` or
 *     `outputSchema` — that job belongs to the inspector's live
 *     `tools/list` call (`src/lib/tool-schema.ts`), which reads it from the
 *     running server, not from this static snapshot.
 *
 * `resourceTemplates` (parameterized resources, e.g. `gitlab://group/{id}`)
 * is kept on the full document type because it is a real SEP-1649 field, but
 * it is deliberately left OUT of the curated summary: the spec's "what pages
 * walk" list is tools/prompts/resources only, and gitlab already has 37
 * prompts to make navigable — adding 37 more entries of a kind nobody asked
 * to list was exactly the flooding this whole exercise exists to avoid. A
 * future page can read it from `serverCardDocuments` if that changes.
 *
 * ADDING A THIRD MCP: give it an entry in `ops/scripts/mcp_server_cards_sync.sh`
 * (`CARDS`), run that script once to create `src/data/cards/<id>.json`, then
 * add one import + one entry in the `documents` map below. Deliberately not
 * globbed automatically (`import.meta.glob`): the two other per-server data
 * files in this directory (`servers.ts`, `topology.ts`) are also plain,
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

export type CardServerInfo = { name: string; version: string };

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
};

/** A prompt entry exactly as the card publishes it. */
export type CardPrompt = {
  name: string;
  title: string;
  description: string;
  arguments: CardPromptArgument[];
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

/** What a page paints for one tool: no schema. */
export type ToolSummary = Pick<CardTool, "name" | "title" | "description">;

/** What a page paints for one prompt, arguments included. */
export type PromptSummary = Pick<
  CardPrompt,
  "name" | "title" | "description" | "arguments"
>;

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

// One entry per server with a committed card. See the module doc for how to
// add a third one.
const documents: Record<string, ServerCardDocument> = {
  // No `as ServerCardDocument` here: the `Record<string, ServerCardDocument>`
  // annotation above already contextually types each property, and eslint's
  // no-unnecessary-type-assertion flags a cast the compiler doesn't need.
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
    serverInfo: doc.serverInfo,
    authentication: doc.authentication,
    tools: doc.tools.map(({ name, title, description }) => ({
      name,
      title,
      description,
    })),
    prompts: doc.prompts.map(({ name, title, description, arguments: args }) => ({
      name,
      title,
      description,
      // Defensive, not evidence-based: every prompt in both cards has at
      // least one argument today, but nothing guarantees a future prompt
      // keeps it that way, and `[]` is the honest reading of "none declared".
      arguments: args ?? [],
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
