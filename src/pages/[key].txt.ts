import type { APIRoute } from "astro";

import { INDEXNOW_KEY } from "../lib/seo";

/**
 * The IndexNow verification file.
 *
 * The protocol requires `https://<host>/<key>.txt` to return the key as plain
 * text: that is what proves whoever pings controls the domain.
 *
 * It is generated from `seo.ts` so the key lives in one place — the same one
 * the deployment script uses to notify Bing and Yandex.
 */
export function getStaticPaths() {
  return [{ params: { key: INDEXNOW_KEY } }];
}

/**
 * Serves the key as plain text, which is the entire file.
 *
 * @returns The response carrying the key.
 */
export const GET: APIRoute = () =>
  new Response(INDEXNOW_KEY, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
