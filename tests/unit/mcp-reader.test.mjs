/**
 * The inspector's reader view, for every shape of answer.
 *
 * It replaced `readableText`, which laid out a `tools/call` text result and
 * returned `undefined` for everything else, on the rule that "the JSON IS the
 * answer" there and an empty reader would hide it. The reader is never empty
 * now, so that rule has nothing left to protect; the tests below pin what each
 * shape turns into instead, including the two that `readableText` covered.
 *
 * The safety tests run the output through the real `md.ts` parser, because
 * the property that matters is not what string this module writes but what
 * that string parses into once a hostile server has chosen the input.
 */
import assert from "node:assert/strict";
import { test } from "node:test";

import { readerMarkdown } from "../../src/lib/mcp-reader.ts";
import { parseMarkdown } from "../../src/lib/md.ts";

const call = (content, extra = {}) => ({ result: { content, ...extra } });

test("nothing sent yet means no reader at all", () => {
  assert.equal(readerMarkdown(undefined), undefined);
  assert.equal(readerMarkdown(null), undefined);
});

test("a Markdown tool result passes through as written", () => {
  // libgen's search: this is the one case the old reader handled.
  const md = "| a | b |\n| - | - |\n| 1 | 2 |";
  assert.equal(readerMarkdown(call([{ type: "text", text: md }])), md);
});

test("several blocks are joined, and a picture is described, not dropped", () => {
  const out = readerMarkdown(
    call([
      { type: "text", text: "uno" },
      { type: "image", mimeType: "image/png", data: "AAAA" },
      { type: "text", text: "dos" },
    ]),
  );
  assert.equal(out, "uno\n\n*image · image/png · 3 B*\n\ndos");
});

test("a text block that is really JSON is shown as formatted JSON", () => {
  // gitlab answers most calls this way; as prose it was one endless line.
  const out = readerMarkdown(
    call([{ type: "text", text: '{"id":1,"ok":true}' }]),
  );
  assert.equal(out, '```json\n{\n  "id": 1,\n  "ok": true\n}\n```');
});

test("a tool error says so before its text", () => {
  const out = readerMarkdown(
    call([{ type: "text", text: "boom" }], { isError: true }),
  );
  assert.match(out, /^\*\*The tool reported an error\.\*\*\n\nboom$/);
});

test("structuredContent is shown only when the text said nothing", () => {
  assert.match(
    readerMarkdown(call([], { structuredContent: { n: 2 } })),
    /```json\n\{\n {2}"n": 2\n\}\n```/,
  );
  assert.equal(
    readerMarkdown(
      call([{ type: "text", text: "two" }], { structuredContent: { n: 2 } }),
    ),
    "two",
  );
});

test("a rendered prompt shows each message under its role", () => {
  const out = readerMarkdown({
    result: {
      description: "Troubleshoot a download",
      messages: [
        { role: "user", content: { type: "text", text: "## Step 1" } },
      ],
    },
  });
  assert.equal(out, "*Troubleshoot a download*\n\n**user**\n\n## Step 1");
});

test("a resource is shown by its media type", () => {
  const read = (item) => readerMarkdown({ result: { contents: [item] } });
  assert.match(
    read({ uri: "x://a", mimeType: "application/json", text: "[1]" }),
    /```json/,
  );
  assert.match(
    read({ uri: "x://b", mimeType: "text/markdown", text: "# Hi" }),
    /# Hi/,
  );
  assert.match(
    read({ uri: "x://c", mimeType: "application/pdf", blob: "AAAA" }),
    /binary content · application\/pdf/,
  );
});

test("a catalog is a list with a count, never a table", () => {
  const out = readerMarkdown({
    result: {
      tools: [
        { name: "search", title: "Search books", description: "A | B\nC" },
        { name: "read" },
      ],
    },
  });
  assert.equal(
    out,
    "**2 tools**\n\n- `search` **Search books** — A | B C\n- `read`",
  );
  assert.equal(
    readerMarkdown({ result: { resourceTemplates: [] } }),
    "*No resource templates.*",
  );
});

test("initialize leads with the server and ends with its instructions", () => {
  const out = readerMarkdown({
    result: {
      protocolVersion: "2025-06-18",
      serverInfo: {
        name: "libgen-mcp",
        title: "Books & Papers",
        version: "1.7.2",
      },
      capabilities: { tools: {}, prompts: {} },
      instructions: "WORKFLOW — search first.",
    },
  });
  assert.match(out, /^## Books & Papers 1\.7\.2/);
  assert.match(out, /\*\*Capabilities:\*\* `prompts` `tools`/);
  assert.match(out, /## Instructions\n\nWORKFLOW — search first\.$/);
});

test("an error states its code and message", () => {
  const out = readerMarkdown({
    error: { code: -32_601, message: 'method not found: "resources/list"' },
  });
  assert.equal(out, '**Error -32601** — method not found: "resources/list"');
});

test("an empty success and an unknown shape both still read", () => {
  assert.match(readerMarkdown({ result: {} }), /Empty result/);
  assert.match(readerMarkdown({ result: { whatever: 1 } }), /```json/);
});

test("a value cannot close its code fence and spill into the page", () => {
  // A resource of plain text whose second line is a fence, followed by what a
  // hostile server would like rendered as the page's own prose.
  const hostile = "line one\n```\n# Injected heading";
  const out = readerMarkdown({
    result: {
      contents: [{ uri: "x://h", mimeType: "text/plain", text: hostile }],
    },
  });
  const blocks = parseMarkdown(out);
  const code = blocks.filter((b) => b.kind === "code");
  assert.equal(code.length, 1, "the value escaped its fence");
  assert.match(code[0].text, /Injected heading/);
  assert.equal(
    blocks.some(
      (b) => b.kind === "heading" && /Injected/.test(JSON.stringify(b)),
    ),
    false,
    "the injected heading rendered as the page's own",
  );
});

test("a name cannot break out of its inline code span", () => {
  const out = readerMarkdown({ result: { tools: [{ name: "a`b" }] } });
  assert.equal(out, "**1 tools**\n\n- `a'b`");
});
