/**
 * Nonces CSP por visitante sobre HTML cacheado en el edge — mcp.jmrp.io.
 *
 * Copia del Worker de jmrp.io, sin su lógica de RSS (aquí no hay feeds).
 *
 * ── El problema ──────────────────────────────────────────────────────────
 * La CSP del sitio va por nonce, así que cada respuesta HTML es única y el
 * origen la sirve `no-store`: un sitio estático que renuncia a su CDN.
 * Cachear una página con nonce haría que los visitantes compartieran nonce,
 * que es justo lo que los nonces existen para evitar.
 *
 * ── Cómo funciona ────────────────────────────────────────────────────────
 * 1. El Worker pide al origen con la cabecera secreta (X-Edge-Nonce-Key).
 *    nginx entonces fija $cspNonce al literal "NGINX_CSP_NONCE", su
 *    sub_filter se vuelve un no-op, y la página sale con el marcador intacto
 *    en el cuerpo y en la cabecera CSP. Esa copia es la que se cachea.
 * 2. Por petición, el Worker acuña un nonce de 128 bits y sustituye el
 *    marcador en cuerpo y cabecera. Al navegador le llega `no-store`, así que
 *    nadie aguas abajo cachea un nonce ya acuñado.
 *
 * ── El raíl de seguridad (no quitar) ──────────────────────────────────────
 * Si nginx no reconoce el secreto (rotado, typo, config revertida), el origen
 * sustituye un nonce real ANTES de que se cachee — y un nonce real cacheado y
 * servido a cualquiera es exactamente la vulnerabilidad que los nonces
 * evitan. Por eso el Worker se niega a servir cualquier respuesta cuya
 * cabecera CSP no traiga el marcador: cae a un fetch de paso, sin cachear, y
 * lo marca en X-Edge-Nonce para que se vea.
 *
 * ── Alcance ──────────────────────────────────────────────────────────────
 * /libgen* y /gitlab* NO deben pasar por aquí: son proxy vivo con respuestas
 * SSE y healthchecks, y una caché de 24 h los congelaría. Están dados de alta
 * como rutas de zona SIN worker, que ganan por ser más específicas que
 * mcp.jmrp.io/*. El Worker deja pasar de largo cuanto no sea GET/HEAD,
 * así que el tráfico MCP real (POST) estaría a salvo igualmente, pero un
 * GET /libgen/health sí se cachearía.
 */
const PLACEHOLDER = "NGINX_CSP_NONCE";
const EDGE_TTL_SECONDS = 86_400; // cached placeholder copy; purged with the zone

export default {
  async fetch(request, env) {
    // Fail open, always: an exception here must degrade to "the worker adds
    // nothing", never to Cloudflare's 1101 error page. With the worker routed
    // over all site HTML, failing closed would take the whole site down.
    try {
      return await handle(request, env);
    } catch {
      try {
        return await fetch(request);
      } catch {
        return new Response("origin unreachable", { status: 502 });
      }
    }
  },
};

async function handle(request, env) {
  {
    // Anything that is not a plain page read passes straight through.
    if (request.method !== "GET" && request.method !== "HEAD") {
      return fetch(request);
    }

    const originRequest = new Request(request);
    originRequest.headers.set("X-Edge-Nonce-Key", env.EDGE_NONCE_KEY);

    const response = await fetch(originRequest, {
      cf: {
        cacheEverything: true,
        // Per-status TTLs: success gets the full TTL, redirects and 404s a
        // short one, and origin errors are never cached — a 5xx burst must
        // not be frozen into the edge for a day.
        cacheTtlByStatus: {
          "200-299": EDGE_TTL_SECONDS,
          "300-399": 3600,
          "404": 300,
          "500-599": 0,
        },
      },
    });

    const contentType = response.headers.get("content-type") ?? "";
    if (!contentType.includes("text/html")) return response;

    // Safety rail: only serve from the placeholder copy. A response whose CSP
    // already carries a real nonce must never be fanned out to more visitors.
    const csp = response.headers.get("content-security-policy") ?? "";
    if (!csp.includes(PLACEHOLDER)) {
      const passthrough = await fetch(request);
      const headers = new Headers(passthrough.headers);
      headers.set("X-Edge-Nonce", "bypass-no-placeholder");
      return new Response(passthrough.body, {
        status: passthrough.status,
        headers,
      });
    }

    // Fresh 128-bit nonce per visitor.
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    const nonce = [...bytes]
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");

    const body = (await response.text()).replaceAll(PLACEHOLDER, () => nonce);

    const headers = new Headers(response.headers);
    headers.set(
      "content-security-policy",
      csp.replaceAll(PLACEHOLDER, () => nonce),
    );
    // The minted nonce must never be cached downstream.
    headers.set(
      "cache-control",
      "no-store, no-cache, must-revalidate, max-age=0",
    );
    // Observability: worker ran + whether the edge had the placeholder copy.
    headers.set("X-Edge-Nonce", "minted");
    const subCache = response.headers.get("cf-cache-status");
    if (subCache) headers.set("X-Edge-Sub-Cache", subCache);

    return new Response(body, { status: response.status, headers });
  }
}
