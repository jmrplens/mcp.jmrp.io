/**
 * Grafo JSON-LD del sitio.
 *
 * Emite un único `@graph` por página con cuatro clases de nodo:
 *
 *   - `WebSite`  — el sitio entero, una sola vez para las dos versiones.
 *   - `WebPage`  — la página concreta (un `@id` por idioma).
 *   - `WebAPI`   — el nodo de UN servidor, y SOLO en la página que lo
 *     describe: su propia ficha `/servers/<id>/` (en las dos versiones de
 *     idioma). Cualquier otra página que necesite mencionarlo —la portada,
 *     `/servers/`— lo REFERENCIA por `@id` (`mainEntity`, el `about` del
 *     FAQ) sin volver a declarar sus datos. Antes este nodo se redefinía
 *     entero en la portada Y en `/servers/`, y no existía en absoluto en la
 *     ficha que describe — la entidad partida en dos copias que podían
 *     desincronizarse, en la página equivocada. Ver `buildApiNode` más abajo
 *     y `servers-section-spec.md`, "Lo que arrastra".
 *   - `Person`   — el nodo canónico de jmrp.io, empalmado tal cual.
 *
 * Todos los nodos propios apuntan a la persona por `@id`
 * (`publisher`/`author`/`provider`), nunca redeclarando sus datos: el
 * documento de identidad es la única fuente de verdad de quién es el autor, y
 * duplicarlo aquí garantizaría que las dos copias se desincronizaran. El
 * mismo principio —referenciar sin redefinir— es el que ahora rige también el
 * nodo `WebAPI`.
 *
 * El documento `person.jsonld` NO se publica en este dominio: el vhost sirve
 * por lista blanca de `location =` y añadir una entrada exigiría editar
 * /etc/nginx a mano. Su URL dereferenciable sigue siendo la de jmrp.io.
 */
import type { McpNotice, McpServer } from "../data/servers";
import { servers } from "../data/servers";
import type { Lang } from "../i18n/ui";
import { ui } from "../i18n/ui";
import { buildDate, publishedDate } from "./build-date";
import { loadPersonNode, PERSON_ID } from "./identity";
import {
  LANGS,
  OG_IMAGE_SIZE,
  ogImageUrl,
  type PageId,
  pageUrl,
  serverPageUrl,
  SITE_NAME,
  SITE_ORIGIN,
} from "./seo";

// Ver build-date.ts: HEAD si el árbol está limpio, ahora si está sucio. El
// fallback a la hora actual solo aplica sin git, y `buildDate()` lo cachea
// para que este valor coincida con el del pie y el de `<UpdatedLine>`.
const BUILD_DATE = buildDate();

// Primer commit del repo. Sin git no hay fecha y el campo se omite: ver
// build-date.ts.
const PUBLISHED_DATE = publishedDate();

/** `@id` del nodo `WebSite`, al que cuelgan las páginas por `isPartOf`. */
const WEBSITE_ID = `${SITE_ORIGIN}/#website`;

/** Un literal con `@language` por idioma, para nodos con un `@id` compartido. */
type LocalizedValue = { "@value": string; "@language": Lang };

/**
 * Convierte un par EN/ES en literales etiquetados por idioma.
 *
 * Los nodos `WebSite` y `WebAPI` se emiten con el MISMO `@id` desde las dos
 * páginas; si su `description` fuera una cadena suelta, cada idioma afirmaría
 * un valor distinto para la misma propiedad del mismo nodo. Etiquetar el
 * idioma convierte esa colisión en lo que de verdad es: un texto bilingüe.
 */
function localized(values: { en: string; es: string }): LocalizedValue[] {
  return [
    { "@value": values.en, "@language": "en" },
    { "@value": values.es, "@language": "es" },
  ];
}

/** Referencia a un nodo ya declarado (aquí o en el documento de identidad). */
function ref(id: string): { "@id": string } {
  return { "@id": id };
}

/** `@id` del nodo `WebAPI`/`SoftwareApplication` de un servidor. */
function apiId(server: McpServer): string {
  return `${server.endpoint}#api`;
}

/**
 * `@id` del nodo `SoftwareSourceCode` de un servidor.
 *
 * `#source-code`, NUNCA `#software`: ese IRI ya lo define jmrp.io/projects
 * como un `SoftwareApplication` con nombre y licencia distintos, y describir
 * el mismo `@id` con datos contradictorios desde dos páginas hace que la
 * entidad fusionada se contradiga a sí misma — la regresión que este fichero
 * ya sufrió y que `#source-code` existe para no repetir. Ver el comentario
 * largo en {@link buildSourceNode}.
 */
function sourceId(server: McpServer): string {
  return `${server.repo}#source-code`;
}

/**
 * Construye el nodo `WebAPI`/`SoftwareApplication` completo de UN servidor.
 *
 * Solo se llama desde `buildSiteGraph` cuando la página que se está pintando
 * ES la ficha de ESE servidor (`meta.serverId` coincide) — la entidad vive
 * donde se la describe. Cualquier otra página que necesite mencionarlo usa
 * `ref(apiId(server))` en vez de volver a llamar a esta función: eso es lo
 * que mantiene un único sitio con los datos reales y evita que dos páginas
 * afirmen cosas distintas sobre el mismo `@id`.
 *
 * @param server Servidor de `src/data/servers.ts`.
 * @returns El nodo listo para el `@graph`.
 */
function buildApiNode(server: McpServer): Record<string, unknown> {
  return {
    // Multi-tipado a propósito: `WebAPI` cuelga de `Intangible`, así que por sí
    // solo deja fuera `license`, `dateModified` e `isAccessibleForFree` — que
    // son justo los hechos que deciden si un asistente recomienda un endpoint.
    // Añadir `SoftwareApplication` (rama `CreativeWork`) los habilita sin
    // renunciar a la semántica precisa de "esto es una API".
    "@type": ["WebAPI", "SoftwareApplication"],
    "@id": apiId(server),
    name: server.name,
    url: server.endpoint,
    description: localized(server.description),
    documentation: server.docsSite ?? server.docs,
    serviceType: "Model Context Protocol server",
    // El mismo ancla de Wikidata que el `knowsAbout` del autor — y con el
    // MISMO esquema `http://`, que es el URI de concepto canónico de Wikidata
    // y el que ya usa jmrp.io. Con `https://` el grafo declaraba dos recursos
    // distintos para el mismo concepto.
    //
    // `about` and not `additionalType`: schema.org defines the latter as "a
    // relationship between something and a CLASS that the thing is in", for
    // pulling more specific TYPES from external vocabularies. Q133436854 is
    // the Model Context Protocol — a protocol concept, not a class this
    // endpoint instantiates. The node is already multi-typed as WebAPI +
    // SoftwareApplication, so `about` carries the same entity anchor with the
    // semantics schema.org actually documents.
    // eslint-disable-next-line sonarjs/no-clear-text-protocols, unicorn/prefer-https -- No es un enlace: es el IRI de CONCEPTO canónico de Wikidata, que usa http:// por definición (la web sirve https, el identificador no cambia). Con https sería un recurso RDF distinto del que ya usan knowsAbout y jmrp.io — de hecho eslint --fix lo "corrigió" en silencio y partió la entidad en dos.
    about: "http://www.wikidata.org/entity/Q133436854",
    applicationCategory: "DeveloperApplication",
    operatingSystem: "Any (HTTP)",
    // La misma IRI de licencia que usa jmrp.io/projects, no la de SPDX: en RDF
    // son recursos distintos, y las entidades de este dominio deben contar la
    // misma historia que las del canónico.
    license: "https://opensource.org/licenses/MIT",
    isAccessibleForFree: true,
    dateModified: BUILD_DATE,
    ...(PUBLISHED_DATE && { datePublished: PUBLISHED_DATE }),
    // Qué sabe hacer, sin ejecutar el endpoint: es la pregunta que un agente
    // hace sobre un servidor MCP, y hasta ahora solo la respondía `tools/list`
    // en vivo.
    featureList: server.tools.map((tool) => tool.name),
    offers: {
      "@type": "Offer",
      // `url` es la propiedad recomendada que faltaba: dónde se obtiene lo
      // ofertado. Para un endpoint gratuito, el endpoint mismo.
      url: server.endpoint,
      price: "0",
      priceCurrency: "USD",
      availability: "https://schema.org/InStock",
    },
    provider: ref(PERSON_ID),
    // `provider` dice quién lo OPERA; `author` quién lo HIZO. Aquí son la
    // misma persona y el texto visible ya lo afirma ("who is also the author
    // of both servers") — el grafo debe contar la misma historia.
    author: ref(PERSON_ID),
    // Camino de vuelta al código: `targetProduct` no tiene inversa en
    // schema.org, así que sin esto quien entra por `mainEntity` nunca llega
    // al repositorio.
    isBasedOn: ref(sourceId(server)),
    // `softwareHelp` used to be a bare `ref()`, pointing at an `@id` nothing
    // defines: the gitlab docs site names its node `…/#webpage`, never the
    // naked URL, so the reference dangled. libgen's happened to resolve — its
    // docs site does define a CollectionPage with the bare `@id` — so the same
    // code behaved differently per server, which is how the 2026-08-22 audit
    // found it. A typed inline node says what the URL is without claiming to
    // define someone else's `@id`; the range is CreativeWork, so a plain URL
    // would not do either.
    softwareHelp: {
      "@type": "WebPage",
      url: server.docsSite ?? server.docs,
      name: `${server.name} documentation`,
    },
    // What a caller has to bring. This is the "can I actually use this?" fact,
    // and until now only /servers.json answered it — the graph did not.
    permissions:
      server.requiredHeaders.length > 0
        ? server.requiredHeaders
            .map((h) => `Requires a ${h.name} header on every request.`)
            .join(" ")
        : "None. The server is public and takes no credentials.",
    softwareRequirements:
      "An MCP client speaking streamable HTTP (JSON-RPC 2.0 over POST).",
    // The descriptions are bilingual literals, so the node is too.
    inLanguage: ["en", "es"],
    // Fichas de directorios MCP que describen ESTE servidor (no el repo: el
    // repo se enlaza vía isBasedOn → codeRepository). Si no hay, el undefined
    // desaparece solo al serializar.
    sameAs: server.sameAs,
    // Cómo se llama de verdad: POST con JSON-RPC, no un GET a la URL. Un
    // rastreador que siga `url` recibe un 405, que es correcto por diseño.
    // Two actions: how to call it, and how to ask whether it is up. The second
    // is the question an agent asks BEFORE the first, and until now only
    // /servers.json answered it — the health URLs were absent from the graph
    // even though both return 200.
    potentialAction: [
      {
        "@type": "Action",
        name: "JSON-RPC 2.0 call over streamable HTTP",
        target: {
          "@type": "EntryPoint",
          urlTemplate: server.endpoint,
          httpMethod: "POST",
          encodingType: "application/json",
          contentType: "application/json, text/event-stream",
        },
      },
      {
        "@type": "CheckAction",
        name: "Health check",
        target: {
          "@type": "EntryPoint",
          urlTemplate: `${server.endpoint}/health`,
          httpMethod: "GET",
          contentType: "application/json",
        },
      },
    ],
  };
}

/**
 * Construye el nodo `SoftwareSourceCode` de UN servidor — el puente entre el
 * endpoint y el repositorio que lo produce, la prueba detrás de "¿puedo
 * fiarme?". Vive en la MISMA página que su `WebAPI` (ver {@link buildApiNode}):
 * la ficha de ese servidor, nunca en otra.
 *
 * Es deliberadamente un STUB: los sitios de documentación
 * (jmrplens.github.io/{gitlab-mcp-server,libgen-mcp}) son la casa de esta
 * entidad y llevan `name`, `creator`, `maintainer`, `isPartOf` y el
 * `runtimePlatform` real. Lo único que esta página aporta, y nadie más puede,
 * es qué endpoint alojado corre ese código — vía `targetProduct`, hacia el
 * `WebAPI` de esta misma página y, como referencia externa sin redefinir, hacia
 * el `#software` canónico de jmrp.io/projects (mismo principio que el `owns`
 * del documento de identidad).
 *
 * @param server Servidor de `src/data/servers.ts`.
 * @returns El nodo listo para el `@graph`.
 */
function buildSourceNode(server: McpServer): Record<string, unknown> {
  return {
    "@type": "SoftwareSourceCode",
    "@id": sourceId(server),
    codeRepository: server.repo,
    targetProduct: [ref(apiId(server)), ref(`${server.repo}#software`)],
  };
}

/** Datos de la página que el grafo necesita del layout. */
export interface PageMeta {
  lang: Lang;
  title: string;
  description: string;
  /**
   * Which page this is. Defaults to `"home"` for callers that predate this
   * field (there are none left in `src/`, but the test helpers construct
   * `PageMeta` literals directly).
   */
  page?: PageId;
  /**
   * Server id for a per-server detail page (`/servers/<id>/`).
   *
   * When set, this page IS that server's `WebAPI`/`SoftwareApplication` and
   * `SoftwareSourceCode` nodes' home: `buildSiteGraph` builds them in full
   * here (see `buildApiNode`/`buildSourceNode`) instead of the lightweight
   * `ref()` every other page uses. It also drives the `WebPage`'s
   * `url`/`@id`/translation pair via `serverPageUrl`, because
   * `pageUrl(lang, "servers")` — the fixed path `PAGE_PATHS` knows — is the
   * `/servers/` INDEX's URL, not any one server's; every detail page shares
   * `page: "servers"` (for nav/breadcrumb) but NOT this `@id`.
   */
  serverId?: string;
}

/**
 * Server this page IS the ficha of — `undefined` for every page except
 * `/servers/<id>/`. Throws rather than silently ignoring a mismatch: a
 * `serverId` that does not match any entry in `servers.ts` is a caller bug (a
 * stale id, a typo), and rendering the page as if it were a normal one would
 * hide it behind a graph that quietly stopped matching the URL.
 *
 * @param serverId `PageMeta.serverId` — unset for every page but a server
 *   ficha.
 * @returns The matching server, or `undefined` when `serverId` is unset.
 */
function resolveTargetServer(
  serverId: string | undefined,
): McpServer | undefined {
  if (!serverId) return undefined;
  const server = servers.find((candidate) => candidate.id === serverId);
  if (!server) {
    throw new Error(`[jsonld] serverId "${serverId}" has no entry in servers.ts`);
  }
  return server;
}

/**
 * This page's URL and its translation's.
 *
 * `pageUrl(lang, page)` only knows the FIXED path per `PageId` — for
 * `page: "servers"` that is the `/servers/` INDEX, not any one server's
 * ficha. `serverPageUrl` is the per-server equivalent every detail page needs
 * instead. See the `serverId` doc on `PageMeta`.
 *
 * @param lang This page's language.
 * @param page This page's `PageId`, used for the fixed-path case.
 * @param targetServer The server this page is the ficha of, from
 *   {@link resolveTargetServer}.
 * @returns `url` for this page and `otherUrl` for its translation.
 */
function resolvePageUrls(
  lang: Lang,
  page: PageId,
  targetServer: McpServer | undefined,
): { url: string; otherUrl: string } {
  const otherLang: Lang = lang === "en" ? "es" : "en";
  if (targetServer) {
    return {
      url: serverPageUrl(lang, targetServer.id),
      otherUrl: serverPageUrl(otherLang, targetServer.id),
    };
  }
  return { url: pageUrl(lang, page), otherUrl: pageUrl(otherLang, page) };
}

/**
 * What THIS page's `mainEntity` should reference.
 *
 * schema.org defines `mainEntity` as "the primary entity described in this
 * page", so it can only point at server APIs on pages that actually describe
 * one. A server ficha's primary entity is SOLELY its own server, never the
 * other one. The home page and `/servers/` describe every server, so they
 * keep the full list. Every other page — `/inspector/`, `/internals/`,
 * `/policies/` — describes no server at all, so `mainEntity` is omitted
 * rather than claim a false subject: those pages used to inherit `apiRefs`
 * wholesale and claimed both server APIs as their primary entity despite
 * rendering no server description.
 *
 * @param page This page's `PageId`.
 * @param targetServer The server this page is the ficha of, from
 *   {@link resolveTargetServer}.
 * @param apiRefs References to every server's `WebAPI` node.
 * @returns The refs for `mainEntity`, or `undefined` to omit the property.
 */
function selectMainEntityRefs(
  page: PageId,
  targetServer: McpServer | undefined,
  apiRefs: { "@id": string }[],
): { "@id": string }[] | undefined {
  if (targetServer) return [ref(apiId(targetServer))];
  const describesEveryServer = page === "home" || page === "servers";
  return describesEveryServer ? apiRefs : undefined;
}

/**
 * Construye el grafo JSON-LD completo de una página.
 *
 * @param meta Idioma, título, descripción, página y —para una ficha de
 *   servidor— el `serverId` que dice de cuál se está pintando.
 * @returns Objeto listo para serializar con {@link safeJsonLd}.
 */
export async function buildSiteGraph(
  meta: PageMeta,
): Promise<Record<string, unknown>> {
  const { lang, title, description, page = "home", serverId } = meta;

  const targetServer = resolveTargetServer(serverId);
  const { url, otherUrl } = resolvePageUrls(lang, page, targetServer);

  // The FAQ (and its speakable pointer) describes the notice cards, and those
  // only render on the home page — see HomePage.astro / ServerCard. Emitting
  // a FAQPage on /inspector/ or /policies/ would be structured data with no
  // matching content on the page, which is the defect this task fixes.
  const isHome = page === "home";

  // The full WebAPI+SoftwareApplication (and matching SoftwareSourceCode)
  // node: built ONLY when this page IS that server's own ficha — see
  // `buildApiNode`/`buildSourceNode`'s doc comments for why. Every other page
  // gets an empty array here and reaches the same entity through `apiRefs`
  // below instead, which is a bare `{"@id": …}` and never redeclares the
  // node's data.
  const apis = targetServer ? [buildApiNode(targetServer)] : [];
  const sources = targetServer ? [buildSourceNode(targetServer)] : [];

  // References to EVERY server's WebAPI node, regardless of whether this
  // page defines one — this is what `mainEntity` (home and `/servers/`, via
  // `selectMainEntityRefs`) and the FAQ's `about` (home only) point through.
  // `provider` cierra el par recíproco con el `owns` del documento de
  // identidad, que ya declara los `#software` de estos dos repos; `sameAs`
  // lleva al repositorio, que es el sujeto de aquellos nodos.
  const apiRefs = servers.map((server) => ref(apiId(server)));
  const mainEntityRefs = selectMainEntityRefs(page, targetServer, apiRefs);

  const website = {
    "@type": "WebSite",
    "@id": WEBSITE_ID,
    url: `${SITE_ORIGIN}/`,
    name: SITE_NAME,
    description: localized({ en: ui.en.lede, es: ui.es.lede }),
    inLanguage: LANGS,
    publisher: ref(PERSON_ID),
  };

  const webpage = {
    "@type": "WebPage",
    "@id": `${url}#webpage`,
    url,
    name: title,
    description,
    inLanguage: lang,
    isPartOf: ref(WEBSITE_ID),
    // The FAQ is part of this page — but only for the home page, which is the
    // only one with notice cards to describe. Without this the link ran one
    // way only: #faq declared its `isPartOf`, but nothing led from the page
    // down to it.
    ...(isHome && { hasPart: ref(`${url}#faq`) }),
    // hreflang already says these two pages are translations of each other;
    // the graph did not. Same pairing jmrp.io/about/#profile already emits.
    // The other language's `#webpage` for THIS SAME page, not the home
    // page's — each page pairs with its own translation. `otherUrl` already
    // resolves through `serverPageUrl` for a server ficha (see above), so a
    // ficha pairs with ITS OWN translation, never the `/servers/` index's.
    ...(lang === "en"
      ? { workTranslation: ref(`${otherUrl}#webpage`) }
      : { translationOfWork: ref(`${otherUrl}#webpage`) }),
    // The OG cards exist and return 200, and the page node carried no image
    // at all.
    primaryImageOfPage: {
      "@type": "ImageObject",
      url: ogImageUrl(lang),
      width: OG_IMAGE_SIZE.width,
      height: OG_IMAGE_SIZE.height,
    },
    author: ref(PERSON_ID),
    publisher: ref(PERSON_ID),
    dateModified: BUILD_DATE,
    ...(PUBLISHED_DATE && { datePublished: PUBLISHED_DATE }),
    // `mainEntity` y no `about`: estos servidores no son algo de lo que la
    // página habla, son su asunto. `about` decía exactamente lo mismo con la
    // afirmación más débil, así que sobraba: schema.org ya define mainEntity
    // como "the primary entity described in this page", que es el caso.
    // Siempre una REFERENCIA (`apiRefs`/`mainEntityRefs`), nunca el nodo
    // completo: el nodo entero solo se declara en la ficha de su servidor.
    // Omitted entirely (see `selectMainEntityRefs`) on pages that describe no
    // server at all — emitting it there claimed a primary entity the page
    // never renders.
    ...(mainEntityRefs && { mainEntity: mainEntityRefs }),
    // Los avisos son los pasajes concisos y autocontenidos de la página —
    // política del token, postura legal, límites — y sus `id` de DOM ya
    // existen (los pone ServerCard para poder enlazarlos). `speakable` los
    // señala como los pasajes que un asistente puede leer en voz alta o citar.
    // Solo existen en la portada, así que `speakable` también.
    //
    // These ids now sit on the <details>, which wraps the question in its
    // <summary> together with the answer. They used to sit on the inner notice
    // div — the answer alone — so a read-aloud produced "libgen is a client of
    // third-party public indexes…" with no question attached to it.
    ...(isHome && {
      speakable: {
        "@type": "SpeakableSpecification",
        cssSelector: servers.flatMap((server) =>
          server.notices.map((notice) => `#${server.id}-${notice.kind}`),
        ),
      },
    }),
  };

  // Los avisos de las fichas son literalmente preguntas con su respuesta
  // (política del token, postura legal, límites): marcarlos como FAQPage
  // formaliza esa estructura para quien extrae respuestas. Google ya no pinta
  // rich results de FAQ para sitios como este (restringido en 2023); el
  // destinatario son los asistentes, no la SERP. Sale de `servers.ts`, la
  // misma fuente que pinta los avisos: no puede desincronizarse del texto.
  // `url` and `name`: FAQPage is a subclass of WebPage, so without them the
  // graph described the same document as two WebPages, one of which could not
  // be tied to a URL at all. The `hasPart` on the WebPage node below is the
  // matching inverse — the FAQ used to be reachable upward from itself but not
  // downward from the page.
  // Only built for the home page: it is the only page with notice cards to
  // describe, and the `isHome` checks on `webpage` above already keep it
  // undiscoverable (no `hasPart`) from every other page's node.
  const faq = isHome
    ? {
        "@type": "FAQPage",
        "@id": `${url}#faq`,
        url,
        name: title,
        inLanguage: lang,
        isPartOf: ref(`${url}#webpage`),
        // The FAQ only ever renders on the home page (see `isHome` above),
        // where `targetServer` is always undefined — so this is always the
        // full `apiRefs` list, both servers, never `mainEntityRefs`.
        about: apiRefs,
        mainEntity: servers.flatMap((server) =>
          server.notices.map((notice) => ({
            "@type": "Question",
            name: notice.title[lang],
            acceptedAnswer: {
              "@type": "Answer",
              text: noticeAnswer(notice, lang),
            },
          })),
        ),
      }
    : null;

  const person = await loadPersonNode();

  const graph = [
    website,
    webpage,
    ...(faq ? [faq] : []),
    ...apis,
    ...sources,
    ...(person ? [person] : []),
  ];

  return {
    "@context": "https://schema.org",
    "@graph": graph,
  };
}

/**
 * La respuesta de un aviso como texto plano para `acceptedAnswer`.
 *
 * Párrafos y viñetas en orden — las viñetas son frases completas — y sin los
 * acentos graves del markup: en un literal de texto JSON-LD serían ruido.
 *
 * @param notice Aviso de `src/data/servers.ts`.
 * @param lang Idioma de la página.
 * @returns El texto de la respuesta, de una pieza.
 */
function noticeAnswer(notice: McpNotice, lang: Lang): string {
  const parts = [...notice.body, ...(notice.bullets ?? [])];
  return parts
    .map((part) => part[lang])
    .join(" ")
    .replaceAll("`", "");
}

/**
 * Serializa un objeto para incrustarlo en `<script type="application/ld+json">`.
 *
 * Escapa `<`, `>` y `&` para que ningún valor pueda cerrar la etiqueta ni
 * abrir otra, y los separadores de línea U+2028/U+2029, que son válidos en
 * JSON pero rompen el parseo en algunos consumidores. Todas las secuencias
 * emitidas son escapes `\uXXXX` legales, así que el resultado sigue siendo
 * JSON válido y `JSON.parse` lo recupera intacto.
 *
 * @param data Objeto a serializar.
 * @returns Cadena JSON segura para insertar tal cual en el HTML.
 */
export function safeJsonLd(data: unknown): string {
  const json = JSON.stringify(data);
  if (!json) return "null";
  return json
    .replaceAll("<", String.raw`\u003c`)
    .replaceAll(">", String.raw`\u003e`)
    .replaceAll("&", String.raw`\u0026`)
    .replaceAll("\u{2028}", String.raw`\u2028`)
    .replaceAll("\u{2029}", String.raw`\u2029`);
}
