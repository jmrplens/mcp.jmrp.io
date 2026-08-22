/**
 * `/robots.txt`.
 *
 * Sigue el patrón del de jmrp.io (mismo `Content-Signal`, mismo listado
 * explícito de bots, misma línea `Sitemap:`) porque los dos dominios son del
 * mismo autor: si declararan políticas distintas, un crawler que resuelva la
 * marca por un lado y por el otro recibiría dos respuestas contradictorias.
 *
 * Lo que NO se copia de allí son las rutas: aquel sitio tiene blog, feeds y
 * herramientas; aquí solo hay dos páginas, `/servers.json`, los `llms.txt` y
 * las tarjetas sociales. Nada de eso es privado y se quiere indexado entero,
 * así que no hay ni un `Disallow`.
 *
 * `/libgen` y `/gitlab` NO se listan: son endpoints JSON-RPC que solo contestan
 * a POST, no hay nada que rastrear en ellos y mencionarlos solo invitaría a
 * crawlers a probarlos.
 */
import type { APIRoute } from "astro";

import { SITE_ORIGIN } from "../lib/seo";

/** Buscadores clásicos, listados aunque el bloque `*` ya los cubra. */
const SEARCH_BOTS = [
  "Googlebot",
  "Bingbot",
  "YandexBot",
  "Baiduspider",
  "DuckDuckBot",
  "Applebot",
];

/**
 * Crawlers de IA con permiso explícito.
 *
 * Anthropic reparte el rastreo por propósito —ClaudeBot (entrenamiento),
 * Claude-User (una petición disparada por la pregunta de alguien) y
 * Claude-SearchBot (indexado)—, así que se nombran los tres: si algún día se
 * endurece el bloque comodín, la política de cada uno sigue siendo explícita.
 */
const AI_BOTS = [
  "GPTBot",
  "ChatGPT-User",
  "OAI-SearchBot",
  "ClaudeBot",
  "Claude-User",
  "Claude-SearchBot",
  "Anthropic-AI",
  "Google-Extended",
  "PerplexityBot",
  "Perplexity-User",
  "Bytespider",
  "CCBot",
  "cohere-ai",
  "Meta-ExternalAgent",
  "FacebookBot",
  "Applebot-Extended",
  "YouBot",
  "Amazonbot",
  "AI2Bot",
  "Diffbot",
  "Omgilibot",
  "ImagesiftBot",
  "PetalBot",
  "Timpibot",
];

/** La señal, repetida en cada grupo — ver el comentario de `BODY`. */
const CONTENT_SIGNAL = "Content-Signal: search=yes, ai-input=yes, ai-train=yes";

/**
 * Bloque `User-agent` + `Content-Signal` + `Allow: /` para cada agente.
 *
 * La señal se repite en todos los grupos a propósito: por RFC 9309 un rastreador
 * obedece UN solo grupo, el más específico que le corresponde, e ignora el resto
 * incluido `*`. Declarada solo en el comodín, los ~30 agentes con grupo propio
 * —justo sus destinatarios— nunca la veían (auditoría GEO de jmrp.io
 * 2026-08-22, M6).
 *
 * @param agents Nombres de los agentes tal cual los envían.
 * @returns Los bloques separados por una línea en blanco.
 */
function allowAll(agents: string[]): string {
  return agents
    .map((agent) => `User-agent: ${agent}\n${CONTENT_SIGNAL}\nAllow: /`)
    .join("\n\n");
}

const BODY = `User-agent: *
# Content Signals (https://contentsignals.org/) — intención explícita: este
# sitio quiere ser indexado por buscadores, usado como entrada de IA (RAG) y
# usado para entrenamiento. Son las TRES únicas claves que define la
# especificación; cualquier otra se ignora, así que no añadas ninguna más.
Content-Signal: search=yes, ai-input=yes, ai-train=yes
Allow: /

# --- Buscadores (allow explícito, por claridad) ---

${allowAll(SEARCH_BOTS)}

# --- Bots de IA / LLM (permitidos para indexado y entrenamiento) ---

${allowAll(AI_BOTS)}

# --- Descubrimiento ---

Sitemap: ${SITE_ORIGIN}/sitemap-index.xml

# Contexto para LLM (estándar llmstxt.org)
# ${SITE_ORIGIN}/llms.txt        — índice
# ${SITE_ORIGIN}/llms-full.txt   — cabeceras, métodos y ejemplos de los dos MCP
#
# Índice para máquinas (endpoints en JSON)
# ${SITE_ORIGIN}/servers.json
`;

/** Sirve el fichero como texto plano UTF-8: cualquier otro tipo lo ignoran. */
export const GET: APIRoute = () =>
  new Response(BODY, {
    headers: { "content-type": "text/plain; charset=utf-8" },
  });
