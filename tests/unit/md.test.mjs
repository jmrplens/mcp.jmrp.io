import assert from "node:assert/strict";
import { test } from "node:test";

import { parseInline, parseMarkdown } from "../../src/lib/md.ts";

/**
 * The cases come from real responses: the table is the exact shape libgen's
 * `search` answers with, which is the reason the parser exists at all.
 */

test("a lone paragraph is a paragraph", () => {
  const [b] = parseMarkdown("Found 4 results on page 1.");
  assert.equal(b.kind, "paragraph");
  assert.deepEqual(b.spans, [
    { kind: "text", text: "Found 4 results on page 1." },
  ]);
});

test("hashes are headings, with their level", () => {
  const [b] = parseMarkdown("### Results");
  assert.equal(b.kind, "heading");
  assert.equal(b.level, 3);
});

test("libgen's table parses into a header and rows", () => {
  const src = [
    "| # | Title | Ext |",
    "| - | ----- | --- |",
    "| 1 | Attention | pdf |",
    "| 2 | Channel Attention | djvu |",
  ].join("\n");
  const [b] = parseMarkdown(src);
  assert.equal(b.kind, "table");
  assert.equal(b.head.length, 3);
  assert.equal(b.rows.length, 2);
  assert.deepEqual(b.rows[0][1], [{ kind: "text", text: "Attention" }]);
});

test("pipes with NO dashes row are not a table", () => {
  // Otherwise any paragraph containing a pipe would become a table.
  const [b] = parseMarkdown("a | b | c");
  assert.equal(b.kind, "paragraph");
});

test("links are extracted with their target", () => {
  const spans = parseInline("see [libgen](https://libgen.vg/x) here");
  assert.deepEqual(spans[1], {
    kind: "link",
    text: "libgen",
    href: "https://libgen.vg/x",
  });
});

test("a javascript: link does NOT become a link", () => {
  // A third party writes this text, so this is not hypothetical.
  const spans = parseInline("click [here](javascript:alert(1))");
  assert.equal(
    spans.some((s) => s.kind === "link"),
    false,
  );
  assert.equal(spans.at(-1).kind, "text");
});

test("bold, italic and inline code", () => {
  const spans = parseInline("**a** *b* `c`");
  assert.deepEqual(
    spans.filter((s) => s.kind !== "text").map((s) => [s.kind, s.text]),
    [
      ["strong", "a"],
      ["em", "b"],
      ["code", "c"],
    ],
  );
});

test("nothing else is interpreted inside inline code", () => {
  const spans = parseInline("`**not**`");
  assert.deepEqual(spans, [{ kind: "code", text: "**not**" }]);
});

test("a code block is copied verbatim, with its language", () => {
  const src = ["```json", '{ "a": **1** }', "```"].join("\n");
  const [b] = parseMarkdown(src);
  assert.equal(b.kind, "code");
  assert.equal(b.lang, "json");
  assert.equal(b.text, '{ "a": **1** }');
});

test("dash lists and numbered lists", () => {
  const [bullets] = parseMarkdown("- one\n- two");
  assert.equal(bullets.kind, "list");
  assert.equal(bullets.ordered, false);
  assert.equal(bullets.items.length, 2);

  const [numbered] = parseMarkdown("1. one\n2. two");
  assert.equal(numbered.ordered, true);
  assert.equal(numbered.items.length, 2);
});

test("empty text produces no blocks", () => {
  assert.deepEqual(parseMarkdown(""), []);
  assert.deepEqual(parseMarkdown("\n\n  \n"), []);
});

test("plain text with no markup survives untouched", () => {
  // The commonest case: a server error, which carries no Markdown at all.
  const src = 'validating "arguments": unexpected additional properties';
  const [b] = parseMarkdown(src);
  assert.equal(b.kind, "paragraph");
  assert.equal(b.spans[0].text, src);
});
