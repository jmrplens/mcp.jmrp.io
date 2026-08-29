import assert from "node:assert/strict";
import { test } from "node:test";

import { parseInline, parseMarkdown } from "../../src/lib/md.ts";

/**
 * The cases come from real responses: the table is the exact shape libgen's
 * `search` answers with, which is the reason the parser exists at all.
 */

test("un párrafo suelto es un párrafo", () => {
  const [b] = parseMarkdown("Found 4 results on page 1.");
  assert.equal(b.kind, "paragraph");
  assert.deepEqual(b.spans, [
    { kind: "text", text: "Found 4 results on page 1." },
  ]);
});

test("las almohadillas son encabezados, con su nivel", () => {
  const [b] = parseMarkdown("### Resultados");
  assert.equal(b.kind, "heading");
  assert.equal(b.level, 3);
});

test("la tabla de libgen se parsea con cabecera y filas", () => {
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

test("tuberías SIN fila de guiones no son una tabla", () => {
  // Otherwise any paragraph containing a pipe would become a table.
  const [b] = parseMarkdown("a | b | c");
  assert.equal(b.kind, "paragraph");
});

test("los enlaces se extraen con su destino", () => {
  const spans = parseInline("ver [libgen](https://libgen.vg/x) aquí");
  assert.deepEqual(spans[1], {
    kind: "link",
    text: "libgen",
    href: "https://libgen.vg/x",
  });
});

test("un enlace javascript: NO llega a ser enlace", () => {
  // A third party writes this text, so this is not hypothetical.
  const spans = parseInline("pulsa [aquí](javascript:alert(1))");
  assert.equal(
    spans.some((s) => s.kind === "link"),
    false,
  );
  assert.equal(spans.at(-1).kind, "text");
});

test("negrita, cursiva y código en línea", () => {
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

test("dentro de código en línea no se interpreta nada más", () => {
  const spans = parseInline("`**no**`");
  assert.deepEqual(spans, [{ kind: "code", text: "**no**" }]);
});

test("el bloque de código se copia literal, con su lenguaje", () => {
  const src = ["```json", '{ "a": **1** }', "```"].join("\n");
  const [b] = parseMarkdown(src);
  assert.equal(b.kind, "code");
  assert.equal(b.lang, "json");
  assert.equal(b.text, '{ "a": **1** }');
});

test("listas con guion y listas numeradas", () => {
  const [bullets] = parseMarkdown("- uno\n- dos");
  assert.equal(bullets.kind, "list");
  assert.equal(bullets.ordered, false);
  assert.equal(bullets.items.length, 2);

  const [numbered] = parseMarkdown("1. uno\n2. dos");
  assert.equal(numbered.ordered, true);
  assert.equal(numbered.items.length, 2);
});

test("texto vacío no produce bloques", () => {
  assert.deepEqual(parseMarkdown(""), []);
  assert.deepEqual(parseMarkdown("\n\n  \n"), []);
});

test("texto plano sin marcas sobrevive intacto", () => {
  // The commonest case: a server error, which carries no Markdown at all.
  const src = 'validating "arguments": unexpected additional properties';
  const [b] = parseMarkdown(src);
  assert.equal(b.kind, "paragraph");
  assert.equal(b.spans[0].text, src);
});
