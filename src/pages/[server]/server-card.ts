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
  servers.map((server) => ({ params: { server: server.id }, props: { server } }));

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
    // Esta URL DEVUELVE 404 hoy (medido el 2026-08-28; el host raíz sí
    // responde 200, así que no es el dominio, es que el esquema no está
    // publicado). Se deja igualmente, y a propósito: en JSON Schema `$schema`
    // es un IDENTIFICADOR, no una promesa de que se pueda descargar, y
    // SEP-2127 sigue siendo borrador — ver la cabecera de este fichero. Lo que
    // sería un error es inventarse otra URL que tampoco existe.
    //
    // CUÁNDO REVISARLO: cuando SEP-2127 se apruebe. Si para entonces publican
    // el esquema en otra ruta, esta línea es lo único que cambia; y si el
    // borrador muere, lo correcto es quitar el campo, no dejarlo apuntando a
    // una spec que no llegó.
    $schema:
      "https://static.modelcontextprotocol.io/schemas/v1/server-card.schema.json",
    name: server.registryName,
    version,
    description: server.description.en,
    title: server.name,
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
