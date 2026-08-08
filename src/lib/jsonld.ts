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
import { servers } from "../data/servers";
import type { Lang } from "../i18n/ui";
import { ui } from "../i18n/ui";
import { contentDate } from "./build-date";
import { loadPersonNode, PERSON_ID } from "./identity";
import { LANGS, pageUrl, SITE_NAME, SITE_ORIGIN } from "./seo";

// Ver build-date.ts: HEAD si el árbol está limpio, ahora si está sucio. El
// fallback a la hora actual solo aplica sin git, y ahí es lo único que queda.
const BUILD_DATE = contentDate() ?? new Date().toISOString();

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
    // eslint-disable-next-line sonarjs/no-clear-text-protocols, unicorn/prefer-https -- No es un enlace: es el IRI de CONCEPTO canónico de Wikidata, que usa http:// por definición (la web sirve https, el identificador no cambia). Con https sería un recurso RDF distinto del que ya usan knowsAbout y jmrp.io — de hecho eslint --fix lo "corrigió" en silencio y partió la entidad en dos.
    additionalType: "http://www.wikidata.org/entity/Q133436854",
    applicationCategory: "DeveloperApplication",
    operatingSystem: "Any (HTTP)",
    // La misma IRI de licencia que usa jmrp.io/projects, no la de SPDX: en RDF
    // son recursos distintos, y las entidades de este dominio deben contar la
    // misma historia que las del canónico.
    license: "https://opensource.org/licenses/MIT",
    isAccessibleForFree: true,
    dateModified: BUILD_DATE,
    // Qué sabe hacer, sin ejecutar el endpoint: es la pregunta que un agente
    // hace sobre un servidor MCP, y hasta ahora solo la respondía `tools/list`
    // en vivo.
    featureList: server.tools.map((tool) => tool.name),
    offers: {
      "@type": "Offer",
      price: "0",
      priceCurrency: "USD",
      availability: "https://schema.org/InStock",
    },
    provider: ref(PERSON_ID),
    // Camino de vuelta al código: `targetProduct` no tiene inversa en
    // schema.org, así que sin esto quien entra por `mainEntity` nunca llega
    // al repositorio.
    isBasedOn: ref(`${server.repo}#sourcecode`),
    softwareHelp: ref(server.docsSite ?? server.docs),
    // Fichas de directorios MCP que describen ESTE servidor (no el repo: el
    // repo se enlaza vía isBasedOn → codeRepository). Si no hay, el undefined
    // desaparece solo al serializar.
    sameAs: server.sameAs,
    // Cómo se llama de verdad: POST con JSON-RPC, no un GET a la URL. Un
    // rastreador que siga `url` recibe un 405, que es correcto por diseño.
    potentialAction: {
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
  }));

  // El nodo de código fuente une el endpoint con su repositorio — la
  // evidencia que respalda "¿me puedo fiar de esto?".
  //
  // `@id` = `#sourcecode`, NUNCA `#software`: ese IRI ya lo define
  // jmrp.io/projects como SoftwareApplication con otro nombre y otra licencia,
  // y describir el mismo `@id` con datos contradictorios desde dos páginas
  // hace que la entidad fusionada se contradiga a sí misma (regresión que
  // llegó a estar publicada). El puente al nodo canónico es una REFERENCIA en
  // `targetProduct` — apuntar sin redefinir es exactamente como debe funcionar
  // linked data, igual que los `owns` del documento de identidad.
  const sources = servers.map((server) => ({
    "@type": "SoftwareSourceCode",
    "@id": `${server.repo}#sourcecode`,
    name: server.repo.split("/").pop(),
    codeRepository: server.repo,
    programmingLanguage: "Go",
    runtimePlatform: "Go",
    license: "https://opensource.org/licenses/MIT",
    author: ref(PERSON_ID),
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
    author: ref(PERSON_ID),
    publisher: ref(PERSON_ID),
    dateModified: BUILD_DATE,
    // `mainEntity` y no solo `about`: estos servidores no son algo de lo que
    // la página habla, son su asunto.
    mainEntity: apis.map((api) => ref(api["@id"])),
    about: apis.map((api) => ref(api["@id"])),
  };

  const person = await loadPersonNode();

  return {
    "@context": "https://schema.org",
    "@graph": person
      ? [website, webpage, ...apis, ...sources, person]
      : [website, webpage, ...apis, ...sources],
  };
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
