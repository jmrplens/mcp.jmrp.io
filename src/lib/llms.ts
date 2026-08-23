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
import type { McpHeader, McpServer } from "../data/servers";
import { servers } from "../data/servers";
import type { Lang } from "../i18n/config";
import { ui } from "../i18n/ui";
import { internals } from "../i18n/ui/internals";
import {
  claudeCodeCommand,
  cursorJson,
  vscodeJson,
} from "../lib/client-config";
import { LANGS, type PageId, pageUrl, SITE_NAME, SITE_ORIGIN } from "../lib/seo";

/** Nombre humano de cada idioma, para los enlaces del índice. */
const LANG_NAMES: Record<string, string> = { en: "English", es: "Spanish" };

/**
 * Title and one-line description of one page, in one language.
 *
 * `internals` bypasses the merged `ui` object on purpose — see the header
 * comment on `src/i18n/ui.ts` for why — so its title and lede are read from
 * `internals[lang]` directly, exactly like `InternalsPage.astro` does.
 *
 * @param lang Language of the strings.
 * @returns One entry per page, in `PAGE_PATHS` order.
 */
function pageEntries(
  lang: Lang,
): { page: PageId; title: string; description: string }[] {
  return [
    { page: "home", title: ui[lang].title, description: ui[lang].subtitle },
    {
      page: "inspector",
      title: ui[lang].inspectorEyebrow,
      description: ui[lang].inspectorIntro,
    },
    {
      page: "internals",
      title: internals[lang].title,
      description: internals[lang].lede,
    },
    {
      page: "policies",
      title: ui[lang].footerPolicies,
      description: ui[lang].policiesIntro,
    },
  ];
}

/**
 * Índice corto: qué es esto, dónde está cada cosa.
 *
 * @returns El cuerpo de `/llms.txt`.
 */
export function buildLlmsTxt(): string {
  // Four pages × two languages: every page an assistant can land on gets its
  // own line, not just the home page. Grouped by language rather than by
  // page, same as before this task — adding a page only means growing
  // `pageEntries`, never touching this loop.
  const pages = LANGS.flatMap((lang) =>
    pageEntries(lang).map(
      ({ page, title, description }) =>
        `- [${title} (${LANG_NAMES[lang] ?? lang})](${pageUrl(lang, page)}): ${description}`,
    ),
  ).join("\n");

  const list = servers
    .map(
      (server) =>
        `- [${server.name}](${server.endpoint}): ${server.description.en}`,
    )
    .join("\n");

  return `# ${SITE_NAME}

> ${ui.en.lede}

Every server speaks the Model Context Protocol over streamable HTTP: a single
POST endpoint that takes a JSON-RPC 2.0 request and answers with either
\`application/json\` or an \`text/event-stream\` (SSE) frame. They run stateless,
so each POST is self-contained and no session header is needed. Point an MCP
client at the endpoint, or try the servers from the browser with the inspector
on the site.

## MCP servers

${list}

## Pages

${pages}

## Machine-readable

- [/servers.json](${SITE_ORIGIN}/servers.json): endpoint index as JSON.
- [/llms-full.txt](${SITE_ORIGIN}/llms-full.txt): required headers, example calls and the credential policy of every server.
- [/sitemap-index.xml](${SITE_ORIGIN}/sitemap-index.xml): sitemap.

## Optional

- [jmrp.io](https://jmrp.io/): the author's site, which publishes the canonical identity document these servers are attributed to.
`;
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

  // Built here rather than inline in the template below: nesting a template
  // literal inside another trips sonarjs/no-nested-template-literals, and the
  // same reason `headerBlock` exists.
  const promptLines = (server.prompts ?? [])
    .map((prompt) => `- \`${prompt.name}\` — ${prompt.what.en}`)
    .join("\n");
  const promptBlock = promptLines
    ? `\n\nPrompts — canned plans a client can render, beyond the tools above:\n\n${promptLines}`
    : "";

  return `## ${server.name}

${server.description.en}

- Endpoint: \`${server.endpoint}\` (POST only; GET answers 405)
- Transport: streamable HTTP, stateless JSON-RPC 2.0
- Repository: ${server.repo}
- Documentation: ${server.docsSite ?? server.docs}
- Health: \`${server.endpoint}/health\` (GET, no credentials)${auth}${headerBlock(server.requiredHeaders, "Required")}${headerBlock(server.optionalHeaders, "Optional")}

Tools:

${server.tools.map((tool) => `- \`${tool.name}\` — ${tool.what.en}`).join("\n")}${promptBlock}

Verify the live list with:

\`\`\`http
POST ${server.endpoint}
Content-Type: application/json
Accept: application/json, text/event-stream
${server.requiredHeaders.map((h) => `${h.name}: <your value>`).join("\n")}

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
Treat any site that asks for a token with suspicion, this one included: a token
scoped to the minimum (\`read_api\` is enough), short-lived and revoked right
after, is the sane way to try the inspector.
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
- GET answers 405 by design.

${sections}${credentials}`;
}
