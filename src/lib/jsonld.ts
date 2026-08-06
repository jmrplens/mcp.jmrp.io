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
import { loadPersonNode, PERSON_ID } from "./identity";
import { LANGS, pageUrl, SITE_NAME, SITE_ORIGIN } from "./seo";

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
    "@type": "WebAPI",
    "@id": `${server.endpoint}#api`,
    name: server.name,
    url: server.endpoint,
    description: localized(server.description),
    documentation: server.docs,
    sameAs: server.repo,
    serviceType: "Model Context Protocol server",
    provider: ref(PERSON_ID),
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
    about: apis.map((api) => ref(api["@id"])),
  };

  const person = await loadPersonNode();

  return {
    "@context": "https://schema.org",
    "@graph": person
      ? [website, webpage, ...apis, person]
      : [website, webpage, ...apis],
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
