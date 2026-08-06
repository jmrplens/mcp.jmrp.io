import type { APIRoute } from "astro";

import { servers } from "../data/servers";

/**
 * Índice para máquinas. Sustituye al JSON que servía `location = /` en nginx
 * antes de que existiera el sitio: los clientes que lo consumían siguen
 * teniendo un endpoint estable, ahora en `/servers.json`.
 */
export const GET: APIRoute = () =>
  new Response(
    JSON.stringify(
      {
        service: "mcp.jmrp.io",
        transport: "streamable-http",
        endpoints: Object.fromEntries(servers.map((s) => [s.id, s.endpoint])),
        docs: "https://mcp.jmrp.io/",
      },
      null,
      2,
    ),
    { headers: { "content-type": "application/json" } },
  );
