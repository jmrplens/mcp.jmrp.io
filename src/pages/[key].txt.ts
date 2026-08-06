import type { APIRoute } from "astro";

import { INDEXNOW_KEY } from "../lib/seo";

/**
 * Fichero de verificación de IndexNow.
 *
 * El protocolo exige que `https://<host>/<clave>.txt` devuelva la clave en
 * texto plano: es lo que demuestra que quien hace el ping controla el dominio.
 *
 * Se genera desde `seo.ts` para que la clave viva en un solo sitio — la misma
 * que usa el script de despliegue para avisar a Bing y Yandex.
 */
export function getStaticPaths() {
  return [{ params: { key: INDEXNOW_KEY } }];
}

/**
 *
 */
export const GET: APIRoute = () =>
  new Response(INDEXNOW_KEY, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
