/**
 * Reading the `tools/list` catalog and the `inputSchema`.
 *
 * The schemas in this file are libgen's REAL ones (trimmed): they are the ones
 * that failed the audit in production, with `unexpected additional properties
 * ["limit"]` for inventing an argument and with `query is required` for sending
 * `{}`. If `skeletonFor` stops emitting `query`, that error comes back.
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

test("toolsFrom takes the name, description and schema out of the catalog", () => {
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

test("toolsFrom also accepts input_schema in snake_case", () => {
  const tools = toolsFrom(
    body([{ name: "search", input_schema: LIBGEN_SEARCH }]),
  );
  assert.deepEqual(tools[0].inputSchema.required, ["query"]);
});

test("toolsFrom returns [] for any unexpected shape", () => {
  // An odd response from any server must not take the island down.
  assert.deepEqual(toolsFrom(undefined), []);
  assert.deepEqual(toolsFrom({ result: {} }), []);
  assert.deepEqual(toolsFrom({ result: { tools: "nope" } }), []);
  assert.deepEqual(toolsFrom({ error: { code: -32_602 } }), []);
  // Nameless entries are discarded: an <option> with no value is no use.
  assert.deepEqual(toolsFrom(body([{ description: "no name" }, "x"])), []);
});

test("schemaFields puts the required ones first and labels the types", () => {
  const rows = schemaFields(LIBGEN_SEARCH);

  assert.equal(rows[0].name, "query", "the required one comes first");
  assert.equal(rows[0].required, true);
  assert.equal(rows[0].description, "What to look for");

  const byName = Object.fromEntries(rows.map((r) => [r.name, r]));
  assert.equal(byName.results_per_page.type, "integer");
  assert.equal(byName.results_per_page.required, false);
  assert.equal(byName.topics.type, "string[]");
  assert.equal(byName.order.type, '"year" | "size"');
});

test("schemaFields does not blow up with no schema", () => {
  assert.deepEqual(schemaFields(undefined), []);
  assert.deepEqual(schemaFields({ type: "object" }), []);
});

test("skeletonFor pre-fills ONLY the required ones", () => {
  const skeleton = JSON.parse(skeletonFor(LIBGEN_SEARCH));

  assert.deepEqual(skeleton, { query: "" });
  // Sending the optional ones would change the call's meaning, and some
  // servers reject empty values they would not have rejected when absent.
  assert.equal("results_per_page" in skeleton, false);
});

test("skeletonFor uses the type, the default and the enum's first value", () => {
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

test("skeletonFor gives {} when the tool requires nothing", () => {
  assert.equal(skeletonFor(undefined), "{}");
  assert.equal(
    skeletonFor({ type: "object", properties: { q: { type: "string" } } }),
    "{}",
  );
});

test("the skeleton comes out indented, which is what gets pasted into the textarea", () => {
  assert.equal(skeletonFor(LIBGEN_SEARCH), '{\n  "query": ""\n}');
});

test("requirementGroups: an anyOf of required branches → groups with their kind", () => {
  // The exact shape libgen 1.7.1 publishes: branches with required plus a
  // non-blank refinement in properties, which the reader must ignore.
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

test("requirementGroups: oneOf wins the kind, and multi-field branches are kept", () => {
  const groups = requirementGroups({
    oneOf: [{ required: ["file_name", "content"] }, { required: ["files"] }],
  });
  assert.deepEqual(groups, {
    kind: "oneOf",
    groups: [["file_name", "content"], ["files"]],
  });
});

test("requirementGroups: a composition that is not of required branches → undefined, not half a truth", () => {
  // One branch with no readable required invalidates the whole set: showing
  // only some of the groups would assert a requirement other than the real
  // one.
  assert.equal(
    requirementGroups({ anyOf: [{ required: ["md5"] }, { type: "string" }] }),
    undefined,
  );
  assert.equal(requirementGroups({ anyOf: [] }), undefined);
  assert.equal(requirementGroups({ type: "object" }), undefined);
  assert.equal(requirementGroups(undefined), undefined);
});
