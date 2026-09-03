import { failureLadderMarkdown } from "../components/FailureLadder.md.ts";
import { serverCards } from "../data/server-cards";
import type { McpServer } from "../data/servers";
import { servers } from "../data/servers";
import type {
  GitlabActionEntry,
  GitlabActionParam,
  SurfaceServerId,
} from "../data/surface";
import { actionCatalogs, getDiscover } from "../data/surface";
import type { Lang } from "../i18n/config";
import { ui } from "../i18n/ui";
import { internals } from "../i18n/ui/internals";
import { license } from "../i18n/ui/license";
import { policies } from "../i18n/ui/policies";
import { serversPage } from "../i18n/ui/servers-page";
import {
  claudeCodeCommand,
  claudeCodeOauthCommand,
  cursorJson,
  cursorOauthJson,
  noscriptCurl,
  vscodeJson,
  vscodeOauthJson,
} from "./client-config";
import { pageUrl, serverPageUrl, SITE_ORIGIN, SITE_REPO } from "./seo";

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
 * can submit from a text file would be noise. The server cards do not
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

/** Pages that have a twin, beyond the per-server cards. */
export type TwinPage =
  "home" | "inspector" | "internals" | "license" | "policies" | "servers";

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
 * @param lang Locale of the label.
 * @returns The opening block.
 */
function head(title: string, summary: string, url: string, lang: Lang): string {
  return `# ${title}\n\n> ${summary}\n\n${ui[lang].mdCanonicalLabel}: ${url}\n`;
}

/** Renders a list of paragraphs as markdown prose. */
function prose(paragraphs: readonly string[]): string {
  return paragraphs.join("\n\n");
}

/** Renders one `## heading` followed by its paragraphs. */
function section(heading: string, paragraphs: readonly string[]): string {
  return `\n\n## ${heading}\n\n${prose(paragraphs)}`;
}

/** Renders one `### heading` followed by its paragraphs. */
function subsection(heading: string, paragraphs: readonly string[]): string {
  return `### ${heading}\n\n${prose(paragraphs)}`;
}

/**
 * One labelled, fenced configuration snippet.
 *
 * @param label What the snippet configures, e.g. `Cursor — ~/.cursor/mcp.json`.
 * @param code The snippet itself.
 * @param fence Info string for the fence, `sh` or `json`.
 * @returns The block.
 */
function codeBlock(label: string, code: string, fence: string): string {
  return `**${label}**\n\n\`\`\`${fence}\n${code}\n\`\`\``;
}

/**
 * The client configuration a reader came for, as markdown.
 *
 * Mirrors `ClientSetup.astro`, calling the SAME builders in
 * `src/lib/client-config.ts` so the twin cannot drift from the page: the
 * OAuth path first when the server has one, the pasted token after, because
 * the second is what is left for a client that cannot open a browser. A
 * server without `oauth` — libgen — shows only the token group, with no
 * heading announcing a choice it does not offer.
 *
 * This section is why the fix matters at all. "How do I connect this to
 * Claude Code" is the question this site exists to answer, and the twins,
 * which are the surface llms.txt points every assistant at, carried none of
 * it: the endpoint, the client id and all six snippets were on the HTML page
 * and nowhere else a machine reads.
 *
 * @param server The server.
 * @param lang Locale to render.
 * @returns The section, opening with its own `##` heading.
 */
function connectSection(server: McpServer, lang: Lang): string {
  const t = serversPage[lang];
  const u = ui[lang];
  const oauthBlocks = server.oauth
    ? [
        { label: "Claude Code", code: claudeCodeOauthCommand(server), fence: "sh" },
        {
          label: "Cursor — ~/.cursor/mcp.json",
          code: cursorOauthJson(server),
          fence: "json",
        },
        {
          label: "VS Code — .vscode/mcp.json",
          code: vscodeOauthJson(server),
          fence: "json",
        },
      ].filter(
        (block): block is { label: string; code: string; fence: string } =>
          Boolean(block.code),
      )
    : [];
  const tokenBlocks = [
    { label: "Claude Code", code: claudeCodeCommand(server), fence: "sh" },
    {
      label: "Cursor — ~/.cursor/mcp.json",
      code: cursorJson(server),
      fence: "json",
    },
    {
      label: "VS Code — .vscode/mcp.json",
      code: vscodeJson(server, lang),
      fence: "json",
    },
  ];
  const render = (
    blocks: readonly { label: string; code: string; fence: string }[],
  ) => blocks.map((b) => codeBlock(b.label, b.code, b.fence));

  // With no OAuth path there is only one way in, so the sub-headings would
  // announce a choice that does not exist — the same call the component makes.
  if (oauthBlocks.length === 0) {
    return section(t.connectHead, render(tokenBlocks));
  }
  return section(t.connectHead, [
    subsection(u.clientOauthHead, [u.clientOauthHint, ...render(oauthBlocks)]),
    subsection(u.clientTokenHead, render(tokenBlocks)),
  ]);
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
          ? server.requiredHeaders
              .map((header) => `\`${header.name}\``)
              .join(", ")
          : t.mdNoneLabel;
      return `- **${server.name}** — \`${server.endpoint}\`\n  ${server.description[lang]}\n  ${t.mdCredentialsLabel}: ${credential}. ${t.mdPageLabel}: ${serverPageUrl(lang, server.id)}`;
    })
    .join("\n");
  // The notices the home page folds under each server card: where libgen
  // searches and its legal footing, where a GitLab token goes, and what each
  // server's limits are. They are the four question-shaped headings on the
  // page, the four entries in its FAQPage graph and the four `speakable`
  // targets — and the twin carried none of them, which left it at 145 words
  // against the page's 884 and dropped the best trust copy on the site from
  // the one surface written for machines to read.
  const noticeSections = servers.flatMap((server) =>
    server.notices.map((notice) => {
      const bullets = (notice.bullets ?? []).map(
        (bullet) => `- ${bullet[lang]}`,
      );
      return subsection(notice.title[lang], [
        ...notice.body.map((paragraph) => paragraph[lang]),
        ...(bullets.length > 0 ? [bullets.join("\n")] : []),
      ]);
    }),
  );
  return (
    head(t.title, t.subtitle, pageUrl(lang, "home"), lang) +
    section(t.serversEyebrow, [t.serversIntro, list, ...noticeSections]) +
    section(t.mdMachineHead, [
      `- ${t.mdIndexLabel}: ${SITE_ORIGIN}/servers.json`,
      `- ${t.mdCorpusLabel}: ${SITE_ORIGIN}/llms.txt ${t.mdAndWord} ${SITE_ORIGIN}/llms-full.txt`,
      `- ${t.inspectorTitle}: ${pageUrl(lang, "inspector")}`,
      `- ${internals[lang].title}: ${pageUrl(lang, "internals")}`,
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
  // The page's <noscript> block, which is the most useful thing on it for a
  // reader who is not running a browser — a complete, working call that needs
  // no client, no account and no install. The twin quoted none of it, which
  // is the wrong way round: the audience that cannot run the island IS the
  // audience reading the markdown. Same builder as the page, so the two
  // cannot drift.
  const noscript = servers.find((server) => server.id === "libgen");
  const noscriptSection = noscript
    ? section(t.noscript.title, [
        t.noscript.lead,
        `\`\`\`sh\n${noscriptCurl(noscript)}\n\`\`\``,
        t.noscript.response,
        `${t.noscript.more} ${t.noscript.moreLink}: ${serverPageUrl(lang, noscript.id)}`,
      ])
    : "";
  return (
    head(t.inspectorTitle, t.inspectorIntro, pageUrl(lang, "inspector"), lang) +
    section(t.inspectorEyebrow, [
      t.inspectorIntro,
      servers.map((server) => requiresLine(server, lang)).join("\n"),
      t.mdInspectorNote.replace("{url}", () => pageUrl(lang, "inspector")),
      // The pointer to gitlab's security notice, as the page renders it —
      // the notice lives on the home page, so the twin links there too.
      `${t.noticePointer} ${t.noticePointerLink}: ${pageUrl(lang, "home")}#gitlab-security`,
    ]) +
    noscriptSection +
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
  const names = server.requiredHeaders
    .map((h) => "`" + h.name + "`")
    .join(", ");
  const needs = names ? ` ${ui[lang].mdRequiresLabel} ${names}.` : "";
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
    head(t.title, t.lede, pageUrl(lang, "internals"), lang) +
    section(t.pathEyebrow, [
      ...t.pathBody,
      t.diagramTimelineIntro,
      steps.join("\n"),
    ]) +
    // Same order as InternalsPage.astro. The inspector-storage section was
    // missing from this twin for a while: it is exactly the one the
    // inspector's link points at as its contract, so an assistant reading
    // the .md never saw it.
    section(t.storageEyebrow, t.storageBody) +
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
      t.mdDirectiveNote.replace("{url}", () => pageUrl(lang, "internals")),
      t.affinityConsequence,
    ]) +
    section(t.egressEyebrow, t.egressBody) +
    // The two ladders go where the page puts them, after the paragraph each
    // one condenses — see the comment on them in InternalsPage.astro.
    section(t.failuresEyebrow, [
      t.failuresBody[0],
      t.failuresBody[1],
      failureLadderMarkdown(t.failureLadderInstance),
      t.failuresBody[2],
      failureLadderMarkdown(t.failureLadderEgress),
      t.failuresBody[3],
    ]) +
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
  // Every section the page renders, pointers included, and in the same
  // order. The legal position and the credential pointer were missing from
  // this twin for a while — the twin is what assistants read, and the legal
  // position is the section most carefully written for exactly that reader.
  // Links follow the `mdDirectiveNote` convention: the sentence, then the
  // absolute URL.
  return (
    head(t.policiesTitle, t.policiesIntro, pageUrl(lang, "policies"), lang) +
    section(t.privacyEyebrow, [
      ...t.privacyBody,
      `${t.credentialNotice} ${t.credentialNoticeLink}: ${pageUrl(lang, "home")}#gitlab-security`,
    ]) +
    section(t.logsEyebrow, t.logsBody) +
    section(t.slaEyebrow, t.slaBody) +
    section(t.egressEyebrow, [
      ...t.egressBody,
      `${t.egressPointer} ${t.egressPointerLink}: ${pageUrl(lang, "internals")}#egress-h`,
    ]) +
    section(t.legalEyebrow, [
      ...t.legalBody,
      // The three resolution cases, as a labelled list per identifier. The
      // HTML renders the same data as a <dl> of <ol>s — keep the two in step.
      ...t.legalResolution.map(
        (entry) =>
          `**${entry.label}**\n${entry.steps
            .map((step, i) => `${i + 1}. ${step}`)
            .join("\n")}`,
      ),
      t.legalResolutionTail,
      ...t.legalBodyTail,
      `${t.legalContact} ${t.legalContactLink}`,
      `${t.legalLicenseNote} ${t.legalLicenseLink}: ${pageUrl(lang, "license")}`,
    ]) +
    "\n"
  );
}

/**
 * The license page: what may be reused and how, section by section, with
 * every link as an absolute URL after its sentence.
 *
 * @param lang Locale to render.
 * @returns The markdown.
 */
export function licenseMarkdown(lang: Lang): string {
  const t = license[lang];
  const repos = servers.map((s) => `- ${s.name}: ${s.repo}`).join("\n");
  return (
    head(t.licenseTitle, t.licenseIntro, pageUrl(lang, "license"), lang) +
    "\n\n" +
    prose(t.licenseOpening) +
    section(t.licenseTextEyebrow, [
      ...t.licenseTextBody,
      `${t.licenseTextLink}: ${t.licenseTextHref}`,
    ]) +
    section(t.licenseImagesEyebrow, t.licenseImagesBody) +
    section(t.licenseSiteEyebrow, [
      ...t.licenseSiteBody,
      `${t.licenseSiteLink}: ${SITE_REPO}`,
    ]) +
    section(t.licenseServersEyebrow, [...t.licenseServersBody, repos]) +
    section(t.licenseIndexesEyebrow, t.licenseIndexesBody) +
    section(t.licenseReturnedEyebrow, [
      ...t.licenseReturnedBody,
      `${t.licenseReturnedLink}: ${pageUrl(lang, "policies")}#legal-h`,
    ]) +
    section(t.licenseMarksEyebrow, t.licenseMarksBody) +
    section(t.licensePermissionEyebrow, [
      `${t.licensePermissionLead} ${t.licenseContact}`,
      t.licensePermissionTail,
    ]) +
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
        `- **${server.name}** — ${server.description[lang]}\n  ${t.endpointLabel}: \`${server.endpoint}\` · ${t.mdPageLabel}: ${serverPageUrl(lang, server.id)}`,
    )
    .join("\n");
  return (
    head(t.titleIndex, t.ledeIndex, pageUrl(lang, "servers"), lang) +
    section(t.eyebrowIndex, [list]) +
    "\n"
  );
}

/**
 * One server's card. Counts come from the committed Server Card, so they
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
    `- ${t.endpointLabel}: \`${server.endpoint}\` (${t.getNoteLabel} ${server.getStatus})`,
    `- ${t.transportLabel}: ${t.transportValue}`,
    `- ${t.versionLabel}: ${card ? card.serverInfo.version : "—"}`,
    `- ${t.authLabel}: ${
      server.requiredHeaders.length > 0
        ? server.requiredHeaders.map((h) => `\`${h.name}\``).join(", ")
        : t.noneLabel
    }`,
    `- ${t.healthLabel}: \`${server.endpoint}/health\``,
    `- ${t.repositoryLabel}: ${server.repo}`,
    `- ${t.documentationLabel}: ${server.docsSite ?? server.docs}`,
  ];
  const surface = card
    ? [
        `- ${card.tools.length} ${t.countTools}`,
        `- ${card.prompts.length} ${t.countPrompts}`,
        `- ${card.resources.length} ${t.countResources}`,
        `- ${card.resourceTemplates.length} ${t.countTemplates}`,
      ]
    : [];
  // The service context the page prints under "Before you rely on this".
  // Its own module doc calls these four non-negotiable for a reader who lands
  // on a server's page without going through the home page — which is every
  // reader of this twin. The links follow the `mdDirectiveNote` convention:
  // the sentence, then its label and the absolute URL.
  const context = [
    t.contextService,
    server.rateLimit[lang],
    `${t.contextRouting} ${t.contextRoutingLink}: ${pageUrl(lang, "internals")}`,
    `${t.contextPolicies} ${t.contextPoliciesLink}: ${pageUrl(lang, "policies")}`,
  ];
  // What the server tells every client on connect. For a server whose whole
  // surface moved behind two tools, this is the one block that says how to
  // use it at all — and the twin carried none of it. Verbatim server data,
  // English in both locales, exactly as the page quotes it.
  // The cast is the one `ServerPage.astro` makes for the same call and for
  // the same reason: only two servers have a snapshot today, this renders any
  // server with a card, and an id without a snapshot yields `undefined` —
  // which is exactly the "section not rendered" path.
  const discover = getDiscover(server.id as SurfaceServerId);
  const instructions = discover?.instructions?.trim();
  // The action catalog, for the servers that have one (gitlab today). Gated
  // on the shared registry `actionCatalogs()`, the same one the page,
  // `/servers.json` and the llms files read, so a server without a catalog
  // renders no empty section.
  const catalog = actionCatalogs()[server.id];
  return (
    head(
      server.name,
      server.description[lang],
      serverPageUrl(lang, server.id),
      lang,
    ) +
    section(t.overviewHead, [facts.join("\n")]) +
    connectSection(server, lang) +
    section(t.contextHead, context) +
    (instructions
      ? section(t.instructionsHead, [t.instructionsIntro, instructions])
      : "") +
    // `toolsHead` lives in `common` (through `ui`), not in `serversPage`.
    (surface.length > 0
      ? section(ui[lang].toolsHead, [surface.join("\n")])
      : "") +
    (catalog
      ? section(t.catalogHead, [
          t.mdCatalogBody
            .replace("{count}", () => String(catalog.meta.actionCount))
            .replace("{actions}", () =>
              catalog.meta.actionCount === 1 ? t.mdActionOne : t.mdActionMany,
            )
            .replace("{domains}", () => String(catalog.domains.length))
            .replace("{domainWord}", () =>
              catalog.domains.length === 1 ? t.mdDomainOne : t.mdDomainMany,
            )
            .replace(
              "{index}",
              () => `${SITE_ORIGIN}/servers/${server.id}/actions.json`,
            )
            .replace(
              "{base}",
              () =>
                `${SITE_ORIGIN}${lang === "es" ? "/es" : ""}/servers/${server.id}/actions/`,
            ),
        ])
      : "") +
    section(t.fullCatalogHead, [
      t.fullCatalogBody
        .replace("{corpus}", () => `${SITE_ORIGIN}/llms-full.txt`)
        // The SEP-1649 CATALOGUE the binary serves, not the SEP-2127
        // connection card this site builds at `<endpoint>/server-card`: that
        // one is a few hundred bytes of name/version/remotes and carries none
        // of the four things this sentence promises. Two documents share the
        // name "server card" here; the sentence is only true of this one.
        .replace(
          "{card}",
          () => `\`${server.endpoint}/.well-known/mcp/server-card.json\``,
        ),
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
 * pages carry the whole action catalog — one page per domain — reference an
 * agent would otherwise have to read through the HTML of a filter island. No
 * figure here on purpose: the catalog is scoped to the asking token, so its
 * size moves with the tier, which is what `catalogTokenNote` says. The
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
 * @param domainOf Domain of each id an `alias_of` in this page points at.
 * @param lang Locale to render.
 * @returns The markdown.
 */
export function domainMarkdown(
  server: string,
  domain: string,
  actions: GitlabActionEntry[],
  domainOf: Record<string, string>,
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
        const target = domainOf[action.alias_of];
        const where = target ? ` (${target})` : "";
        lines.push(`**${t.domainAliasOf}:** ${code(action.alias_of)}${where}`);
      }
      return lines.join("\n\n");
    })
    .join("\n\n");
  // Two catalogue domains hold exactly one action, so the count needs a
  // singular. Both forms come from i18n rather than an inline ternary: a
  // Spanish string in a lib file is one no translator would ever find.
  const countLabel = actions.length === 1 ? t.mdActionOne : t.mdActionMany;
  return (
    head(
      `${domain} — ${server}`,
      `${actions.length} ${countLabel}`,
      url,
      lang,
    ) + `\n${t.catalogTokenNote}\n\n## ${t.mdActionsHead}\n\n${body}\n`
  );
}
