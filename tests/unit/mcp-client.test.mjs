import assert from "node:assert/strict";
import { test } from "node:test";

import {
  callMcp,
  classifyMcp,
  listedItems,
  parseSseJsonRpc,
  readableText,
} from "../../src/lib/mcp-client.ts";

test("it extracts the JSON-RPC from an SSE response", () => {
  const sse =
    'event: message\ndata: {"jsonrpc":"2.0","id":1,"result":{"ok":true}}\n\n';
  assert.deepEqual(parseSseJsonRpc(sse), {
    jsonrpc: "2.0",
    id: 1,
    result: { ok: true },
  });
});

test("it accepts plain JSON in case the server answers application/json", () => {
  assert.deepEqual(parseSseJsonRpc('{"jsonrpc":"2.0","id":1,"result":{}}'), {
    jsonrpc: "2.0",
    id: 1,
    result: {},
  });
});

test("it uses the last data: when there are several events", () => {
  const sse = 'data: {"id":1}\n\ndata: {"id":2}\n\n';
  assert.equal(parseSseJsonRpc(sse).id, 2);
});

test("it throws a readable error when there is no JSON", () => {
  assert.throws(
    () => parseSseJsonRpc("JSON RPC not handled"),
    /non-JSON body/i,
  );
});

test("callMcp POSTs the JSON-RPC envelope with the transport headers", async () => {
  let seen;
  const fetchImpl = async (url, init) => {
    seen = { url, init };
    return new Response(
      'data: {"jsonrpc":"2.0","id":1,"result":{"tools":[]}}\n\n',
      {
        status: 200,
        headers: { "content-type": "text/event-stream" },
      },
    );
  };

  const result = await callMcp({
    endpoint: "https://mcp.jmrp.io/gitlab",
    method: "tools/list",
    headers: { Authorization: "Bearer glpat-x" },
    fetchImpl,
  });

  assert.deepEqual(result.body, {
    jsonrpc: "2.0",
    id: 1,
    result: { tools: [] },
  });
  assert.equal(result.ok, true);
  assert.equal(result.status, 200);
  assert.ok(result.bytes > 0, "the body's size is a datum the UI shows");
  assert.equal(typeof result.durationMs, "number");
  assert.equal(seen.url, "https://mcp.jmrp.io/gitlab");
  assert.equal(seen.init.method, "POST");
  assert.equal(seen.init.headers.Accept, "application/json, text/event-stream");
  assert.equal(seen.init.headers.Authorization, "Bearer glpat-x");
  assert.deepEqual(JSON.parse(seen.init.body), {
    jsonrpc: "2.0",
    id: 1,
    method: "tools/list",
    params: {},
  });
});

test("callMcp returns the code and the body instead of throwing", async () => {
  // The REAL body of the 401 in OAuth mode, not an invented sentence: the
  // server answers JSON-RPC with code -40100 even though what failed is the
  // authentication.
  const body = JSON.stringify({
    jsonrpc: "2.0",
    id: null,
    error: {
      code: -40_100,
      message:
        "Authentication required: send an OAuth access token as 'Authorization: Bearer <token>'.",
    },
  });
  const fetchImpl = async () => new Response(body, { status: 401 });
  const res = await callMcp({
    endpoint: "https://mcp.jmrp.io/gitlab",
    method: "tools/list",
    fetchImpl,
  });

  assert.equal(res.ok, false);
  assert.equal(res.status, 401);
  assert.match(res.text, /Authorization: Bearer/);
  // The OAuth 401 DOES carry JSON-RPC, which is why this assertion flipped:
  // the body of an authentication failure used to be loose text and `body` was
  // left `undefined`. Now the server answers an error with code -40100, the
  // client hands it over parsed, and the caller can show the real message
  // instead of a bare "401".
  assert.equal(res.body?.error?.code, -40_100);
});

test("callMcp passes the signal to fetch, which is what allows cancelling", async () => {
  let seenSignal;
  const controller = new AbortController();
  const fetchImpl = async (_url, init) => {
    seenSignal = init.signal;
    return new Response('data: {"jsonrpc":"2.0","id":1,"result":{}}\n\n', {
      status: 200,
    });
  };

  await callMcp({
    endpoint: "https://mcp.jmrp.io/libgen",
    method: "tools/list",
    fetchImpl,
    signal: controller.signal,
  });

  assert.equal(seenSignal, controller.signal);
});

// The THREE kinds of failure, plus the success. The reason this exists is that
// two of the three arrive as HTTP 200 and, without looking inside them, were
// rendered exactly like a correct response.
test("classifyMcp: an HTTP != 2xx is a transport failure", () => {
  const verdict = classifyMcp({
    ok: false,
    status: 400,
    text: "no server available",
    bytes: 19,
    durationMs: 12,
  });
  assert.equal(verdict.outcome, "transport");
  assert.equal(verdict.code, 400);
  assert.match(verdict.message, /no server available/);
});

test("classifyMcp: an unreadable body is a transport failure too", () => {
  const verdict = classifyMcp({
    ok: true,
    status: 200,
    text: "JSON RPC not handled",
    bytes: 20,
    durationMs: 3,
    parseError: "Error: non-JSON body from the MCP server",
  });
  assert.equal(verdict.outcome, "transport");
});

test("classifyMcp: a JSON-RPC error carries its own code, not the HTTP one", () => {
  const verdict = classifyMcp({
    ok: true,
    status: 200,
    text: "",
    bytes: 0,
    durationMs: 5,
    body: {
      jsonrpc: "2.0",
      id: 1,
      error: { code: -32_602, message: "query is required" },
    },
  });
  assert.equal(verdict.outcome, "rpc");
  assert.equal(verdict.code, -32_602);
  assert.equal(verdict.message, "query is required");
});

test("classifyMcp: isError:true is a failure even when the HTTP is 200", () => {
  const verdict = classifyMcp({
    ok: true,
    status: 200,
    text: "",
    bytes: 0,
    durationMs: 5,
    body: {
      jsonrpc: "2.0",
      id: 1,
      result: {
        isError: true,
        content: [{ type: "text", text: "query is required" }],
      },
    },
  });
  assert.equal(verdict.outcome, "tool");
  assert.equal(verdict.message, "query is required");
});

test("classifyMcp: an ordinary result is a success", () => {
  const verdict = classifyMcp({
    ok: true,
    status: 200,
    text: "",
    bytes: 0,
    durationMs: 5,
    body: { jsonrpc: "2.0", id: 1, result: { tools: [] } },
  });
  assert.equal(verdict.outcome, "ok");
  assert.equal(verdict.message, "");
});

test("listedItems tells an empty list apart from no list at all", () => {
  assert.deepEqual(
    listedItems({ result: { tools: [{ name: "a" }, { name: "b" }] } }),
    {
      kind: "tools",
      count: 2,
    },
  );
  // Zero resources is a correct datum from the server, not a failure: the UI
  // has to be able to say "0 resources" instead of leaving an unexplained
  // `[]`.
  assert.deepEqual(listedItems({ result: { resources: [] } }), {
    kind: "resources",
    count: 0,
  });
  assert.equal(
    listedItems({ result: { protocolVersion: "2025-11-25" } }),
    undefined,
  );
  assert.equal(listedItems(undefined), undefined);
});

test("readableText takes the text out of a tools/call", () => {
  const body = {
    result: { content: [{ type: "text", text: "| a | b |" }] },
  };
  assert.equal(readableText(body), "| a | b |");
});

test("readableText concatenates several text blocks", () => {
  const body = {
    result: {
      content: [
        { type: "text", text: "uno" },
        { type: "image", data: "…" },
        { type: "text", text: "dos" },
      ],
    },
  };
  assert.equal(readableText(body), "uno\n\ndos");
});

test("readableText returns undefined when the JSON IS the answer", () => {
  // A tools/list or an error: there is nothing to lay out here, and offering
  // an empty reader view would hide the only answer there is.
  assert.equal(readableText({ result: { tools: [] } }), undefined);
  assert.equal(readableText({ error: { code: -32_600 } }), undefined);
  assert.equal(readableText(undefined), undefined);
});
