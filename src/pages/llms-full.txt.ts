/**
 * `/llms-full.txt` — ficha completa de cada MCP para motores generativos.
 *
 * El contenido se genera en `src/lib/llms.ts` a partir de `servers.ts` y
 * `ui.ts`, no se escribe a mano.
 */
import type { APIRoute } from "astro";

import { buildLlmsFullTxt } from "../lib/llms";

/** Sirve el documento largo como texto plano UTF-8. */
export const GET: APIRoute = () =>
  new Response(buildLlmsFullTxt(), {
    headers: { "content-type": "text/plain; charset=utf-8" },
  });
