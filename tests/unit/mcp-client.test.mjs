import assert from "node:assert/strict";
import { test } from "node:test";

import {
  callMcp,
  classifyMcp,
  listedItems,
  parseSseJsonRpc,
} from "../../src/lib/mcp-client.ts";

test("extrae el JSON-RPC de una respuesta SSE", () => {
  const sse = 'event: message\ndata: {"jsonrpc":"2.0","id":1,"result":{"ok":true}}\n\n';
  assert.deepEqual(parseSseJsonRpc(sse), { jsonrpc: "2.0", id: 1, result: { ok: true } });
});

test("acepta JSON plano por si el servidor responde application/json", () => {
  assert.deepEqual(parseSseJsonRpc('{"jsonrpc":"2.0","id":1,"result":{}}'), {
    jsonrpc: "2.0",
    id: 1,
    result: {},
  });
});

test("usa el último data: cuando hay varios eventos", () => {
  const sse = 'data: {"id":1}\n\ndata: {"id":2}\n\n';
  assert.equal(parseSseJsonRpc(sse).id, 2);
});

test("lanza un error legible si no hay JSON", () => {
  assert.throws(() => parseSseJsonRpc("JSON RPC not handled"), /respuesta no JSON/i);
});

test("callMcp hace POST con el sobre JSON-RPC y las cabeceras del transporte", async () => {
  let seen;
  const fetchImpl = async (url, init) => {
    seen = { url, init };
    return new Response('data: {"jsonrpc":"2.0","id":1,"result":{"tools":[]}}\n\n', {
      status: 200,
      headers: { "content-type": "text/event-stream" },
    });
  };

  const result = await callMcp({
    endpoint: "https://mcp.jmrp.io/gitlab",
    method: "tools/list",
    headers: { "PRIVATE-TOKEN": "glpat-x" },
    fetchImpl,
  });

  assert.deepEqual(result.body, { jsonrpc: "2.0", id: 1, result: { tools: [] } });
  assert.equal(result.ok, true);
  assert.equal(result.status, 200);
  assert.ok(result.bytes > 0, "el tamaño del cuerpo es un dato que la UI enseña");
  assert.equal(typeof result.durationMs, "number");
  assert.equal(seen.url, "https://mcp.jmrp.io/gitlab");
  assert.equal(seen.init.method, "POST");
  assert.equal(seen.init.headers.Accept, "application/json, text/event-stream");
  assert.equal(seen.init.headers["PRIVATE-TOKEN"], "glpat-x");
  assert.deepEqual(JSON.parse(seen.init.body), {
    jsonrpc: "2.0",
    id: 1,
    method: "tools/list",
    params: {},
  });
});

test("callMcp devuelve el código y el cuerpo en vez de lanzar", async () => {
  const fetchImpl = async () => new Response("Missing PRIVATE-TOKEN header", { status: 401 });
  const res = await callMcp({
    endpoint: "https://mcp.jmrp.io/gitlab",
    method: "tools/list",
    fetchImpl,
  });

  assert.equal(res.ok, false);
  assert.equal(res.status, 401);
  assert.equal(res.text, "Missing PRIVATE-TOKEN header");
  assert.equal(res.body, undefined);
});

test("callMcp pasa el signal al fetch, que es lo que permite cancelar", async () => {
  let seenSignal;
  const controller = new AbortController();
  const fetchImpl = async (_url, init) => {
    seenSignal = init.signal;
    return new Response('data: {"jsonrpc":"2.0","id":1,"result":{}}\n\n', { status: 200 });
  };

  await callMcp({
    endpoint: "https://mcp.jmrp.io/libgen",
    method: "tools/list",
    fetchImpl,
    signal: controller.signal,
  });

  assert.equal(seenSignal, controller.signal);
});

// Las TRES clases de fallo, más el acierto. La razón de que esto exista es que
// dos de las tres llegan como HTTP 200 y, sin mirarlas por dentro, se pintaban
// exactamente igual que una respuesta correcta.
test("classifyMcp: un HTTP != 2xx es un fallo de transporte", () => {
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

test("classifyMcp: un cuerpo ilegible también es fallo de transporte", () => {
  const verdict = classifyMcp({
    ok: true,
    status: 200,
    text: "JSON RPC not handled",
    bytes: 20,
    durationMs: 3,
    parseError: "Error: respuesta no JSON del servidor MCP",
  });
  assert.equal(verdict.outcome, "transport");
});

test("classifyMcp: un error JSON-RPC lleva su código, no el HTTP", () => {
  const verdict = classifyMcp({
    ok: true,
    status: 200,
    text: "",
    bytes: 0,
    durationMs: 5,
    body: { jsonrpc: "2.0", id: 1, error: { code: -32_602, message: "query is required" } },
  });
  assert.equal(verdict.outcome, "rpc");
  assert.equal(verdict.code, -32_602);
  assert.equal(verdict.message, "query is required");
});

test("classifyMcp: isError:true es un fallo aunque el HTTP sea 200", () => {
  const verdict = classifyMcp({
    ok: true,
    status: 200,
    text: "",
    bytes: 0,
    durationMs: 5,
    body: {
      jsonrpc: "2.0",
      id: 1,
      result: { isError: true, content: [{ type: "text", text: "query is required" }] },
    },
  });
  assert.equal(verdict.outcome, "tool");
  assert.equal(verdict.message, "query is required");
});

test("classifyMcp: un resultado normal es un acierto", () => {
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

test("listedItems distingue una lista vacía de que no haya lista", () => {
  assert.deepEqual(listedItems({ result: { tools: [{ name: "a" }, { name: "b" }] } }), {
    kind: "tools",
    count: 2,
  });
  // Cero recursos es un dato correcto del servidor, no un fallo: la UI tiene
  // que poder decir "0 resources" en vez de dejar un `[]` sin explicar.
  assert.deepEqual(listedItems({ result: { resources: [] } }), {
    kind: "resources",
    count: 0,
  });
  assert.equal(listedItems({ result: { protocolVersion: "2025-11-25" } }), undefined);
  assert.equal(listedItems(undefined), undefined);
});
