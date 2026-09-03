/**
 * MCP Server Card, one per server, at the location the spec reserves:
 * `GET <streamable-http-url>/server-card`.
 *
 * Discovery for a domain that hosts SEVERAL MCP servers works in two steps
 * (SEP-2127 + the AI Catalog it builds on): `/.well-known/ai-catalog.json`
 * lists the servers and points at one card each; every card then describes a
 * SINGLE server and how to connect to it. That is why this file exists per
 * server rather than as one document at the domain root — a card describing
 * two servers is not a thing the schema allows.
 *
 * Status: SEP-2127 is still an open draft (in review at the time of writing),
 * and its path has already moved twice. It is published anyway because the
 * shape is stable enough to be useful and the cost of being wrong is a stale
 * static file. Cards are explicitly "advisory rather than binding": clients
 * MUST verify against the live connection and prefer runtime values.
 *
 * Everything here comes from `src/data/servers.ts`, so a third MCP gets its
 * card for free.
 */
import type { APIRoute, GetStaticPaths } from "astro";

import { servers } from "../../data/servers";
import { liveVersion } from "../../lib/live-version";

/**
 * One route per server, so each gets its card at `<endpoint>/server-card`.
 *
 * @returns The static paths, with the server passed through as a prop.
 */
export const getStaticPaths: GetStaticPaths = () =>
  servers.map((server) => ({
    params: { server: server.id },
    props: { server },
  }));

/**
 * Builds the Server Card for one server.
 *
 * @param context Astro route context; `props.server` is the entry from
 *   `src/data/servers.ts` that {@link getStaticPaths} passed through.
 * @returns The card as `application/mcp-server-card+json`.
 */
export const GET: APIRoute = async ({ props }) => {
  const { server } = props as { server: (typeof servers)[number] };
  // Read from the running server so the card matches what a client will see;
  // `server.version` is only the fallback. See src/lib/live-version.ts.
  const version = await liveVersion(server.endpoint, server.version);

  // Headers are declared on the remote, which is where a client needs them.
  // `isSecret` is what tells a client not to log or persist the value — the
  // same policy the page states in prose and the inspector enforces.
  const headers = [
    ...server.requiredHeaders.map((h) => ({
      name: h.name,
      description: h.description.en,
      isRequired: true,
      isSecret: h.secret === true,
    })),
    ...server.optionalHeaders.map((h) => ({
      name: h.name,
      description: h.description.en,
      isRequired: false,
      isSecret: h.secret === true,
    })),
  ];

  const card = {
    // This URL RETURNS 404 today (measured 2026-08-28; the root host does
    // answer 200, so it is not the domain — the schema is simply not
    // published). It stays anyway, on purpose: in JSON Schema `$schema` is an
    // IDENTIFIER, not a promise that it can be downloaded, and SEP-2127 is
    // still a draft — see this file's header. What would be a mistake is
    // inventing another URL that does not exist either.
    //
    // WHEN TO REVISIT: when SEP-2127 is approved. If they publish the schema
    // at another path by then, this line is the only thing that changes; and
    // if the draft dies, the right move is to drop the field, not leave it
    // pointing at a spec that never landed.
    $schema:
      "https://static.modelcontextprotocol.io/schemas/v1/server-card.schema.json",
    name: server.registryName,
    version,
    // From `card`, not from the page copy: `ServerDetail.description` caps at
    // 100 characters and the site's own blurbs are longer, while `title` has
    // to match what the running server reports or the card contradicts it.
    description: server.card.description,
    title: server.card.title,
    websiteUrl: server.docsSite ?? server.docs,
    remotes: [
      {
        type: "streamable-http",
        url: server.endpoint,
        ...(headers.length > 0 && { headers }),
      },
    ],
  };

  return new Response(JSON.stringify(card, null, 2), {
    headers: { "content-type": "application/mcp-server-card+json" },
  });
};
