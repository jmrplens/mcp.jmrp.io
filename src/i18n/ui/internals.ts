/**
 * Internals page strings.
 *
 * Only the three keys `Base.astro` needs for any page (`metaTitle`, `title`,
 * `lede`) exist so far. Task 7 fills in the long-form content: the request
 * path a visitor's call actually takes — browser to Cloudflare, to nginx, to
 * one of three running instances, out through the egress proxy, to the
 * destination it asked for.
 */
export const internals = {
  en: {
    title: "Internals",
    metaTitle: "Internals — how a request reaches mcp.jmrp.io · jmrp.io",
    lede: "How a request actually reaches these servers: from your browser, through Cloudflare, nginx, one of three running instances and an egress proxy, to the destination it asked for.",
  },
  es: {
    title: "Funcionamiento interno",
    metaTitle: "Funcionamiento interno — cómo enruta mcp.jmrp.io · jmrp.io",
    lede: "Cómo llega de verdad una petición a estos servidores: desde tu navegador, pasando por Cloudflare, nginx, una de las tres instancias en marcha y un proxy de salida, hasta el destino que pedías.",
  },
} as const;
