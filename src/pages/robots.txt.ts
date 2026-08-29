/**
 * `/robots.txt`.
 *
 * It follows jmrp.io's pattern (the same `Content-Signal`, the same explicit
 * bot listing, the same `Sitemap:` line) because both domains belong to the
 * same author: were they to declare different policies, a crawler resolving
 * the brand through one and then the other would get two contradictory
 * answers.
 *
 * What is NOT copied from there are the paths: that site has a blog, feeds and
 * tools; here there are only a handful of pages, `/servers.json`, the
 * `llms.txt` files and the social cards. None of it is private and all of it
 * is meant to be indexed, so there is not a single `Disallow`.
 *
 * `/libgen` and `/gitlab` are NOT listed: they are JSON-RPC endpoints that
 * only answer POST, there is nothing to crawl on them, and mentioning them
 * would only invite crawlers to try.
 */
import type { APIRoute } from "astro";

import { SITE_ORIGIN } from "../lib/seo";

/** Classic search engines, listed even though the `*` block already covers them. */
const SEARCH_BOTS = [
  "Googlebot",
  "Bingbot",
  "YandexBot",
  "Baiduspider",
  "DuckDuckBot",
  "Applebot",
];

/**
 * AI crawlers with explicit permission.
 *
 * Anthropic splits crawling by purpose — ClaudeBot (training), Claude-User (a
 * request triggered by somebody's question) and Claude-SearchBot (indexing) —
 * so all three are named: should the wildcard block ever be tightened, each
 * one's policy stays explicit.
 */
const AI_BOTS = [
  "GPTBot",
  "ChatGPT-User",
  "OAI-SearchBot",
  "ClaudeBot",
  "Claude-User",
  "Claude-SearchBot",
  "Anthropic-AI",
  "Google-Extended",
  "PerplexityBot",
  "Perplexity-User",
  "Bytespider",
  "CCBot",
  "cohere-ai",
  "Meta-ExternalAgent",
  "FacebookBot",
  "Applebot-Extended",
  "YouBot",
  "Amazonbot",
  "AI2Bot",
  "Diffbot",
  "Omgilibot",
  "ImagesiftBot",
  "PetalBot",
  "Timpibot",
];

/** The signal, repeated in every group — see `BODY`'s comment. */
const CONTENT_SIGNAL = "Content-Signal: search=yes, ai-input=yes, ai-train=yes";

/**
 * A `User-agent` + `Content-Signal` + `Allow: /` block for each agent.
 *
 * The signal is repeated in every group on purpose: per RFC 9309 a crawler
 * obeys ONE group only, the most specific one matching it, and ignores the
 * rest including `*`. Declared only in the wildcard, the ~30 agents with a
 * group of their own — precisely its audience — never saw it (jmrp.io's GEO
 * audit, 2026-08-22, M6).
 *
 * @param agents The agents' names exactly as they send them.
 * @returns The blocks, separated by a blank line.
 */
function allowAll(agents: string[]): string {
  return agents
    .map((agent) => `User-agent: ${agent}\n${CONTENT_SIGNAL}\nAllow: /`)
    .join("\n\n");
}

const BODY = `User-agent: *
# Content Signals (https://contentsignals.org/) — stated intent: this site
# wants to be indexed by search engines, used as AI input (RAG) and used for
# training. Those are the ONLY THREE keys the specification defines; anything
# else is ignored, so do not add any more.
Content-Signal: search=yes, ai-input=yes, ai-train=yes
Allow: /

# --- Search engines (explicit allow, for clarity) ---

${allowAll(SEARCH_BOTS)}

# --- AI / LLM bots (allowed for indexing and training) ---

${allowAll(AI_BOTS)}

# --- Discovery ---

Sitemap: ${SITE_ORIGIN}/sitemap-index.xml

# LLM context (the llmstxt.org standard)
# ${SITE_ORIGIN}/llms.txt        — index
# ${SITE_ORIGIN}/llms-full.txt   — headers, methods and examples for both MCPs
#
# Machine-readable index (endpoints as JSON)
# ${SITE_ORIGIN}/servers.json
`;

/** Serves the file as plain UTF-8 text: any other type gets ignored. */
export const GET: APIRoute = () =>
  new Response(BODY, {
    headers: { "content-type": "text/plain; charset=utf-8" },
  });
