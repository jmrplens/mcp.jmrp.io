/**
 * Generación de `/llms.txt` y `/llms-full.txt` (estándar llmstxt.org).
 *
 * El sitio hermano jmrp.io ya publica los suyos, así que un motor generativo
 * que resuelva la marca recibía un índice curado para jmrp.io y NADA para el
 * dominio donde viven de verdad los endpoints MCP. Estos dos ficheros cierran
 * ese hueco.
 *
 * Se generan a partir de `src/data/servers.ts` y `src/i18n/ui.ts`, las mismas
 * fuentes que pintan las tarjetas: un MCP nuevo entra en la web, en el JSON-LD,
 * en `/servers.json`, en la tarjeta social y aquí de una sola vez. Duplicar
 * este texto a mano sería garantizar que se quedara viejo.
 *
 * Están en inglés (el `llms.txt` es un documento para máquinas, y el inglés es
 * lo que espera la herramienta que lo consuma), pero enlazan y nombran la
 * versión española del sitio.
 */
import type { ServerCardSummary } from "../data/server-cards";
import {
  serverCardDocuments,
  serverCards,
  SUBSCRIBABLE_META_KEY,
} from "../data/server-cards";
import type { McpHeader, McpServer } from "../data/servers";
import { servers } from "../data/servers";
import type { GitlabActionsSnapshot } from "../data/surface";
import { getGitlabActions } from "../data/surface";
import type { Lang } from "../i18n/config";
import { ui } from "../i18n/ui";
import { internals } from "../i18n/ui/internals";
import { serversPage } from "../i18n/ui/servers-page";
import {
  claudeCodeCommand,
  cursorJson,
  vscodeJson,
} from "../lib/client-config";
import { DEFAULT_LANG, LANGS, pageUrl, serverPageUrl, SITE_NAME, SITE_ORIGIN } from "../lib/seo";

/** Nombre humano de cada idioma, para los enlaces del índice. */
const LANG_NAMES: Record<string, string> = { en: "English", es: "Spanish" };

/**
 * Catálogos de acciones dinámicas con snapshot committeado en
 * `src/data/surface/` (hoy solo gitlab) — la misma fuente que emite
 * `/servers.json` y el índice `/servers/<id>/actions.json`, para que las
 * tres superficies citen la misma cifra.
 */
const actionCatalogs: Record<string, GitlabActionsSnapshot | undefined> = {
  gitlab: getGitlabActions(),
};

/**
 * Title and one-line description of one page, in one language.
 *
 * Returns each entry's own absolute URL rather than a `PageId`: the two
 * server detail pages (`/servers/<id>/`) have no fixed `PageId` of their
 * own — see the comment on `PAGE_PATHS` in `src/lib/seo.ts` for why — so
 * `pageUrl` alone cannot address them. Fixed pages resolve theirs via
 * `pageUrl`, server pages via `serverPageUrl`.
 *
 * `internals` bypasses the merged `ui` object on purpose — see the header
 * comment on `src/i18n/ui.ts` for why — so its title and lede are read from
 * `internals[lang]` directly, exactly like `InternalsPage.astro` does.
 *
 * @param lang Language of the strings.
 * @returns One entry per page: the fixed pages in `PAGE_PATHS` order, then
 *   one per MCP server with a committed Server Card.
 */
function pageEntries(
  lang: Lang,
): { url: string; title: string; description: string }[] {
  const fixed = [
    { url: pageUrl(lang, "home"), title: ui[lang].title, description: ui[lang].subtitle },
    {
      url: pageUrl(lang, "inspector"),
      title: ui[lang].inspectorTitle,
      description: ui[lang].inspectorIntro,
    },
    {
      url: pageUrl(lang, "internals"),
      title: internals[lang].title,
      description: internals[lang].lede,
    },
    {
      url: pageUrl(lang, "policies"),
      title: ui[lang].policiesTitle,
      description: ui[lang].policiesIntro,
    },
    {
      url: pageUrl(lang, "servers"),
      title: serversPage[lang].titleIndex,
      description: serversPage[lang].ledeIndex,
    },
  ];

  // One entry per MCP server with a committed Server Card — the same set
  // `getStaticPaths` in `src/pages/servers/[server].astro` builds pages
  // for. `serverCards[server.id]` is checked rather than assumed present:
  // a server can be listed in `src/data/servers.ts` before its Server Card
  // snapshot lands (see the "ADDING A THIRD MCP" note on
  // `src/data/server-cards.ts`), and this file should not crash the build
  // over that gap. The title carries the Server Card's OWN identity
  // (`serverInfo.name` and version, e.g. "gitlab-mcp-server v2.6.6") next to
  // the site's short server id, since that identity is what a client
  // matches against the live `initialize` response; the description reuses
  // the same bilingual copy as the "MCP servers" section below.
  const serverEntries = servers
    .filter((server) => serverCards[server.id])
    .map((server) => {
      const card = serverCards[server.id];
      return {
        url: serverPageUrl(lang, server.id),
        title: `${server.name} — ${card.serverInfo.name} v${card.serverInfo.version}`,
        description: server.description[lang],
      };
    });

  return [...fixed, ...serverEntries];
}

/**
 * Índice corto: qué es esto, dónde está cada cosa.
 *
 * @returns El cuerpo de `/llms.txt`.
 */
export function buildLlmsTxt(): string {
  // Seven page groups × two languages: every page an assistant can land on
  // gets its own line, not just the home page — the `/servers/` index and
  // every server's own detail page included. Grouped by language rather
  // than by page, same as before this task — adding a page only means
  // growing `pageEntries`, never touching this loop.
  const pages = LANGS.flatMap((lang) =>
    pageEntries(lang).map(
      ({ url, title, description }) =>
        `- [${title} (${LANG_NAMES[lang] ?? lang})](${url}): ${description}`,
    ),
  ).join("\n");

  // The link target is the JSON-RPC endpoint, not a page: a GET on it is
  // rejected (405 on libgen, 401 on gitlab), so an agent walking this section
  // — the first one in the file — collects one error per server before
  // reading anything. The label goes in the
  // description half of the item, which is free text inside llmstxt.org's
  // `- [name](url): description` shape, so the file still parses as a link
  // list; a bare prose line under the H2 would not, since an H2 section is a
  // file list. The endpoint stays the target because it is what identifies the
  // server (`/servers.json` keys on it, and `tests/unit/seo-artifacts.test.mjs`
  // asserts it appears verbatim here). The detail page closes the gap the label
  // only warns about: it answers 200 and carries the Server Card, so the agent
  // has somewhere to go from the same line.
  const list = servers
    .map(
      (server) =>
        `- [${server.name}](${server.endpoint}): POST-only MCP endpoint; GET answers ${server.getStatus}. ${server.description.en} Readable page: ${serverPageUrl(DEFAULT_LANG, server.id)}`,
    )
    .join("\n");

  // Una línea por servidor con catálogo de acciones committeado, generada
  // del mismo snapshot que `/servers.json` y el propio índice: un tercer MCP
  // con catálogo entra aquí solo, sin tocar la plantilla de abajo. El matiz
  // "Free-tier" viaja SIEMPRE junto al recuento: el manifiesto se lee con
  // `cacheScope: "private"`, así que la cifra es la superficie de ese token,
  // no la universal.
  const catalogLines = servers
    .flatMap((server) => {
      const catalog = actionCatalogs[server.id];
      if (!catalog) return [];
      const path = `/servers/${server.id}/actions.json`;
      return [
        `\n- [${path}](${SITE_ORIGIN}${path}): ${server.id}'s action catalog index — ${catalog.meta.actionCount} actions counted with a Free-tier token (tier and token permissions both move the count).`,
      ];
    })
    .join("");

  return `# ${SITE_NAME}

> ${ui.en.lede}

Every server speaks the Model Context Protocol over streamable HTTP: a single
POST endpoint that takes a JSON-RPC 2.0 request and answers with either
\`application/json\` or a \`text/event-stream\` (SSE) frame. They run stateless,
so each POST is self-contained and no session header is needed. A GET on one never
answers with a page — libgen rejects the method with 405, gitlab checks
credentials first and answers 401 — because the links under "MCP servers"
below are call targets, not pages. Point an MCP client at the endpoint, or try the servers from the
browser with the inspector on the site.

## MCP servers

${list}

## Pages

${pages}

## Machine-readable

- [/servers.json](${SITE_ORIGIN}/servers.json): endpoint index as JSON.${catalogLines}
- [/llms-full.txt](${SITE_ORIGIN}/llms-full.txt): required headers, example calls and the credential policy of every server.
- [/sitemap-index.xml](${SITE_ORIGIN}/sitemap-index.xml): sitemap.

## Optional

- [jmrp.io](https://jmrp.io/): the author's site, which publishes the canonical identity document that attributes these servers to him.
`;
}

/**
 * Renders the credential headers of the HTTP example, if the server takes any.
 *
 * @param server The server the example belongs to.
 * @returns A leading newline plus one line per header, or an empty string.
 */
function exampleHeaders(server: McpServer): string {
  if (server.requiredHeaders.length === 0) return "";
  return (
    "\n" +
    server.requiredHeaders
      .map((h) => `${h.name}: ${h.valuePrefix ?? ""}<your token>`)
      .join("\n")
  );
}

/**
 * Renderiza una lista de cabeceras, marcando cuáles llevan credencial.
 *
 * @param headers Cabeceras declaradas en `src/data/servers.ts`.
 * @param kind Rótulo del bloque (`Required` u `Optional`).
 * @returns Las líneas del bloque, o cadena vacía si no hay ninguna.
 */
function headerBlock(headers: McpHeader[], kind: string): string {
  if (headers.length === 0) return "";
  const lines = headers
    .map((header) => {
      const secret = header.secret ? " (credential — never store it)" : "";
      return `  - \`${header.name}\`${secret}: ${header.description.en}`;
    })
    .join("\n");
  return `\n- ${kind} headers:\n${lines}`;
}

/**
 * Renderiza un bloque de capacidades: prompts, recursos o plantillas.
 *
 * Existe por el mismo motivo que `headerBlock`: montar estas listas dentro de
 * la plantilla de `serverSection` anidaría una template literal en otra, que
 * es lo que sonarjs/no-nested-template-literals prohíbe en `src/lib`.
 *
 * @param lead Frase que encabeza el bloque.
 * @param entries Clave con la que se invoca cada entrada, y su propósito.
 * @returns El bloque en Markdown, o cadena vacía si no hay entradas.
 */
function capabilityBlock(
  lead: string,
  entries: { key: string; what: string }[],
): string {
  if (entries.length === 0) return "";
  const lines = entries
    .map((entry) => `- \`${entry.key}\` — ${entry.what}`)
    .join("\n");
  return `\n\n${lead}\n\n${lines}`;
}

/**
 * Renderiza el bloque de suscripciones de un servidor, si su card declara el
 * contrato (`subscriptions`).
 *
 * La disponibilidad de cada método se genera de `card.subscriptions.methods`
 * y el recuento de plantillas suscribibles sale del flag `subscribable` que
 * server-cards.ts cura desde `_meta` — el `_meta` crudo no sale de la capa de
 * datos, así que nada de este bloque puede desviarse del snapshot committeado
 * ni de las demás superficies que leen el mismo flag. El texto emitido sí
 * nombra la clave `_meta` original: es la que un cliente MCP verá en
 * `resources/templates/list`.
 *
 * @param card Resumen curado del card, si existe.
 * @returns El bloque en Markdown, o cadena vacía si no hay contrato.
 */
function subscriptionsBlock(card: ServerCardSummary | undefined): string {
  if (!card?.subscriptions) return "";
  const lines = Object.entries(card.subscriptions.methods).map(
    ([method, info]) => {
      const since = info.since_protocol
        ? ` (since protocol ${info.since_protocol})`
        : "";
      const requires = info.requires ? `: requires ${info.requires}` : "";
      const status = info.available
        ? `available${since}`
        : `not available here${requires}`;
      return `- \`${method}\` — ${status}`;
    },
  );
  const count = card.resourceTemplates.filter(
    (template) => template.subscribable,
  ).length;
  lines.push(
    `- ${count} of the resource templates above are subscribable — the ones whose \`resources/templates/list\` entry carries \`_meta["${SUBSCRIBABLE_META_KEY}"]: true\`.`,
  );
  return `\n\nSubscriptions — watch a resource and be notified when it changes:\n\n${lines.join("\n")}`;
}

/**
 * Renderiza el bloque del catálogo de acciones de un servidor, si tiene
 * snapshot committeado en `src/data/surface/`.
 *
 * Las cifras, los dominios de ejemplo y la URI de origen salen del snapshot,
 * nunca de literales; el matiz "Free-tier" viaja SIEMPRE junto al recuento
 * (mismo motivo que en `buildLlmsTxt`: `cacheScope: "private"`).
 *
 * @param serverId Id del servidor en `src/data/servers.ts`.
 * @returns El bloque en Markdown, o cadena vacía si no hay catálogo.
 */
function actionCatalogBlock(serverId: string): string {
  const catalog = actionCatalogs[serverId];
  if (!catalog) return "";
  const top = [...catalog.domains]
    .sort((a, b) => b.count - a.count)
    .slice(0, 4)
    .map((domain) => domain.domain)
    .join(", ");
  const source = `\`${catalog.meta.resourceUri}\``;
  return `\n\nAction catalog — the tools above front a catalog of ${catalog.meta.actionCount} actions across ${catalog.domains.length} domains (${top}, …), counted with a Free-tier token — tier and token permissions both move the count. Browse the index at ${SITE_ORIGIN}/servers/${serverId}/actions.json, or read ${source} with \`resources/read\`.`;
}

/**
 * Ficha completa de un servidor: cómo se llama, qué pide y cómo se invoca.
 *
 * @param server Servidor de `src/data/servers.ts`.
 * @returns La sección en Markdown.
 */
function serverSection(server: McpServer): string {
  const auth =
    server.requiredHeaders.length === 0
      ? "\n- Authentication: none. The server is public and takes no credentials."
      : "";

  // El card committeado es la fuente de reserva de los tres bloques de abajo.
  // `servers.ts` solo lleva copia escrita a mano, y para los 37 prompts de
  // gitlab no la hay: ese campo ausente significa "nadie ha escrito esa copia",
  // no "este servidor no tiene prompts" —leerlo del segundo modo es lo que los
  // dejó fuera de esta superficie—. El card lo refresca
  // `scripts/sync-server-cards.sh` en cada release, así que lo que se emite no
  // puede desviarse de lo que responde el servidor. Se comprueba en vez de
  // indexar a secas: un servidor puede estar dado de alta antes de que aterrice
  // su snapshot (mismo motivo que el filtro de `pageEntries`).
  const card = serverCardDocuments[server.id];

  // `servers.ts` manda donde tiene copia propia —los cuatro prompts de libgen
  // están traducidos a mano—; el card cubre el resto.
  const prompts = server.prompts?.length
    ? server.prompts.map((prompt) => ({
        key: prompt.name,
        what: prompt.what.en,
      }))
    : (card?.prompts ?? []).map((prompt) => ({
        key: prompt.name,
        what: prompt.description,
      }));

  // Recursos y plantillas se listan por URI, no por nombre: es la diferencia
  // con una herramienta, que `resources/read` direcciona por URI y el nombre a
  // solas no deja al cliente nada que llamar.
  const resources = (card?.resources ?? []).map((resource) => ({
    key: resource.uri,
    what: resource.description,
  }));
  const templates = (card?.resourceTemplates ?? []).map((template) => ({
    key: template.uriTemplate,
    what: template.description,
  }));

  const promptBlock = capabilityBlock(
    "Prompts — canned plans a client can render, beyond the tools above:",
    prompts,
  );
  const resourceBlock = capabilityBlock(
    "Resources — documents the server serves by URI, read with `resources/read`:",
    resources,
  );
  const templateBlock = capabilityBlock(
    "Resource templates — the same, parameterized; fill the `{…}` slots before reading:",
    templates,
  );

  return `## ${server.name}

${server.description.en}

- Endpoint: \`${server.endpoint}\` (POST only; GET answers ${server.getStatus})
- Transport: streamable HTTP, stateless JSON-RPC 2.0
- Repository: ${server.repo}
- Documentation: ${server.docsSite ?? server.docs}
- Health: \`${server.endpoint}/health\` (GET, no credentials)${auth}${headerBlock(server.requiredHeaders, "Required")}${headerBlock(server.optionalHeaders, "Optional")}

Tools:

${server.tools.map((tool) => `- \`${tool.name}\` — ${tool.what.en}`).join("\n")}${promptBlock}${resourceBlock}${templateBlock}${subscriptionsBlock(serverCards[server.id])}${actionCatalogBlock(server.id)}

Verify the live list with:

\`\`\`http
POST ${server.endpoint}
Content-Type: application/json
Accept: application/json, text/event-stream${exampleHeaders(server)}

{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}
\`\`\`

Use it in a client — mind the top-level key: Cursor reads \`mcpServers\` with
no \`type\` field, VS Code reads \`servers\` with \`type: "http"\`.

Claude Code:

\`\`\`sh
${claudeCodeCommand(server)}
\`\`\`

Cursor (\`~/.cursor/mcp.json\`):

\`\`\`json
${cursorJson(server)}
\`\`\`

VS Code (\`.vscode/mcp.json\`):

\`\`\`json
${vscodeJson(server, "en")}
\`\`\`
`;
}

/**
 * Documento largo: cuanto hace falta para llamar a los servidores.
 *
 * @returns El cuerpo de `/llms-full.txt`.
 */
export function buildLlmsFullTxt(): string {
  const sections = servers.map((server) => serverSection(server)).join("\n");
  const secretHeaders = servers
    .flatMap((server) => server.requiredHeaders)
    .filter((header) => header.secret);

  const credentials =
    secretHeaders.length === 0
      ? ""
      : `
## Credential policy

${secretHeaders.map((h) => `\`${h.name}\``).join(", ")} travels in the request that needs it and is
never stored: not by the server, which uses it for that single call and forgets
it, and not by the web inspector, which keeps it in the tab's memory only — no
localStorage, no cookies, no query string, no logs. Reloading the page drops it.

For \`gitlab\` that credential is \`Authorization: Bearer <token>\`, and either
kind works: an OAuth access token obtained from gitlab.com, or a personal
access token sent the same way. An unauthenticated call answers \`401\` with a
\`WWW-Authenticate\` challenge naming
\`${SITE_ORIGIN}/.well-known/oauth-protected-resource/gitlab\`, the RFC 9728
document that says which authorization server issues tokens for this endpoint.

Treat any site that asks for a token with suspicion, this one included. The two
paths differ in what they can ask for: a personal access token scoped to
\`read_api\`, short-lived and revoked right after, is the sane way to try the
inspector; the OAuth application asks for \`api\`, because the same server also
writes, and that scope is fixed by the application rather than chosen per user.
`;

  return `# ${SITE_NAME}

> ${ui.en.lede}

This file is the long form of ${SITE_ORIGIN}/llms.txt: one section per server
with its endpoint, headers and an example call, plus the credential policy.
Both language versions of the site (${LANGS.map((lang) => pageUrl(lang)).join(", ")}) describe exactly the same
servers; only the prose is translated.

## Protocol

All servers speak the Model Context Protocol over streamable HTTP:

- One POST endpoint per server, JSON-RPC 2.0 in the body.
- \`Accept: application/json, text/event-stream\` — answers may come back as a
  single JSON object or as an SSE frame whose last \`data:\` line carries it.
- Stateless: no \`Mcp-Session-Id\`, every POST is self-contained.
- A GET never returns a page: libgen answers 405, gitlab answers 401.

${sections}${credentials}`;
}
