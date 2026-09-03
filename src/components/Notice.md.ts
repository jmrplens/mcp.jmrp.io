/**
 * Markdown twin of `Notice.astro`, for the `.md` pages.
 *
 * The notices are the four question-shaped blocks the home page folds under
 * each server card: where libgen searches and its legal footing, where a
 * GitLab token goes, and each server's limits. They are also the four entries
 * in the page's `FAQPage` graph and its four `speakable` targets — so they are
 * the passages the structured data itself nominates for quotation, and the
 * home twin used to carry none of them, at 145 words against the page's 884.
 *
 * `kind` decides the tone the component paints, which is presentation and does
 * not survive here: markdown gets the question, the answer and the bullets.
 * The title becomes an `###` because the notices sit inside a section the
 * caller opened, and because a retriever chunks by heading — each notice
 * should come out as a passage with a heading of its own, exactly as it does
 * on the page, where the title is an `<h4>` inside the `<summary>`.
 *
 * @module
 */

import type { McpNotice } from "../data/servers";
import type { Lang } from "../i18n/config";

/**
 * Renders one notice as a heading, its paragraphs and its bullets.
 *
 * @param notice The notice, from `src/data/servers.ts`.
 * @param lang Locale to render.
 * @returns A markdown block, without a trailing newline.
 */
export function noticeMarkdown(notice: McpNotice, lang: Lang): string {
  const parts = [
    `### ${notice.title[lang]}`,
    ...notice.body.map((paragraph) => paragraph[lang]),
  ];
  const bullets = notice.bullets ?? [];
  if (bullets.length > 0) {
    parts.push(bullets.map((bullet) => `- ${bullet[lang]}`).join("\n"));
  }
  return parts.join("\n\n");
}
