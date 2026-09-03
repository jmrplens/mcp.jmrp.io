/**
 * The nginx directive `/internals/` quotes, and its markdown twin.
 *
 * The page's whole argument for this section is that the directive is SHOWN
 * rather than asserted — "that is exactly why the directive is shown in full
 * instead of just asserted", in `affinityCodeIntro`. The twin carried the
 * sentence and not the directive, so in markdown the claim was doing the one
 * thing it criticizes: asserting.
 *
 * Both sides read the tokens from here, so the highlighted block on the page
 * and the fenced block in the twin are the same bytes. The token split exists
 * for the page's syntax coloring (see `InternalsPage.astro` for why it is
 * hand-marked rather than run through a highlighter); markdown throws the
 * classes away and keeps the text.
 *
 * The salt's value is `"…"` here exactly as it is in production's quoted form:
 * the real one is never published, which is what the comment line says.
 *
 * @module
 */

/** One piece of the snippet, with the class the page paints it in. */
export type SnippetToken = { text: string; cls?: "kw" | "var" | "str" | "com" };

/**
 * The directive, tokenized.
 *
 * @param comment The one translated line inside the snippet
 *   (`affinityCodeComment`).
 * @returns The tokens, in order.
 */
export function affinityTokens(comment: string): SnippetToken[] {
  return [
    { text: "set", cls: "kw" },
    { text: " " },
    { text: "$mcp_affinity_salt", cls: "var" },
    { text: " " },
    { text: '"…"', cls: "str" },
    { text: ";   " },
    { text: comment, cls: "com" },
    { text: "\n\n" },
    { text: "set_by_lua_block", cls: "kw" },
    { text: " " },
    { text: "$mcp_affinity", cls: "var" },
    { text: " {\n    " },
    { text: "local", cls: "kw" },
    { text: " auth = " },
    { text: "ngx.var.http_authorization", cls: "var" },
    { text: "\n    " },
    { text: "if", cls: "kw" },
    { text: " auth " },
    { text: "then", cls: "kw" },
    { text: "\n        " },
    { text: "local", cls: "kw" },
    { text: " scheme, token = auth:match(" },
    { text: '"^(%a+)%s+([^%s]+)"', cls: "str" },
    { text: ")\n        " },
    { text: "if", cls: "kw" },
    { text: " scheme " },
    { text: "and", cls: "kw" },
    { text: " scheme:lower() == " },
    { text: '"bearer"', cls: "str" },
    { text: " " },
    { text: "and", cls: "kw" },
    { text: " token ~= " },
    { text: '""', cls: "str" },
    { text: " " },
    { text: "then", cls: "kw" },
    { text: "\n            " },
    { text: "return", cls: "kw" },
    { text: " ngx.md5(" },
    { text: "ngx.var.mcp_affinity_salt", cls: "var" },
    { text: " .. token)\n        " },
    { text: "end", cls: "kw" },
    { text: "\n    " },
    { text: "end", cls: "kw" },
    { text: "\n    " },
    { text: "return", cls: "kw" },
    { text: " " },
    { text: "ngx.var.remote_addr", cls: "var" },
    { text: " " },
    { text: "or", cls: "kw" },
    { text: " " },
    { text: '""', cls: "str" },
    { text: "\n}" },
  ];
}

/**
 * The same directive as a fenced markdown block.
 *
 * @param comment The translated comment line inside the snippet.
 * @returns The block, fenced as nginx, without a trailing newline.
 */
export function affinitySnippetMarkdown(comment: string): string {
  const code = affinityTokens(comment)
    .map((token) => token.text)
    .join("");
  return `\`\`\`nginx\n${code}\n\`\`\``;
}
