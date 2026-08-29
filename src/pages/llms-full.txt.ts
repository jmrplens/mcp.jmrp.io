/**
 * `/llms-full.txt` — each MCP's full entry, for generative engines.
 *
 * The content is generated in `src/lib/llms.ts` from `servers.ts` and `ui.ts`;
 * it is not written by hand.
 */
import type { APIRoute } from "astro";

import { buildLlmsFullTxt } from "../lib/llms";

/** Serves the long document as plain UTF-8 text. */
export const GET: APIRoute = () =>
  new Response(buildLlmsFullTxt(), {
    headers: { "content-type": "text/plain; charset=utf-8" },
  });
