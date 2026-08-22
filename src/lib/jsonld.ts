/**
 * Grafo JSON-LD del sitio.
 *
 * Emite un único `@graph` por página con cuatro clases de nodo:
 *
 *   - `WebSite`  — el sitio entero, una sola vez para las dos versiones.
 *   - `WebPage`  — la página concreta (un `@id` por idioma).
 *   - `WebAPI`   — uno por cada servidor de `src/data/servers.ts`.
 *   - `Person`   — el nodo canónico de jmrp.io, empalmado tal cual.
 *
 * Todos los nodos propios apuntan a la persona por `@id`
 * (`publisher`/`author`/`provider`), nunca redeclarando sus datos: el
 * documento de identidad es la única fuente de verdad de quién es el autor, y
 * duplicarlo aquí garantizaría que las dos copias se desincronizaran.
 *
 * El documento `person.jsonld` NO se publica en este dominio: el vhost sirve
 * por lista blanca de `location =` y añadir una entrada exigiría editar
 * /etc/nginx a mano. Su URL dereferenciable sigue siendo la de jmrp.io.
 */
import type { McpNotice } from "../data/servers";
import { servers } from "../data/servers";
import type { Lang } from "../i18n/ui";
import { ui } from "../i18n/ui";
import { contentDate, publishedDate } from "./build-date";
import { loadPersonNode, PERSON_ID } from "./identity";
import {
  LANGS,
  OG_IMAGE_SIZE,
  ogImageUrl,
  pageUrl,
  SITE_NAME,
  SITE_ORIGIN,
} from "./seo";

// Ver build-date.ts: HEAD si el árbol está limpio, ahora si está sucio. El
// fallback a la hora actual solo aplica sin git, y ahí es lo único que queda.
const BUILD_DATE = contentDate() ?? new Date().toISOString();

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

/** Datos de la página que el grafo necesita del layout. */
export interface PageMeta {
  lang: Lang;
  title: string;
  description: string;
}

/**
 * Construye el grafo JSON-LD completo de una página.
 *
 * @param page Idioma, título y descripción de la página que se está pintando.
 * @returns Objeto listo para serializar con {@link safeJsonLd}.
 */
export async function buildSiteGraph(
  page: PageMeta,
): Promise<Record<string, unknown>> {
  const { lang, title, description } = page;
  const url = pageUrl(lang);

  // Un WebAPI por servidor. `provider` cierra el par recíproco con el `owns`
  // del documento de identidad, que ya declara los `#software` de estos dos
  // repos; `sameAs` lleva al repositorio, que es el sujeto de aquellos nodos.
  const apis = servers.map((server) => ({
    // Multi-tipado a propósito: `WebAPI` cuelga de `Intangible`, así que por sí
    // solo deja fuera `license`, `dateModified` e `isAccessibleForFree` — que
    // son justo los hechos que deciden si un asistente recomienda un endpoint.
    // Añadir `SoftwareApplication` (rama `CreativeWork`) los habilita sin
    // renunciar a la semántica precisa de "esto es una API".
    "@type": ["WebAPI", "SoftwareApplication"],
    "@id": `${server.endpoint}#api`,
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
    isBasedOn: ref(`${server.repo}#source-code`),
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
  }));

  // The source-code node ties an endpoint to the repository that produces it —
  // the evidence behind "can I trust this?".
  //
  // `@id` = `#source-code`, NEVER `#software`: that IRI is already defined by
  // jmrp.io/projects as a SoftwareApplication with a different name and
  // licence, and describing one `@id` with contradictory data from two pages
  // makes the merged entity contradict itself (a regression that did reach
  // production). The bridge to the canonical node is a REFERENCE in
  // `targetProduct` — pointing without redefining is how linked data is meant
  // to work, same as the `owns` list of the identity document.
  //
  // The hyphen is not cosmetic. This node used to be `#sourcecode`, and both
  // documentation sites (jmrplens.github.io/{gitlab-mcp-server,libgen-mcp})
  // define `#source-code` for the SAME `codeRepository` — so one repository
  // had two IRIs across the estate, splitting its signals and disagreeing on
  // `name` and `runtimePlatform`. Aligning on the hyphenated form follows the
  // estate's own convention (jmrp.io writes `#person`, `#software`, `#api` for
  // single words and `#project-list` for compounds) and puts the majority of
  // the ecosystem on one identifier.
  //
  // And it is deliberately a STUB: the documentation sites are the home of
  // this entity and carry `name`, `creator`, `maintainer`, `isPartOf` and the
  // real `runtimePlatform` (the OS list — the old `runtimePlatform: "Go"` here
  // was wrong anyway, since `programmingLanguage` already says Go). What this
  // page has to add, and nobody else can, is which hosted endpoint that code
  // powers.
  const sources = servers.map((server) => ({
    "@type": "SoftwareSourceCode",
    "@id": `${server.repo}#source-code`,
    codeRepository: server.repo,
    targetProduct: [
      ref(`${server.endpoint}#api`),
      ref(`${server.repo}#software`),
    ],
  }));

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
    // The FAQ is part of this page. Without it the link ran one way only:
    // #faq declared its `isPartOf`, but nothing led from the page down to it.
    hasPart: ref(`${url}#faq`),
    // hreflang already says these two pages are translations of each other;
    // the graph did not. Same pairing jmrp.io/about/#profile already emits.
    ...(lang === "en"
      ? { workTranslation: ref(`${pageUrl("es")}#webpage`) }
      : { translationOfWork: ref(`${pageUrl("en")}#webpage`) }),
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
    mainEntity: apis.map((api) => ref(api["@id"])),
    // Los avisos son los pasajes concisos y autocontenidos de la página —
    // política del token, postura legal, límites — y sus `id` de DOM ya
    // existen (los pone ServerCard para poder enlazarlos). `speakable` los
    // señala como los pasajes que un asistente puede leer en voz alta o citar.
    //
    // These ids now sit on the <details>, which wraps the question in its
    // <summary> together with the answer. They used to sit on the inner notice
    // div — the answer alone — so a read-aloud produced "libgen is a client of
    // third-party public indexes…" with no question attached to it.
    speakable: {
      "@type": "SpeakableSpecification",
      cssSelector: servers.flatMap((server) =>
        server.notices.map((notice) => `#${server.id}-${notice.kind}`),
      ),
    },
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
  const faq = {
    "@type": "FAQPage",
    "@id": `${url}#faq`,
    url,
    name: title,
    inLanguage: lang,
    isPartOf: ref(`${url}#webpage`),
    about: apis.map((api) => ref(api["@id"])),
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
  };

  const person = await loadPersonNode();

  return {
    "@context": "https://schema.org",
    "@graph": person
      ? [website, webpage, faq, ...apis, ...sources, person]
      : [website, webpage, faq, ...apis, ...sources],
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
