/**
 * `/llms.txt` — índice del sitio para motores generativos (llmstxt.org).
 *
 * El contenido se genera en `src/lib/llms.ts` a partir de `servers.ts` y
 * `ui.ts`, no se escribe a mano.
 */
import type { APIRoute } from "astro";

import { buildLlmsTxt } from "../lib/llms";

/** Sirve el índice como texto plano UTF-8, que es lo que espera el estándar. */
export const GET: APIRoute = () =>
  new Response(buildLlmsTxt(), {
    headers: { "content-type": "text/plain; charset=utf-8" },
  });
