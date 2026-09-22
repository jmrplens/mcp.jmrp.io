/**
 * Markdown twin of `ServerComparison.astro`, and the rows both render.
 *
 * The comparison exists because the home page had no table: it answered
 * "which server does what, and what does each one need from me" in prose
 * spread over two cards, and the AI surfaces that prefer a table (Google AI
 * Overviews, Bing Copilot) extracted nothing structured from the page that is
 * the site's front door (GEO audits #3 and #4). One row per server, the same
 * facts the cards already print, from the same data: `servers.ts` for what
 * the server needs, the committed SEP-1649 card for what it offers, and the
 * action catalog registry for the figure behind gitlab's two tools.
 *
 * The data shaping lives here, not in the component, so the page and the twin
 * cannot disagree on a cell: the component only lays the rows out.
 *
 * @module
 */

import { getServerCard } from "../data/server-cards";
import { servers } from "../data/servers";
import { actionCatalogs } from "../data/surface";
import type { Lang } from "../i18n/config";
import { ui } from "../i18n/ui";
import { serverPageUrl } from "../lib/seo";

/** One server, one row: every cell already a string. */
export interface ComparisonRow {
  /** Server id, which is also its display name. */
  name: string;
  /** Absolute URL of the server's page. */
  href: string;
  /** The header(s) it needs, or the locale's "none". */
  credential: string;
  /** Tool count, with the action catalog behind them when there is one. */
  tools: string;
  prompts: string;
  resources: string;
  templates: string;
  /** From the card's `serverInfo`, or a dash before a card is committed. */
  version: string;
  /** Always the locale's "free": there is nothing here to pay for. */
  price: string;
}

/**
 * The rows, in `servers.ts` order.
 *
 * @param lang Locale to render.
 * @returns One row per server.
 */
export function comparisonRows(lang: Lang): ComparisonRow[] {
  const t = ui[lang];
  return servers.map((server) => {
    const card = getServerCard(server.id);
    const catalog = actionCatalogs()[server.id];
    const toolCount = card ? String(card.tools.length) : "—";
    return {
      name: server.name,
      href: serverPageUrl(lang, server.id),
      credential:
        server.requiredHeaders.length > 0
          ? server.requiredHeaders.map((h) => `\`${h.name}\``).join(", ")
          : t.compareNone,
      tools: catalog
        ? `${toolCount} (+${catalog.meta.actionCount} ${t.compareActions})`
        : toolCount,
      prompts: card ? String(card.prompts.length) : "—",
      resources: card ? String(card.resources.length) : "—",
      templates: card ? String(card.resourceTemplates.length) : "—",
      version: card ? card.serverInfo.version : "—",
      price: t.compareFree,
    };
  });
}

/**
 * The comparison as a GFM table, for the home twin.
 *
 * @param lang Locale to render.
 * @returns A markdown block, without a trailing newline.
 */
export function serverComparisonMarkdown(lang: Lang): string {
  const t = ui[lang];
  const header = [
    t.compareServer,
    t.compareCredential,
    t.compareTools,
    t.comparePrompts,
    t.compareResources,
    t.compareTemplates,
    t.compareVersion,
    t.comparePrice,
  ];
  const lines = [
    `| ${header.join(" | ")} |`,
    `|${header.map(() => "---").join("|")}|`,
    ...comparisonRows(lang).map(
      (row) =>
        `| [${row.name}](${row.href}) | ${row.credential} | ${row.tools} | ${row.prompts} | ${row.resources} | ${row.templates} | ${row.version} | ${row.price} |`,
    ),
  ];
  return lines.join("\n");
}
