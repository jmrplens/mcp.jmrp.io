import type { APIRoute } from "astro";

import { servers } from "../data/servers";
import { SITE_ORIGIN } from "../lib/seo";

/**
 * `/mcp` — the path clients guess, answered in the shape they can read.
 *
 * Nothing is served here: this deployment hosts TWO servers, at `/libgen` and
 * `/gitlab`, so there is no single endpoint `/mcp` could honestly be. But a
 * plain 404 page is the wrong answer to the wrong question — the access log
 * shows real MCP clients POSTing JSON-RPC here (14 in the window measured,
 * ten of them POSTs), because `/mcp` is the conventional path a great many
 * deployments use, and what they got back was HTML.
 *
 * So the body is a JSON-RPC error object, which is the one thing every MCP
 * client already knows how to parse and surface, carrying the two real
 * endpoints inside it. `-32601` is "method not found" — the closest code the
 * spec has to "there is nothing at this address", and the same one a server
 * returns for a method it does not implement.
 *
 * THE STATUS SET HERE NEVER REACHES THE WIRE, and that is still true. This
 * route is prerendered: the build writes the body to `dist/mcp` and nginx
 * serves that file, so the `Response` status below is inert. What changed on
 * 2026-09-10 is what nginx does with it. It used to serve the file with a
 * plain 200 while the vhost comment claimed a 404, and a POST — the only case
 * this document exists for — never got the body at all, because the static
 * handler answers a non-GET with its HTML 405 page.
 *
 * The vhost now answers `/mcp` with `return 404` for every method and serves
 * this body from an internal location, so the wire carries 404 with the
 * JSON-RPC error, for GET, HEAD and POST alike. That is what the 2026-07-28
 * transport asks for: an unimplemented method is "404 Not Found and a
 * JSON-RPC error with code -32601". Keep the 404 below in step with it, so
 * `astro dev` and the deployed site agree.
 *
 * `endpoints` is built from `servers.ts` rather than written out, so a third
 * MCP server appears here the moment it is registered — this file has no list
 * of its own to forget to update.
 */
/** Directions for a client that probed the conventional path. @returns The JSON-RPC error. */
export const GET: APIRoute = () => respond();
/** The same, for a client that posted a real call here. @returns The JSON-RPC error. */
export const POST: APIRoute = () => respond();

/**
 * The same answer for either verb: a client that guessed the path deserves
 * the directions whether it probed with GET or posted a real call.
 *
 * @returns The JSON-RPC error, as `application/json`.
 */
function respond(): Response {
  return new Response(
    JSON.stringify(
      {
        jsonrpc: "2.0",
        id: null,
        error: {
          // A JSON-RPC spec code, not a quantity: `-32_601` exists as a
          // constant nowhere, and searching for it would find nothing.
          // eslint-disable-next-line unicorn/numeric-separators-style
          code: -32601,
          message: "No MCP server is mounted at /mcp on this host.",
          data: {
            reason:
              "mcp.jmrp.io hosts two MCP servers, each on its own path. Point your client at one of the endpoints below — both speak streamable HTTP, one POST per JSON-RPC call, stateless.",
            endpoints: servers.map((server) => ({
              name: server.id,
              url: server.endpoint,
              credentials:
                server.requiredHeaders.length > 0
                  ? server.requiredHeaders.map((header) => header.name)
                  : null,
              description: server.description.en,
              documentation: `${SITE_ORIGIN}/servers/${server.id}/`,
            })),
            index: `${SITE_ORIGIN}/servers.json`,
            llms: `${SITE_ORIGIN}/llms.txt`,
            inspector: `${SITE_ORIGIN}/inspector/`,
          },
        },
      },
      null,
      2,
    ),
    {
      status: 404,
      headers: {
        "content-type": "application/json; charset=utf-8",
        // Same as every other machine-readable document here: readable by a
        // browser-based client from any origin, since it is public, static
        // for every caller and carries no credential.
        "access-control-allow-origin": "*",
        "cache-control": "public, max-age=3600",
      },
    },
  );
}
