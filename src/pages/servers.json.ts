import type { APIRoute } from "astro";

import { serverCardDocuments, serverCards } from "../data/server-cards";
import { servers } from "../data/servers";
import { actionCatalogs } from "../data/surface";
import { SITE_ORIGIN } from "../lib/seo";

/**
 * Dynamic action catalogs with a committed snapshot, from the single registry
 * in `src/data/surface.ts`. The loader memoizes and never throws: a checkout
 * without a snapshot simply emits no `actionCatalog` key.
 */
const catalogs = actionCatalogs();

/**
 * The machine-readable index. It replaces the JSON nginx served at
 * `location = /` before the site existed: the clients that consumed it still
 * have a stable endpoint, now at `/servers.json`.
 */
export const GET: APIRoute = () =>
  new Response(
    JSON.stringify(
      {
        service: "mcp.jmrp.io",
        transport: "streamable-http",
        // The flat map stays exactly as it is: it is the interface existing
        // clients consume (Smithery reads it). Things are only ADDED; its
        // shape is never changed.
        endpoints: Object.fromEntries(servers.map((s) => [s.id, s.endpoint])),
        docs: "https://mcp.jmrp.io/",
        // A full entry per server: at 207 bytes, an agent arriving here knew
        // WHERE to call but not what each server can do nor which headers it
        // needs — and this file is linked for exactly that.
        servers: servers.map((s) => {
          // Prompts, resources and templates are three MCP capabilities
          // distinct from tools, and this index only listed tools: the
          // inspector enumerates them live, but no crawler runs the inspector.
          // They come from the committed card and not from `servers.ts`
          // because that only holds hand-written copy, which gitlab does not
          // have for its 37 prompts; `scripts/sync-server-cards.sh` refreshes
          // the card on every release, so it cannot drift from what the server
          // answers. It is checked rather than indexed blindly: a server can be
          // registered before its snapshot lands.
          const card = serverCardDocuments[s.id];
          const summary = serverCards[s.id];
          const catalog = catalogs[s.id];
          const prompts = s.prompts?.length
            ? s.prompts.map((prompt) => prompt.name)
            : (card?.prompts ?? []).map((prompt) => prompt.name);
          // Resources and templates go by URI, not by name: `resources/read`
          // addresses by URI and the name alone is not invocable.
          const resources = (card?.resources ?? []).map(
            (resource) => resource.uri,
          );
          const resourceTemplates = (card?.resourceTemplates ?? []).map(
            (template) => template.uriTemplate,
          );

          return {
            id: s.id,
            endpoint: s.endpoint,
            transport: "streamable-http",
            description: s.description.en,
            tools: s.tools.map((tool) => tool.name),
            // Each family is omitted entirely when empty, so a server that
            // does not expose it keeps exactly the key set it already had:
            // nothing that parses this file today sees a new empty key
            // appear.
            ...(prompts.length > 0 && { prompts }),
            ...(resources.length > 0 && { resources }),
            ...(resourceTemplates.length > 0 && { resourceTemplates }),
            // Subscriptions: only when the card declares the contract (gitlab
            // since 2.7.x; libgen does not carry it and keeps its exact key
            // set). `methods` travels as-is (available/requires/
            // since_protocol); the list of subscribable templates comes from
            // the `subscribable` flag server-cards.ts CURATES out of `_meta` —
            // the raw `_meta` never leaves the data layer, so a change in that
            // key's semantics applies in one place.
            ...(summary?.subscriptions && {
              subscriptions: {
                methods: summary.subscriptions.methods,
                subscribableUriTemplates: summary.resourceTemplates
                  .filter((t) => t.subscribable)
                  .map((t) => t.uriTemplate),
              },
            }),
            // The dynamic action catalog: only for servers with a committed
            // snapshot in `src/data/surface/`. The figures ALWAYS come from
            // the snapshot — the catalog is the surface of the token it was
            // read with (`cacheScope: "private"`), so the count moves with the
            // token and with each release; hence the "Free-tier" note attached
            // to the number.
            ...(catalog && {
              actionCatalog: {
                source: catalog.meta.resourceUri,
                // The same name as the snapshot field it comes from
                // (`meta.actionCount`, actions only): the upstream
                // `entryCount` also includes visible_tool entries, and
                // publishing it under another name invited confusing the two.
                actionCount: catalog.meta.actionCount,
                domainCount: catalog.domains.length,
                note: "Counted with a Free-tier token; the catalog is scoped to the token that asks, so tier and token permissions both move the count.",
                index: `${SITE_ORIGIN}/servers/${s.id}/actions.json`,
              },
            }),
            // The name AND the value's shape. With the name alone, a machine
            // reading this would send `Authorization: <token>` — without
            // `Bearer `, which is invalid syntax and another 401. A
            // machine-readable index is exactly where that difference cannot
            // be assumed known.
            requiredHeaders: s.requiredHeaders.map((h) =>
              h.valuePrefix ? `${h.name}: ${h.valuePrefix}<token>` : h.name,
            ),
            optionalHeaders: s.optionalHeaders.map((h) => h.name),
            // How the credential is obtained, not just where it goes. Without
            // this the index said a header was needed and said nothing about
            // the whole flow: the Application ID to configure in each client,
            // who issues the tokens, and where the document declaring it is.
            // Absent on a server that does not delegate to OAuth.
            ...(s.oauth && {
              oauth: {
                clientId: s.oauth.clientId,
                authorizationServer: s.oauth.authorizationServer,
                scopes: s.oauth.scopes,
                protectedResourceMetadata: s.oauth.metadataUrl,
                callbackPort: s.oauth.callbackPort,
              },
            }),
            repository: s.repo,
            documentation: s.docsSite ?? s.docs,
            health: `${s.endpoint}/health`,
          };
        }),
      },
      null,
      2,
    ),
    { headers: { "content-type": "application/json" } },
  );
