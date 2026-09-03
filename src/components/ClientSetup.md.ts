/**
 * Markdown twin of `ClientSetup.astro`, for the `.md` pages.
 *
 * Same input as the component and the same two groups in the same order —
 * the OAuth path first when the server has one, the hand-pasted token after,
 * because the second is what is left for a client that cannot open a browser.
 * A server without `oauth` shows only the token group, with no heading
 * announcing a choice it does not offer. Both sides call the SAME builders in
 * `src/lib/client-config.ts`, so the snippets themselves cannot diverge; what
 * this file mirrors is the component's composition, not its content.
 *
 * It exists because the composition was the thing that drifted. The twins are
 * built by `src/lib/page-markdown.ts` from the i18n modules rather than from
 * the rendered HTML, and for a long time that renderer simply did not know
 * this component existed: the entire "Connect it to your client" section —
 * the OAuth client id and all six client snippets — was on the HTML page and
 * in no twin at all, which is the one question a reader of the markdown is
 * most likely to have arrived with. A component with a `.md.ts` sibling
 * cannot go missing that way; a section composed by hand in two places can.
 *
 * @module
 */

import type { McpServer } from "../data/servers";
import type { Lang } from "../i18n/config";
import { ui } from "../i18n/ui";
import { serversPage } from "../i18n/ui/servers-page";
import {
  claudeCodeCommand,
  claudeCodeOauthCommand,
  cursorJson,
  cursorOauthJson,
  vscodeJson,
  vscodeOauthJson,
} from "../lib/client-config";

/** One labelled snippet: what it configures, the code, and its fence. */
interface ConfigBlock {
  label: string;
  code: string;
  fence: "sh" | "json";
}

/** The three client labels, in the order the component shows them. */
const CURSOR_LABEL = "Cursor — ~/.cursor/mcp.json";
const VSCODE_LABEL = "VS Code — .vscode/mcp.json";

/**
 * Renders one labelled, fenced snippet.
 *
 * @param block The snippet.
 * @returns The block, without a trailing newline.
 */
function codeBlock(block: ConfigBlock): string {
  return `**${block.label}**\n\n\`\`\`${block.fence}\n${block.code}\n\`\`\``;
}

/**
 * The OAuth group, or nothing when the server has no OAuth path.
 *
 * @param server The server.
 * @returns The blocks, already filtered of the builders that returned
 *   undefined for a server that cannot use them.
 */
function oauthBlocks(server: McpServer): ConfigBlock[] {
  if (!server.oauth) return [];
  return [
    { label: "Claude Code", code: claudeCodeOauthCommand(server), fence: "sh" },
    { label: CURSOR_LABEL, code: cursorOauthJson(server), fence: "json" },
    { label: VSCODE_LABEL, code: vscodeOauthJson(server), fence: "json" },
  ].filter((block): block is ConfigBlock => Boolean(block.code));
}

/**
 * The pasted-token group, which every server has.
 *
 * @param server The server.
 * @param lang Locale, which VS Code's snippet uses for its input prompt.
 * @returns The three blocks.
 */
function tokenBlocks(server: McpServer, lang: Lang): ConfigBlock[] {
  return [
    { label: "Claude Code", code: claudeCodeCommand(server), fence: "sh" },
    { label: CURSOR_LABEL, code: cursorJson(server), fence: "json" },
    { label: VSCODE_LABEL, code: vscodeJson(server, lang), fence: "json" },
  ];
}

/**
 * Renders the client configuration as markdown.
 *
 * @param server The server to configure.
 * @param lang Locale to render.
 * @returns The body of the section, with no `##` heading of its own — the
 *   caller supplies that, the same way it does for every other section.
 */
export function clientSetupMarkdown(server: McpServer, lang: Lang): string {
  const oauth = oauthBlocks(server);
  const token = tokenBlocks(server, lang);
  if (oauth.length === 0) {
    return token.map(codeBlock).join("\n\n");
  }
  const u = ui[lang];
  return [
    `### ${u.clientOauthHead}`,
    u.clientOauthHint,
    ...oauth.map(codeBlock),
    `### ${u.clientTokenHead}`,
    ...token.map(codeBlock),
  ].join("\n\n");
}

/**
 * The heading the section is published under, so the caller does not have to
 * know which i18n module it lives in.
 *
 * @param lang Locale to render.
 * @returns The heading text.
 */
export function clientSetupHeading(lang: Lang): string {
  return serversPage[lang].connectHead;
}
