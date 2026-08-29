import assert from "node:assert/strict";
import { test } from "node:test";

import {
  promptSchema,
  promptsFrom,
  resourcesFrom,
} from "../../src/lib/mcp-catalog.ts";
import { formFields, valuesToArgs } from "../../src/lib/tool-schema.ts";

/**
 * El formulario es lo que separa "rellenar una tool" de "saberse su esquema de
 * memoria". Estos tests fijan las decisiones que hacen que el primer intento
 * del visitante no falle.
 */

test("cada tipo del esquema elige su control", () => {
  const fields = formFields({
    type: "object",
    properties: {
      query: { type: "string" },
      limit: { type: "integer" },
      exact: { type: "boolean" },
      topics: { type: "array", items: { type: "string" } },
      filtro: { type: "object" },
      formato: { type: "string", enum: ["pdf", "epub"] },
    },
    required: ["query"],
  });
  const byName = Object.fromEntries(fields.map((f) => [f.name, f.control]));
  assert.equal(byName.query, "text");
  assert.equal(byName.limit, "number");
  assert.equal(byName.exact, "checkbox");
  assert.equal(byName.topics, "list");
  assert.equal(byName.filtro, "json");
  assert.equal(byName.formato, "select", "un enum se pide con desplegable");
});

test("los obligatorios se pintan primero", () => {
  const fields = formFields({
    type: "object",
    properties: { a: { type: "string" }, b: { type: "string" } },
    required: ["b"],
  });
  assert.equal(fields[0].name, "b");
});

test("un enum ofrece sus opciones", () => {
  const [field] = formFields({
    type: "object",
    properties: { f: { type: "string", enum: ["pdf", "epub"] } },
  });
  assert.deepEqual(field.options, ["pdf", "epub"]);
});

test("los campos vacíos se OMITEN, no se mandan vacíos", () => {
  const fields = formFields({
    type: "object",
    properties: { query: { type: "string" }, autor: { type: "string" } },
  });
  const args = valuesToArgs(fields, { query: "tolkien", autor: "  " });
  assert.deepEqual(args, { query: "tolkien" });
});

test("cada control convierte a su tipo JSON", () => {
  const fields = formFields({
    type: "object",
    properties: {
      limit: { type: "integer" },
      exact: { type: "boolean" },
      topics: { type: "array", items: { type: "string" } },
      filtro: { type: "object" },
    },
  });
  const args = valuesToArgs(fields, {
    limit: "3",
    exact: "true",
    topics: "fiction\n comics ",
    filtro: '{"year":1996}',
  });
  assert.deepEqual(args, {
    limit: 3,
    exact: true,
    topics: ["fiction", "comics"],
    filtro: { year: 1996 },
  });
});

test("un número mal escrito se avisa por su nombre", () => {
  const fields = formFields({
    type: "object",
    properties: { limit: { type: "integer" } },
  });
  assert.throws(() => valuesToArgs(fields, { limit: "tres" }), /limit/);
});

test("prompts/list se normaliza con sus argumentos", () => {
  const prompts = promptsFrom({
    result: {
      prompts: [
        {
          name: "acquire_book",
          arguments: [{ name: "title", required: true }, { name: "author" }],
        },
      ],
    },
  });
  assert.equal(prompts.length, 1);
  assert.equal(prompts[0].arguments[0].required, true);
  assert.equal(prompts[0].arguments[1].required, false);
});

test("los argumentos de un prompt se traducen a un esquema", () => {
  const schema = promptSchema([
    { name: "title", required: true },
    { name: "author" },
  ]);
  assert.deepEqual(schema.required, ["title"]);
  const fields = formFields(schema);
  assert.equal(fields[0].name, "title", "el obligatorio, primero");
  assert.equal(fields.length, 2);
});

test("resources/list se normaliza", () => {
  const res = resourcesFrom({
    result: {
      resources: [
        {
          uri: "gitlab://groups",
          name: "groups",
          mimeType: "application/json",
        },
      ],
    },
  });
  assert.equal(res[0].uri, "gitlab://groups");
  assert.equal(res[0].mimeType, "application/json");
});

test("un catálogo vacío o mal formado no revienta", () => {
  assert.deepEqual(promptsFrom(undefined), []);
  assert.deepEqual(resourcesFrom({ result: {} }), []);
  assert.deepEqual(promptsFrom({ result: { prompts: "nope" } }), []);
});

test("un tipo union con null se lee como el tipo real", () => {
  const [field] = formFields({
    type: "object",
    properties: {
      topics: { type: ["null", "array"], items: { type: "string" } },
    },
  });
  assert.equal(field.type, "string[]", 'pintaba "nullarray"');
  assert.equal(field.control, "list");
});
