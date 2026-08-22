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
        // El mapa plano se mantiene tal cual: es la interfaz que consumen los
        // clientes existentes (Smithery lo lee). Solo se AÑADE; nunca se le
        // cambia la forma.
        endpoints: Object.fromEntries(servers.map((s) => [s.id, s.endpoint])),
        docs: "https://mcp.jmrp.io/",
        // Ficha completa por servidor: con 207 bytes, un agente que llegara
        // aquí sabía DÓNDE llamar pero no qué sabe hacer cada servidor ni qué
        // cabeceras necesita — y este fichero está enlazado justo para eso.
        servers: servers.map((s) => ({
          id: s.id,
          endpoint: s.endpoint,
          transport: "streamable-http",
          description: s.description.en,
          tools: s.tools.map((tool) => tool.name),
          // Prompts are a separate MCP capability from tools, and this index
          // only listed tools. The inspector lists them live, but no crawler
          // runs the inspector. Dropped entirely when a server has none.
          ...(s.prompts?.length && {
            prompts: s.prompts.map((prompt) => prompt.name),
          }),
          requiredHeaders: s.requiredHeaders.map((h) => h.name),
          optionalHeaders: s.optionalHeaders.map((h) => h.name),
          repository: s.repo,
          documentation: s.docsSite ?? s.docs,
          health: `${s.endpoint}/health`,
        })),
      },
      null,
      2,
    ),
    { headers: { "content-type": "application/json" } },
  );
