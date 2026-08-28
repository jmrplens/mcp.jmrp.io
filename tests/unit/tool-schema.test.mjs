/**
 * Lectura del catálogo de `tools/list` y del `inputSchema`.
 *
 * Los esquemas de este fichero son los REALES de libgen (recortados): son los
 * que hicieron fallar la auditoría en producción, con `unexpected additional
 * properties ["limit"]` por inventarse un argumento y con `query is required`
 * por mandar `{}`. Si `skeletonFor` deja de emitir `query`, ese error vuelve.
 */
import assert from "node:assert/strict";
import { test } from "node:test";

import {
  requirementGroups,
  schemaFields,
  skeletonFor,
  toolsFrom,
} from "../../src/lib/tool-schema.ts";

const LIBGEN_SEARCH = {
  type: "object",
  required: ["query"],
  properties: {
    query: { type: "string", description: "What to look for" },
    results_per_page: {
      type: "integer",
      description: "Page size",
      default: 25,
    },
    order: { type: "string", enum: ["year", "size"] },
    topics: { type: "array", items: { type: "string" } },
    extra_sources: { type: "boolean" },
  },
};

const body = (tools) => ({ jsonrpc: "2.0", id: 1, result: { tools } });

test("toolsFrom saca nombre, descripción y esquema del catálogo", () => {
  const tools = toolsFrom(
    body([
      {
        name: "search",
        description: "Search Library Genesis",
        inputSchema: LIBGEN_SEARCH,
      },
      { name: "read", inputSchema: { type: "object" } },
    ]),
  );

  assert.equal(tools.length, 2);
  assert.equal(tools[0].name, "search");
  assert.equal(tools[0].description, "Search Library Genesis");
  assert.deepEqual(tools[0].inputSchema.required, ["query"]);
});

test("toolsFrom acepta también input_schema en snake_case", () => {
  const tools = toolsFrom(
    body([{ name: "search", input_schema: LIBGEN_SEARCH }]),
  );
  assert.deepEqual(tools[0].inputSchema.required, ["query"]);
});

test("toolsFrom devuelve [] ante cualquier forma inesperada", () => {
  // Una respuesta rara de un servidor cualquiera no puede tumbar la isla.
  assert.deepEqual(toolsFrom(undefined), []);
  assert.deepEqual(toolsFrom({ result: {} }), []);
  assert.deepEqual(toolsFrom({ result: { tools: "nope" } }), []);
  assert.deepEqual(toolsFrom({ error: { code: -32_602 } }), []);
  // Entradas sin nombre se descartan: un <option> sin valor no sirve de nada.
  assert.deepEqual(toolsFrom(body([{ description: "sin nombre" }, "x"])), []);
});

test("schemaFields pone las obligatorias primero y etiqueta los tipos", () => {
  const rows = schemaFields(LIBGEN_SEARCH);

  assert.equal(rows[0].name, "query", "la obligatoria va primero");
  assert.equal(rows[0].required, true);
  assert.equal(rows[0].description, "What to look for");

  const byName = Object.fromEntries(rows.map((r) => [r.name, r]));
  assert.equal(byName.results_per_page.type, "integer");
  assert.equal(byName.results_per_page.required, false);
  assert.equal(byName.topics.type, "string[]");
  assert.equal(byName.order.type, '"year" | "size"');
});

test("schemaFields no revienta sin esquema", () => {
  assert.deepEqual(schemaFields(undefined), []);
  assert.deepEqual(schemaFields({ type: "object" }), []);
});

test("skeletonFor prerrellena SOLO las obligatorias", () => {
  const skeleton = JSON.parse(skeletonFor(LIBGEN_SEARCH));

  assert.deepEqual(skeleton, { query: "" });
  // Mandar las opcionales cambiaría el significado de la llamada, y algunos
  // servidores rechazan valores vacíos que no habrían rechazado ausentes.
  assert.equal("results_per_page" in skeleton, false);
});

test("skeletonFor usa el tipo, el default y el primer valor del enum", () => {
  const skeleton = JSON.parse(
    skeletonFor({
      required: ["n", "flag", "list", "mode", "obj", "page"],
      properties: {
        n: { type: "number" },
        flag: { type: "boolean" },
        list: { type: "array" },
        mode: { type: "string", enum: ["fast", "slow"] },
        obj: { type: "object" },
        page: { type: "integer", default: 3 },
      },
    }),
  );

  assert.deepEqual(skeleton, {
    n: 0,
    flag: false,
    list: [],
    mode: "fast",
    obj: {},
    page: 3,
  });
});

test("skeletonFor da {} cuando la tool no exige nada", () => {
  assert.equal(skeletonFor(undefined), "{}");
  assert.equal(
    skeletonFor({ type: "object", properties: { q: { type: "string" } } }),
    "{}",
  );
});

test("el esqueleto sale indentado, que es lo que se pega en el textarea", () => {
  assert.equal(skeletonFor(LIBGEN_SEARCH), '{\n  "query": ""\n}');
});

test("requirementGroups: anyOf de ramas required → grupos con su clase", () => {
  // La forma exacta que libgen 1.7.1 publica: ramas con required y un
  // refinamiento non-blank en properties, que el lector debe ignorar.
  const groups = requirementGroups({
    type: "object",
    properties: { md5: { type: "string" }, doi: { type: "string" } },
    anyOf: [
      { required: ["md5"], properties: { md5: { pattern: String.raw`\S` } } },
      { required: ["doi"], properties: { doi: { pattern: String.raw`\S` } } },
    ],
  });
  assert.deepEqual(groups, { kind: "anyOf", groups: [["md5"], ["doi"]] });
});

test("requirementGroups: oneOf gana la clase, y las ramas multi-campo se conservan", () => {
  const groups = requirementGroups({
    oneOf: [{ required: ["file_name", "content"] }, { required: ["files"] }],
  });
  assert.deepEqual(groups, {
    kind: "oneOf",
    groups: [["file_name", "content"], ["files"]],
  });
});

test("requirementGroups: composición que no es de ramas-required → undefined, no media verdad", () => {
  // Una rama sin required legible invalida el conjunto entero: enseñar solo
  // parte de los grupos afirmaría un requisito distinto del real.
  assert.equal(
    requirementGroups({ anyOf: [{ required: ["md5"] }, { type: "string" }] }),
    undefined,
  );
  assert.equal(requirementGroups({ anyOf: [] }), undefined);
  assert.equal(requirementGroups({ type: "object" }), undefined);
  assert.equal(requirementGroups(undefined), undefined);
});
