/**
 * AI Catalog: the domain-level index that makes multi-server discovery work.
 *
 * A Server Card describes ONE server, so a domain hosting several needs
 * something above them. That is this document: it lists an entry per server,
 * each pointing at the card's URL. Published at `/.well-known/ai-catalog.json`
 * (SEP-2127 / the AI Catalog spec), which is where a client performing
 * domain-level discovery looks first.
 *
 * NOTE ON THE PATH: Astro will not emit a `src/pages/.well-known/` directory —
 * tooling skips dot-prefixed paths — so the file is built at
 * `/well-known/ai-catalog.json` and the vhost maps the real `.well-known` URL
 * onto it with a `location =`. The published URL is the spec's; only the file
 * on disk differs.
 *
 * Identifiers use the domain-anchored `urn:air:{publisher}:{namespace}:{name}`
 * form. Entries carry `displayName` and nothing else human-readable, which is
 * the narrowest answer to two specs that disagree: the MCP server-card
 * extension's discovery document says "an entry does not need to repeat the
 * Server Card's human-readable fields", while the AI Catalog's own schema
 * (`ards-project/ard-spec`, `spec/schemas/ai-catalog.schema.json`, `$defs`
 * `.catalogEntry.required`) lists `displayName` as required and rejected this
 * document without it. One field satisfies both. `description` stays out, so
 * the prose that CAN drift is still read from the card.
 */
import type { APIRoute } from "astro";

import { servers } from "../../data/servers";

/**
 * Builds the domain-level catalog listing every server's card.
 *
 * @returns The catalog as `application/ai-catalog+json`.
 */
export const GET: APIRoute = () => {
  const catalog = {
    specVersion: "1.0",
    // `host` is what separates Level 1 from Level 2 ("Discoverable Catalog")
    // in the AI Catalog spec, which asks for an object identifying the
    // catalogue operator; only `displayName` is required of it. The optional
    // members it also defines — logoUrl, trustManifest — are left out rather
    // than filled with something approximate: this document is read by
    // machines that cannot tell a placeholder from a fact.
    host: {
      displayName: "jmrp.io",
      identifier: "jmrp.io",
      documentationUrl: "https://mcp.jmrp.io/",
    },
    entries: servers.map((server) => ({
      identifier: `urn:air:jmrp.io:mcp:${server.id}`,
      // The card's own title, not the page copy: the two documents must not
      // disagree about what the server is called, and the card is the one a
      // client reads next.
      displayName: server.card.title,
      type: "application/mcp-server-card+json",
      url: `${server.endpoint}/server-card`,
    })),
  };

  return new Response(JSON.stringify(catalog, null, 2), {
    headers: { "content-type": "application/ai-catalog+json" },
  });
};
