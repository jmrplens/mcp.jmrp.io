/**
 * Generates `/llms.txt` and `/llms-full.txt` (the llmstxt.org standard).
 *
 * The sibling site jmrp.io already publishes its own, so a generative engine
 * resolving the brand got a curated index for jmrp.io and NOTHING for the
 * domain where the MCP endpoints actually live. These two files close that
 * gap.
 *
 * They are generated from `src/data/servers.ts` and `src/i18n/ui.ts`, the same
 * sources that render the cards: a new MCP enters the site, the JSON-LD,
 * `/servers.json`, the social card and this, all in one go. Duplicating this
 * text by hand would guarantee it went stale.
 *
 * They are in English (an `llms.txt` is a document for machines, and English
 * is what the tool consuming it expects), but they link to and name the
 * site's Spanish version.
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
import {
  DEFAULT_LANG,
  LANGS,
  pageUrl,
  serverPageUrl,
  SITE_NAME,
  SITE_ORIGIN,
} from "../lib/seo";

/** Each language's human name, for the index's links. */
const LANG_NAMES: Record<string, string> = { en: "English", es: "Spanish" };

/**
 * Dynamic action catalogs with a committed snapshot in `src/data/surface/`
 * (today only gitlab) — the same source `/servers.json` and the
 * `/servers/<id>/actions.json` index emit from, so all three surfaces quote
 * the same figure.
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
    {
      url: pageUrl(lang, "home"),
      title: ui[lang].title,
      description: ui[lang].subtitle,
    },
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
      url: pageUrl(lang, "license"),
      title: ui[lang].licenseTitle,
      description: ui[lang].licenseIntro,
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
 * The short index: what this is, and where each thing lives.
 *
 * @returns `/llms.txt`'s body.
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

  // One line per server with a committed action catalog, generated from the
  // same snapshot as `/servers.json` and the index itself: a third MCP with a
  // catalog gets in on its own, without touching the template below. The
  // "Free-tier" qualifier ALWAYS travels with the count: the manifest is read
  // with `cacheScope: "private"`, so the figure is that token's surface, not
  // the universal one.
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

Reuse: the site's text — the pages, their markdown twins and this file — is licensed CC BY 4.0 (https://creativecommons.org/licenses/by/4.0/): reuse it, including commercially, crediting "José Manuel Requena Plens" and noting any change. The site's code and both servers are MIT. The machine-readable files (/servers.json, /servers/gitlab/actions.json, the connection cards at /<id>/server-card and the documents under /.well-known/) carry no condition; the catalogue each server publishes at /<id>/.well-known/mcp/server-card.json is that server's MIT text. What the servers return is not licensed here. Full terms: ${pageUrl(DEFAULT_LANG, "license")}

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
 * Renders a header list, marking which ones carry a credential.
 *
 * @param headers Headers declared in `src/data/servers.ts`.
 * @param kind The block's label (`Required` or `Optional`).
 * @returns The block's lines, or an empty string when there are none.
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
 * Renders a capability block: prompts, resources or templates.
 *
 * It exists for the same reason as `headerBlock`: building these lists inside
 * `serverSection`'s template would nest one template literal in another, which
 * is what sonarjs/no-nested-template-literals forbids in `src/lib`.
 *
 * @param lead The sentence heading the block.
 * @param entries The key each entry is invoked with, and its purpose.
 * @returns The block in Markdown, or an empty string when there are no
 *   entries.
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
 * Renders a server's subscription block, when its card declares the contract
 * (`subscriptions`).
 *
 * Each method's availability is generated from `card.subscriptions.methods`
 * and the count of subscribable templates comes from the `subscribable` flag
 * server-cards.ts curates out of `_meta` — the raw `_meta` never leaves the
 * data layer, so nothing in this block can drift from the committed snapshot
 * or from the other surfaces reading the same flag. The emitted text does name
 * the original `_meta` key: that is the one an MCP client will see in
 * `resources/templates/list`.
 *
 * @param card The card's curated summary, when there is one.
 * @returns The block in Markdown, or an empty string when there is no
 *   contract.
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
 * Renders a server's action-catalog block, when it has a committed snapshot in
 * `src/data/surface/`.
 *
 * The figures, the sample domains and the source URI come from the snapshot,
 * never from literals; the "Free-tier" qualifier ALWAYS travels with the count
 * (the same reason as in `buildLlmsTxt`: `cacheScope: "private"`).
 *
 * @param serverId The server's id in `src/data/servers.ts`.
 * @returns The block in Markdown, or an empty string when there is no catalog.
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
 * A server's full entry: what it is called, what it asks for and how it is
 * invoked.
 *
 * @param server A server from `src/data/servers.ts`.
 * @returns The section in Markdown.
 */
function serverSection(server: McpServer): string {
  const auth =
    server.requiredHeaders.length === 0
      ? "\n- Authentication: none. The server is public and takes no credentials."
      : "";

  // The committed card is the fallback source for the three blocks below.
  // `servers.ts` only carries hand-written copy, and for gitlab's 37 prompts
  // there is none: that absent field means "nobody has written that copy", not
  // "this server has no prompts" — reading it the second way is what left them
  // out of this surface. `scripts/sync-server-cards.sh` refreshes the card on
  // every release, so what is emitted cannot drift from what the server
  // answers. It is checked rather than indexed blindly: a server can be
  // registered before its snapshot lands (the same reason as `pageEntries`'
  // filter).
  const card = serverCardDocuments[server.id];

  // `servers.ts` wins where it has copy of its own — libgen's four prompts are
  // translated by hand; the card covers the rest.
  const prompts = server.prompts?.length
    ? server.prompts.map((prompt) => ({
        key: prompt.name,
        what: prompt.what.en,
      }))
    : (card?.prompts ?? []).map((prompt) => ({
        key: prompt.name,
        what: prompt.description,
      }));

  // Resources and templates are listed by URI, not by name: that is the
  // difference from a tool, since `resources/read` addresses by URI and the
  // name alone leaves the client nothing to call.
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
 * The long document: everything needed to call the servers.
 *
 * @returns `/llms-full.txt`'s body.
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
