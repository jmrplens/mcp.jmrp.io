import type { Locator, Page } from "@playwright/test";

import { type Lang, ui } from "../../src/i18n/ui";

/**
 * Localizadores compartidos por los e2e.
 *
 * Existen para que los tests apunten a la INFORMACIÓN y no al markup: el diseño
 * de la página se ha rehecho una vez (la línea "Required headers: X" pasó a ser
 * una insignia más una `<dl>`) y volverá a cambiar. Lo que no puede cambiar sin
 * que sea un fallo de contenido es qué dice cada ficha y qué controles ofrece
 * el inspector.
 *
 * Este fichero NO es una spec: Playwright solo recoge `*.spec.ts`.
 */

/**
 * Ficha de un servidor, identificada por su heading.
 *
 * Se devuelve la tarjeta entera para poder afirmar que un dato está en SU
 * servidor. Buscar el texto suelto en la página no distingue si "PRIVATE-TOKEN"
 * sale en la ficha de gitlab o en la de libgen, y esa confusión es justo el
 * error que estos tests tienen que cazar.
 *
 * @param page Página bajo test.
 * @param name Nombre del servidor, tal cual sale en `src/data/servers.ts`.
 * @returns El `<article>` de esa ficha.
 */
export function serverCard(page: Page, name: string): Locator {
  return page
    .getByRole("article")
    .filter({ has: page.getByRole("heading", { name, exact: true }) });
}

/**
 * La isla del inspector.
 *
 * Acotar a la isla no es cosmética: la sección de servidores es una región con
 * nombre accesible ("Servers" / "Servidores"), así que un `getByLabel` a nivel
 * de página engancha la región y el `<select>` a la vez y revienta por modo
 * estricto.
 *
 * @param page Página bajo test.
 * @returns El contenedor de la isla.
 */
export function inspector(page: Page): Locator {
  return page.getByTestId("inspector");
}

/**
 * El desplegable de servidor de la isla.
 *
 * La etiqueta sale de `ui.ts` y no de un literal: cuando pasó de "Server" a
 * "Endpoint" —para dejar de chocar con el eyebrow "Servers"— nueve tests se
 * pusieron en rojo a la vez por tenerla escrita a mano.
 *
 * @param page Página bajo test.
 * @param lang Idioma de la página.
 * @returns El `<select>` de servidor.
 */
export function serverSelect(page: Page, lang: Lang = "en"): Locator {
  return inspector(page).getByLabel(ui[lang].insp.server);
}

/**
 * Respuesta con la que el stub contesta a un método.
 *
 * `json` se envuelve en SSE (`data: {…}`), que es como contestan de verdad
 * estos servidores; `body` va tal cual, para poder devolver el texto pelado de
 * un error de transporte. `hang` no contesta nunca: es la única forma de
 * probar el botón de cancelar.
 */
export type McpStub = {
  status?: number;
  json?: unknown;
  body?: string;
  hang?: boolean;
};

/** Petición que salió del navegador hacia un MCP, ya capturada. */
export type SentRequest = {
  url: string;
  headers: Record<string, string>;
  body: { method?: string; params?: unknown };
};

// Peticiones a otro origen (mcp.jmrp.io desde localhost), así que sin estas
// cabeceras el navegador tira la respuesta y la isla solo ve un TypeError.
const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "*",
  "access-control-allow-headers": "*",
};

/**
 * Intercepta los endpoints MCP y responde según el método pedido.
 *
 * Los tests de interfaz NO pueden depender de lo que conteste el servidor de
 * producción: lo que se comprueba aquí es que un `isError: true` se pinta
 * distinto de un acierto, y para eso hace falta poder provocar cada caso.
 *
 * @param page Página bajo test.
 * @param reply Qué devolver para cada método JSON-RPC.
 * @returns El array donde se van anotando las peticiones que salen.
 */
export async function stubMcp(
  page: Page,
  reply: (method: string) => McpStub,
): Promise<SentRequest[]> {
  const sent: SentRequest[] = [];
  await page.route(/mcp\.jmrp\.io\/(gitlab|libgen)$/, async (route) => {
    const request = route.request();
    if (request.method() === "OPTIONS") {
      await route.fulfill({ status: 204, headers: CORS });
      return;
    }
    const body = (request.postDataJSON() ?? {}) as SentRequest["body"];
    sent.push({ url: request.url(), headers: request.headers(), body });

    const stub = reply(body.method ?? "");
    if (stub.hang) return;
    await route.fulfill({
      status: stub.status ?? 200,
      headers: { ...CORS, "content-type": "text/event-stream" },
      body: stub.body ?? `data: ${JSON.stringify(stub.json ?? {})}\n\n`,
    });
  });
  return sent;
}

/**
 * Catálogo de ejemplo para `tools/list`.
 *
 * Es el de libgen recortado, con el `inputSchema` real de `search`: una sola
 * propiedad obligatoria (`query`) y otra opcional. Esa forma es la que hace
 * fallar a quien adivina los argumentos, y por tanto la que hay que probar.
 */
export const TOOLS_LIST = {
  jsonrpc: "2.0",
  id: 1,
  result: {
    tools: [
      {
        name: "search",
        description: "Search Library Genesis",
        inputSchema: {
          type: "object",
          required: ["query"],
          properties: {
            query: { type: "string", description: "What to look for" },
            results_per_page: { type: "integer", description: "Page size" },
          },
        },
      },
      { name: "download", inputSchema: { type: "object" } },
    ],
  },
};
