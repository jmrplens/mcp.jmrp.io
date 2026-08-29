/**
 * `/llms.txt` — the site's index for generative engines (llmstxt.org).
 *
 * The content is generated in `src/lib/llms.ts` from `servers.ts` and `ui.ts`;
 * it is not written by hand.
 */
import type { APIRoute } from "astro";

import { buildLlmsTxt } from "../lib/llms";

/** Serves the index as plain UTF-8 text, which is what the standard expects. */
export const GET: APIRoute = () =>
  new Response(buildLlmsTxt(), {
    headers: { "content-type": "text/plain; charset=utf-8" },
  });
