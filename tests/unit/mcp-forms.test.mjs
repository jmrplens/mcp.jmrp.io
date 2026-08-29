import assert from "node:assert/strict";
import { test } from "node:test";

import {
  promptSchema,
  promptsFrom,
  resourcesFrom,
} from "../../src/lib/mcp-catalog.ts";
import { formFields, valuesToArgs } from "../../src/lib/tool-schema.ts";

/**
 * The messages the caller supplies. They used to be hardcoded Spanish inside
 * the module, which the panel then appended to a localised prefix.
 */
const ERRORS = {
  notANumber: '{field}: "{value}" is not a number',
  badJson: "{field}: malformed JSON — {detail}",
};

/**
 * The form is what separates "filling in a tool" from "knowing its schema by
 * heart". These tests pin down the decisions that keep the visitor's first
 * attempt from failing.
 */

test("each schema type picks its control", () => {
  const fields = formFields({
    type: "object",
    properties: {
      query: { type: "string" },
      limit: { type: "integer" },
      exact: { type: "boolean" },
      topics: { type: "array", items: { type: "string" } },
      filter: { type: "object" },
      format: { type: "string", enum: ["pdf", "epub"] },
    },
    required: ["query"],
  });
  const byName = Object.fromEntries(fields.map((f) => [f.name, f.control]));
  assert.equal(byName.query, "text");
  assert.equal(byName.limit, "number");
  assert.equal(byName.exact, "checkbox");
  assert.equal(byName.topics, "list");
  assert.equal(byName.filter, "json");
  assert.equal(byName.format, "select", "an enum is asked for with a dropdown");
});

test("the required ones are rendered first", () => {
  const fields = formFields({
    type: "object",
    properties: { a: { type: "string" }, b: { type: "string" } },
    required: ["b"],
  });
  assert.equal(fields[0].name, "b");
});

test("an enum offers its options", () => {
  const [field] = formFields({
    type: "object",
    properties: { f: { type: "string", enum: ["pdf", "epub"] } },
  });
  assert.deepEqual(field.options, ["pdf", "epub"]);
});

test("empty fields are OMITTED, not sent empty", () => {
  const fields = formFields({
    type: "object",
    properties: { query: { type: "string" }, author: { type: "string" } },
  });
  const args = valuesToArgs(fields, { query: "tolkien", author: "  " }, ERRORS);
  assert.deepEqual(args, { query: "tolkien" });
});

test("each control converts to its JSON type", () => {
  const fields = formFields({
    type: "object",
    properties: {
      limit: { type: "integer" },
      exact: { type: "boolean" },
      topics: { type: "array", items: { type: "string" } },
      filtro: { type: "object" },
    },
  });
  const args = valuesToArgs(
    fields,
    {
      limit: "3",
      exact: "true",
      topics: "fiction\n comics ",
      filtro: '{"year":1996}',
    },
    ERRORS,
  );
  assert.deepEqual(args, {
    limit: 3,
    exact: true,
    topics: ["fiction", "comics"],
    filtro: { year: 1996 },
  });
});

test("a badly typed number is reported by its name, in the given language", () => {
  const fields = formFields({
    type: "object",
    properties: { limit: { type: "integer" } },
  });
  // Both placeholders have to be filled: the field name is what tells the
  // reader WHICH box is wrong, and the value is what they typed.
  assert.throws(
    () => valuesToArgs(fields, { limit: "tres" }, ERRORS),
    /limit: "tres" is not a number/,
  );
});

test("prompts/list is normalized along with its arguments", () => {
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

test("a prompt's arguments are translated into a schema", () => {
  const schema = promptSchema([
    { name: "title", required: true },
    { name: "author" },
  ]);
  assert.deepEqual(schema.required, ["title"]);
  const fields = formFields(schema);
  assert.equal(fields[0].name, "title", "the required one, first");
  assert.equal(fields.length, 2);
});

test("resources/list is normalized", () => {
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

test("an empty or malformed catalog does not blow up", () => {
  assert.deepEqual(promptsFrom(undefined), []);
  assert.deepEqual(resourcesFrom({ result: {} }), []);
  assert.deepEqual(promptsFrom({ result: { prompts: "nope" } }), []);
});

test("a union type with null is read as the real type", () => {
  const [field] = formFields({
    type: "object",
    properties: {
      topics: { type: ["null", "array"], items: { type: "string" } },
    },
  });
  assert.equal(field.type, "string[]", 'it used to render "nullarray"');
  assert.equal(field.control, "list");
});
