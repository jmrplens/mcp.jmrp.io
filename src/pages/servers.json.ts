import type { APIRoute } from "astro";

import { serverCardDocuments } from "../data/server-cards";
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
        servers: servers.map((s) => {
          // Prompts, recursos y plantillas son tres capacidades MCP distintas
          // de las herramientas, y este índice solo listaba herramientas: las
          // enumera el inspector en vivo, pero ningún rastreador ejecuta el
          // inspector. Salen del card committeado y no de `servers.ts` porque
          // ahí solo hay copia escrita a mano, que gitlab no tiene para sus 37
          // prompts; el card lo refresca `scripts/sync-server-cards.sh` en cada
          // release, así que no puede desviarse de lo que responde el servidor.
          // Se comprueba en vez de indexar a secas: un servidor puede estar
          // dado de alta antes de que aterrice su snapshot.
          const card = serverCardDocuments[s.id];
          const prompts = s.prompts?.length
            ? s.prompts.map((prompt) => prompt.name)
            : (card?.prompts ?? []).map((prompt) => prompt.name);
          // Recursos y plantillas van por URI, no por nombre: `resources/read`
          // direcciona por URI y el nombre a solas no es invocable.
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
            // Cada familia se omite entera cuando está vacía, para que un
            // servidor que no la exponga conserve exactamente el juego de
            // claves que ya tenía: nada de lo que hoy parsea este fichero ve
            // aparecer una clave vacía.
            ...(prompts.length > 0 && { prompts }),
            ...(resources.length > 0 && { resources }),
            ...(resourceTemplates.length > 0 && { resourceTemplates }),
            requiredHeaders: s.requiredHeaders.map((h) => h.name),
            optionalHeaders: s.optionalHeaders.map((h) => h.name),
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
