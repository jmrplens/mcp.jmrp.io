/**
 * RFC 9727 API catalog: what APIs this domain publishes and where to learn
 * about each one.
 *
 * Complements the MCP-specific discovery documents rather than repeating them.
 * `/.well-known/ai-catalog.json` answers "which MCP servers live here" for MCP
 * clients; this answers "which APIs live here" for anything that speaks the
 * generic, already-published standard — and it is the only one of the two that
 * is a ratified RFC rather than a draft.
 *
 * Each server gets one linkset member carrying the three relations that
 * actually mean something here:
 *   - `service-desc` → its Server Card (the machine-readable description)
 *   - `service-doc`  → its documentation site (for humans)
 *   - `status`       → its /health endpoint
 *
 * The first member is the catalog index, whose anchor is the catalog's own URL
 * and whose `item` list names every API — the shape RFC 9727 §A.2 uses.
 *
 * Served as `application/linkset+json` with the RFC 9727 profile parameter;
 * the vhost sets that Content-Type because the media type is not in nginx's
 * mime.types. Built at `/well-known/` because Astro will not emit dot-prefixed
 * directories, with the vhost mapping the real URL.
 */
import type { APIRoute } from "astro";

import { servers } from "../../data/servers";
import { SITE_ORIGIN } from "../../lib/seo";

const CATALOG_URL = `${SITE_ORIGIN}/.well-known/api-catalog`;

/**
 * Builds the RFC 9727 catalog of the MCP endpoints this domain serves.
 *
 * @returns The catalog as an RFC 9264 linkset.
 */
export const GET: APIRoute = () => {
  const catalog = {
    linkset: [
      {
        anchor: CATALOG_URL,
        item: servers.map((server) => ({
          href: server.endpoint,
          title: server.name,
        })),
      },
      ...servers.map((server) => ({
        anchor: server.endpoint,
        "service-desc": [
          {
            href: `${server.endpoint}/server-card`,
            type: "application/mcp-server-card+json",
          },
        ],
        "service-doc": [
          { href: server.docsSite ?? server.docs, type: "text/html" },
        ],
        status: [
          { href: `${server.endpoint}/health`, type: "application/json" },
        ],
      })),
    ],
  };

  return new Response(JSON.stringify(catalog, null, 2), {
    headers: {
      "content-type":
        'application/linkset+json;profile="https://www.rfc-editor.org/info/rfc9727"',
    },
  });
};
