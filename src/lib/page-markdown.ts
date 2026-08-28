import { serverCards } from "../data/server-cards";
import type { McpServer } from "../data/servers";
import { servers } from "../data/servers";
import type { GitlabActionEntry, GitlabActionParam } from "../data/surface";
import type { Lang } from "../i18n/config";
import { ui } from "../i18n/ui";
import { internals } from "../i18n/ui/internals";
import { policies } from "../i18n/ui/policies";
import { serversPage } from "../i18n/ui/servers-page";
import { pageUrl, serverPageUrl, SITE_ORIGIN } from "./seo";

/**
 * Markdown twins: every page of this site, as the markdown behind it.
 *
 * WHY A TWIN AND NOT JUST `llms.txt`
 * `llms.txt` is one document describing the whole site; a twin is the page
 * itself, at a URL an agent can DERIVE instead of discover. Holding
 * `https://mcp.jmrp.io/internals/`, appending `index.md` is the convention it
 * will try, and until now that returned the site's 404. The index tells a
 * crawler this site exists; the twins let it read one page without parsing
 * the HTML around it, or fetching the 25 KB corpus to quote three sentences.
 *
 * WHERE THE TEXT COMES FROM
 * The same i18n objects the Astro components render, never the built HTML.
 * Scraping the output would make the twins a second rendering of the same
 * prose that can silently drift; reading the source means a corrected
 * sentence is corrected in both, and a page that gains a section gains it
 * here the moment someone adds the renderer line — a diff, not a mystery.
 *
 * WHAT IS DELIBERATELY NOT MIRRORED
 * The inspector is an interactive island: its twin describes what the page
 * offers and points at the endpoints, because a transcript of a form nobody
 * can submit from a text file would be noise. The server fichas do not
 * repeat their whole tool catalog either — `llms-full.txt` already carries
 * it, in one place, and the twin links there rather than shipping a second
 * copy that can disagree with the first.
 *
 * @module
 */

/** The one content type a twin is ever served as. */
export const MARKDOWN_HEADERS = {
  "Content-Type": "text/markdown; charset=utf-8",
} as const;

/** Pages that have a twin, beyond the per-server fichas. */
export type TwinPage = "home" | "inspector" | "internals" | "policies" | "servers";

/**
 * Wraps a rendered body in the response every twin route returns.
 *
 * @param body The markdown.
 * @returns The response, with the markdown content type.
 */
export function markdownResponse(body: string): Response {
  return new Response(body, { headers: MARKDOWN_HEADERS });
}

/**
 * The header every twin opens with: title, one-line summary, and the page it
 * mirrors. The canonical line is not decoration — a twin quoted out of
 * context is otherwise a document with no address.
 *
 * @param title Page title.
 * @param summary One-line description.
 * @param url The HTML page this mirrors.
 * @returns The opening block.
 */
function head(title: string, summary: string, url: string): string {
  return `# ${title}\n\n> ${summary}\n\nCanonical page: ${url}\n`;
}

/** Renders a list of paragraphs as markdown prose. */
function prose(paragraphs: readonly string[]): string {
  return paragraphs.join("\n\n");
}

/** Renders one `## heading` followed by its paragraphs. */
function section(heading: string, paragraphs: readonly string[]): string {
  return `\n\n## ${heading}\n\n${prose(paragraphs)}`;
}

/**
 * The home page: what this host is, and the servers on it.
 *
 * @param lang Locale to render.
 * @returns The markdown.
 */
export function homeMarkdown(lang: Lang): string {
  const t = ui[lang];
  const list = servers
    .map((server) => {
      const credential =
        server.requiredHeaders.length > 0
          ? server.requiredHeaders.map((header) => `\`${header.name}\``).join(", ")
          : "none";
      return `- **${server.name}** — \`${server.endpoint}\`\n  ${server.description[lang]}\n  Credentials: ${credential}. Page: ${serverPageUrl(lang, server.id)}`;
    })
    .join("\n");
  return (
    head(t.title, t.subtitle, pageUrl(lang, "home")) +
    section(t.serversEyebrow, [t.serversIntro, list]) +
    section("Machine-readable", [
      `- Index: ${SITE_ORIGIN}/servers.json`,
      `- Corpus: ${SITE_ORIGIN}/llms.txt and ${SITE_ORIGIN}/llms-full.txt`,
      `- Inspector: ${pageUrl(lang, "inspector")}`,
      `- Internals: ${pageUrl(lang, "internals")}`,
    ]) +
    "\n"
  );
}

/**
 * The inspector page. Describes the tool rather than transcribing its form —
 * see this module's header for why.
 *
 * @param lang Locale to render.
 * @returns The markdown.
 */
export function inspectorMarkdown(lang: Lang): string {
  const t = ui[lang];
  return (
    head(t.inspectorTitle, t.inspectorIntro, pageUrl(lang, "inspector")) +
    section(t.inspectorEyebrow, [
      t.inspectorIntro,
      servers
        .map(
          (server) =>
            requiresLine(server, lang),
        )
        .join("\n"),
      `The inspector runs in the browser and keeps any credential in memory only: it touches neither localStorage nor cookies, and it is gone on reload. Deep links take the shape ${pageUrl(lang, "inspector")}?server=<id>&tab=tools&name=<tool>.`,
    ]) +
    "\n"
  );
}

/**
 * One endpoint line for the inspector twin, with its credential when it needs
 * one. Extracted so the template does not nest — three levels of backticks in
 * one expression is where a quoting bug hides.
 *
 * @param server The server.
 * @param lang Locale to render.
 * @returns The bullet.
 */
function requiresLine(server: McpServer, lang: Lang): string {
  const names = server.requiredHeaders.map((h) => "`" + h.name + "`").join(", ");
  const needs = names ? ` Requires ${names}.` : "";
  return `- \`${server.endpoint}\` — ${server.description[lang]}${needs}`;
}

/**
 * The internals page: the whole request path, in the same order the page
 * tells it.
 *
 * @param lang Locale to render.
 * @returns The markdown.
 */
export function internalsMarkdown(lang: Lang): string {
  const t = internals[lang];
  const steps = [
    t.diagramTimelineStep1,
    t.diagramTimelineStep2,
    t.diagramTimelineStep3,
    t.diagramTimelineStep4,
    t.diagramTimelineStep5,
    t.diagramTimelineStep6,
  ].map((step, i) => `${i + 1}. ${step}`);
  return (
    head(t.title, t.lede, pageUrl(lang, "internals")) +
    section(t.pathEyebrow, [...t.pathBody, t.diagramTimelineIntro, steps.join("\n")]) +
    section(t.wireEyebrow, t.wireBody) +
    section(t.instancesEyebrow, t.instancesBody) +
    section(t.affinityEyebrow, [
      t.affinityIntro,
      t.affinityLibgen,
      t.affinityGitlab,
      ...t.affinityCodeIntro,
      // The prose says "see the directive above", and the directive is quoted
      // in the component, not in i18n — so in the twin that sentence would
      // point at nothing. Naming where it lives keeps the reference honest
      // instead of silently dangling.
      `The nginx directive itself is quoted in full on the page: ${pageUrl(lang, "internals")}`,
      t.affinityConsequence,
    ]) +
    section(t.egressEyebrow, t.egressBody) +
    section(t.personalEyebrow, t.personalBody) +
    "\n"
  );
}

/**
 * The policies page.
 *
 * @param lang Locale to render.
 * @returns The markdown.
 */
export function policiesMarkdown(lang: Lang): string {
  const t = policies[lang];
  return (
    head(t.policiesTitle, t.policiesIntro, pageUrl(lang, "policies")) +
    section(t.privacyEyebrow, t.privacyBody) +
    section(t.logsEyebrow, t.logsBody) +
    section(t.slaEyebrow, t.slaBody) +
    section(t.egressEyebrow, t.egressBody) +
    "\n"
  );
}

/**
 * The servers index.
 *
 * @param lang Locale to render.
 * @returns The markdown.
 */
export function serversIndexMarkdown(lang: Lang): string {
  const t = serversPage[lang];
  const list = servers
    .map(
      (server) =>
        `- **${server.name}** — ${server.description[lang]}\n  Endpoint: \`${server.endpoint}\` · Page: ${serverPageUrl(lang, server.id)}`,
    )
    .join("\n");
  return (
    head(t.titleIndex, t.ledeIndex, pageUrl(lang, "servers")) +
    section(t.eyebrowIndex, [list]) +
    "\n"
  );
}

/**
 * One server's ficha. Counts come from the committed Server Card, so they
 * cannot claim a surface the snapshot does not have; the catalog itself
 * stays in `llms-full.txt` rather than being copied here.
 *
 * @param server The server.
 * @param lang Locale to render.
 * @returns The markdown.
 */
export function serverMarkdown(server: McpServer, lang: Lang): string {
  const t = serversPage[lang];
  const card = serverCards[server.id];
  const facts = [
    `- Endpoint: \`${server.endpoint}\` (POST only; GET answers 405)`,
    `- Transport: streamable HTTP, stateless JSON-RPC 2.0`,
    `- ${t.versionLabel}: ${card ? card.serverInfo.version : "—"}`,
    `- ${t.authLabel}: ${
      server.requiredHeaders.length > 0
        ? server.requiredHeaders.map((h) => `\`${h.name}\``).join(", ")
        : "none"
    }`,
    `- Health: \`${server.endpoint}/health\``,
    `- Repository: ${server.repo}`,
    `- Documentation: ${server.docsSite ?? server.docs}`,
  ];
  const surface = card
    ? [
        `- ${card.tools.length} tools`,
        `- ${card.prompts.length} prompts`,
        `- ${card.resources.length} resources`,
        `- ${card.resourceTemplates.length} resource templates`,
      ]
    : [];
  return (
    head(server.name, server.description[lang], serverPageUrl(lang, server.id)) +
    section(t.overviewHead, [facts.join("\n")]) +
    // `toolsHead` lives in `common` (through `ui`), not in `serversPage`.
    (surface.length > 0 ? section(ui[lang].toolsHead, [surface.join("\n")]) : "") +
    section("Full catalog", [
      `Every tool, prompt, resource and template of this server — with what each one takes and returns — is listed in ${SITE_ORIGIN}/llms-full.txt, and served live by the server itself at \`${server.endpoint}/server-card\`.`,
    ]) +
    "\n"
  );
}

/** Wraps a string in backticks without nesting templates: three levels of
 * backtick in one expression is where a quoting bug hides. */
function code(text: string): string {
  return "`" + text + "`";
}

/** `name (type)`, or the bare name when the manifest declares no type. */
function paramLabel(param: GitlabActionParam): string {
  return param.type ? `${param.name} (${param.type})` : param.name;
}

/**
 * One action-domain page as markdown.
 *
 * These are the twins worth having most, and the reason is volume: the domain
 * pages carry the whole 851-action catalog, thirty pages of reference that an
 * agent would otherwise have to read through the HTML of a filter island. The
 * prose pages describe the service; these ARE the data.
 *
 * Every field the page paints is here — behaviour, description, required
 * parameters with their types, the any-of groups, and where an alias points —
 * because a reader that cannot see the page has no second place to look for
 * them. The alias target names its domain when it lives in another one, the
 * same as on the page: `issue.list_group` resolves into `group`, and a bare
 * id would send a reader to the wrong file.
 *
 * @param server The server that owns the catalog.
 * @param domain The domain being rendered.
 * @param actions Its actions, in catalog order.
 * @param aliasDomains Domain of each id an `alias_of` in this page points at.
 * @param lang Locale to render.
 * @returns The markdown.
 */
export function domainMarkdown(
  server: string,
  domain: string,
  actions: GitlabActionEntry[],
  aliasDomains: Record<string, string>,
  lang: Lang,
): string {
  const t = serversPage[lang];
  const url = `${SITE_ORIGIN}${lang === "es" ? "/es" : ""}/servers/${server}/actions/${domain}/`;
  const body = actions
    .map((action) => {
      const flags = [
        action.destructive ? t.domainChipDestructive : undefined,
        action.read_only ? t.domainChipReadOnly : undefined,
      ].filter(Boolean);
      const title = action.title ? ` — ${action.title}` : "";
      const lines = [`### ${code(action.id)}${title}`];
      if (flags.length > 0) lines.push(`_${flags.join(" · ")}_`);
      lines.push(action.description);
      if (action.required_params?.length) {
        lines.push(
          `**${t.domainParamsLabel}:** ${action.required_params.map((p) => code(paramLabel(p))).join(", ")}`,
        );
      }
      if (action.required_params_any_of?.length) {
        const groups = action.required_params_any_of
          .map((group) => group.map((p) => code(paramLabel(p))).join(" + "))
          .join(` ${t.domainAnyOfJoiner} `);
        lines.push(`**${t.domainAnyOfLabel}:** ${groups}`);
      }
      if (action.alias_of) {
        const target = aliasDomains[action.alias_of];
        const where = target ? ` (${target})` : "";
        lines.push(`**${t.domainAliasOf}:** ${code(action.alias_of)}${where}`);
      }
      return lines.join("\n\n");
    })
    .join("\n\n");
  return (
    head(
      `${domain} — ${server}`,
      `${actions.length} ${lang === "es" ? "acciones" : "actions"}`,
      url,
    ) +
    `\n\n## ${lang === "es" ? "Acciones" : "Actions"}\n\n${body}\n`
  );
}
