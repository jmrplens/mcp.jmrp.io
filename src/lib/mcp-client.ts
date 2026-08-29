/**
 * A minimal MCP client for the inspector.
 *
 * The servers speak streamable HTTP and answer `text/event-stream`
 * (`event: message\ndata: {...}`), so `res.json()` fails: the last `data:`
 * line is what has to be kept. Plain JSON is accepted too, in case a server
 * is started with --json-response.
 *
 * A GET is rejected in stateless mode: POST is always used here.
 *
 * `callMcp` does NOT throw when the server answers badly. It always returns an
 * `McpResponse` with the code, the timing and the size, and `classifyMcp` is
 * what decides which kind of failure it was. The reason is that there are
 * THREE kinds of failure and two of them arrive as HTTP 200: a JSON-RPC
 * `error`, and — the worst — a `result` with `isError: true`, which without
 * looking inside is indistinguishable from a success. Throwing a string lost
 * that distinction and the inspector painted all three cases, and success,
 * exactly the same.
 *
 * No DOM dependencies, on purpose: it is tested with `node --test` and
 * `fetchImpl` can be injected to keep the network out of it.
 */

/** A JSON-RPC 2.0 body, in the part the inspector cares about. */
export type JsonRpcBody = {
  jsonrpc?: string;
  id?: unknown;
  result?: Record<string, unknown>;
  error?: { code?: number; message?: string; data?: unknown };
};

export type CallMcpOptions = {
  endpoint: string;
  method: string;
  params?: unknown;
  /**
   * Extra headers (for instance `Authorization: Bearer …`). Never logged and
   * never stored. The caller composes the scheme: what arrives here is the
   * complete header value, not the bare credential.
   */
  headers?: Record<string, string>;
  fetchImpl?: typeof fetch;
  /** For cancelling from the interface and for the client-side timeout. */
  signal?: AbortSignal;
};

/** Everything known about a response, including what is not its body. */
export type McpResponse = {
  ok: boolean;
  status: number;
  /** The parsed JSON-RPC body. `undefined` when the body was not JSON. */
  body?: JsonRpcBody;
  /** The body exactly as it arrived, so a transport error can be shown. */
  text: string;
  /** The body's size in bytes (UTF-8), not in characters. */
  bytes: number;
  durationMs: number;
  /** Why the body could not be parsed, when it could not. */
  parseError?: string;
};

/**
 * What kind of result this is.
 *
 * - `ok`: the server did what it was asked.
 * - `transport`: there was no JSON-RPC response (HTTP != 2xx, or an unreadable
 *   body).
 * - `rpc`: there was a response and it carries `error` (unknown method,
 *   invalid params…).
 * - `tool`: the tool ran and failed (`result.isError`). Arrives as HTTP 200.
 */
export type McpOutcome = "ok" | "transport" | "rpc" | "tool";

/** The verdict on a response, with the protocol datum that justifies it. */
export type McpVerdict = {
  outcome: McpOutcome;
  /** The code: HTTP when it is transport, JSON-RPC (-32602…) when it is `rpc`. */
  code?: number;
  /** The server's message, already trimmed. Empty when it gave none. */
  message: string;
};

/** Pulls the JSON-RPC object out of an SSE response (or out of plain JSON). */
export function parseSseJsonRpc(text: string): unknown {
  const trimmed = text.trim();
  if (trimmed.startsWith("{")) return JSON.parse(trimmed);

  const dataLines = trimmed
    .split("\n")
    .filter((l) => l.startsWith("data:"))
    .map((l) => l.slice(5).trim())
    .filter(Boolean);

  // `last` is checked rather than `dataLines.length`: they are equivalent at
  // runtime, but `.at(-1)` returns `string | undefined` and only this form
  // narrows the type. With the length check, TypeScript still saw a possible
  // `undefined` at JSON.parse.
  const last = dataLines.at(-1);
  if (last === undefined) {
    throw new Error(
      `non-JSON body from the MCP server: ${trimmed.slice(0, 200)}`,
    );
  }
  return JSON.parse(last);
}

/** A text's UTF-8 bytes: what actually traveled, not how many characters. */
function byteLength(text: string): number {
  return new TextEncoder().encode(text).length;
}

/**
 * Sends a JSON-RPC method to the MCP endpoint.
 *
 * It only rejects when the request never completes: a network failure, or a
 * cancellation (`AbortError`). A server that answers 400, or 200 with an error
 * inside, returns an ordinary `McpResponse` — looking at it is `classifyMcp`'s
 * job.
 *
 * @param opts The call's endpoint, method, parameters and headers.
 * @returns The response with its code, body, size and duration.
 */
export async function callMcp(opts: CallMcpOptions): Promise<McpResponse> {
  const doFetch = opts.fetchImpl ?? fetch;
  const started = Date.now();
  const res = await doFetch(opts.endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json, text/event-stream",
      ...opts.headers,
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: opts.method,
      params: opts.params ?? {},
    }),
    signal: opts.signal,
  });

  const text = await res.text();
  const base = {
    ok: res.ok,
    status: res.status,
    text,
    bytes: byteLength(text),
    durationMs: Date.now() - started,
  };

  try {
    return { ...base, body: parseSseJsonRpc(text) as JsonRpcBody };
  } catch (error) {
    // An unreadable body is not an exception for the inspector: it is a fact
    // about the server, and it has to be shown next to the code and timing.
    return { ...base, parseError: String(error) };
  }
}

/** The first text in a tool result's `content`, when there is one. */
function firstContentText(result: Record<string, unknown> | undefined): string {
  const content = result?.content;
  if (!Array.isArray(content)) return "";
  for (const item of content) {
    if (typeof item !== "object" || item === null || !("text" in item))
      continue;
    const text = (item as { text?: unknown }).text;
    if (typeof text === "string" && text) return text;
  }
  return "";
}

/**
 * Decides what kind a response is.
 *
 * The order matters: transport first (with no JSON-RPC there is nothing else to
 * look at), then the envelope's `error`, and only last the tool's `isError`,
 * which is the one that used to slip through as a success.
 *
 * @param res The response `callMcp` returned.
 * @returns The result's kind, with the server's code and message.
 */
export function classifyMcp(res: McpResponse): McpVerdict {
  if (!res.ok) {
    return {
      outcome: "transport",
      code: res.status,
      message: res.text.trim().slice(0, 300),
    };
  }
  if (res.parseError !== undefined || res.body === undefined) {
    return {
      outcome: "transport",
      code: res.status,
      message: res.parseError ?? "",
    };
  }
  if (res.body.error) {
    return {
      outcome: "rpc",
      code: res.body.error.code,
      message: (res.body.error.message ?? "").slice(0, 300),
    };
  }
  if (res.body.result?.isError === true) {
    return {
      outcome: "tool",
      message: firstContentText(res.body.result).slice(0, 300),
    };
  }
  return { outcome: "ok", code: res.status, message: "" };
}

/** What was listed and how many, for the one-line summary. */
export type ListedItems = { kind: string; count: number };

/**
 * Counts what a listing method returned.
 *
 * It is what makes it possible to say "0 resources" instead of leaving a `[]`
 * on screen that the visitor cannot tell is correct or broken.
 *
 * @param body The parsed JSON-RPC body.
 * @returns What was listed and how many items, or `undefined` when it was not
 *   a listing.
 */
export function listedItems(
  body: JsonRpcBody | undefined,
): ListedItems | undefined {
  const result = body?.result;
  if (!result) return undefined;
  for (const kind of ["tools", "prompts", "resources", "resourceTemplates"]) {
    const list = result[kind];
    if (Array.isArray(list)) return { kind, count: list.length };
  }
  return undefined;
}

/**
 * Pulls the readable text out of a response, when it carries any.
 *
 * A `tools/call` answers `result.content[]`, and in practice what sits inside
 * is Markdown: libgen's `search` returns a table of download links. Serialized
 * as JSON that arrives with its newlines escaped and on a single line —
 * readable to a machine and to nobody else. This function is what lets the
 * inspector offer the response laid out and keep the JSON as the other view,
 * rather than as the only one.
 *
 * Returns `undefined` when there is nothing to lay out (a `tools/list`, a
 * JSON-RPC error): there, the JSON IS the answer, and pretending otherwise
 * would hide it.
 *
 * @param body The body `callMcp` returned.
 * @returns The blocks' concatenated text, or `undefined`.
 */
export function readableText(
  body: JsonRpcBody | undefined,
): string | undefined {
  const content = body?.result?.content;
  if (!Array.isArray(content)) return undefined;
  const parts = content
    .filter(
      (block): block is { type: string; text: string } =>
        typeof block === "object" &&
        block !== null &&
        (block as { type?: unknown }).type === "text" &&
        typeof (block as { text?: unknown }).text === "string",
    )
    .map((block) => block.text);
  return parts.length > 0 ? parts.join("\n\n") : undefined;
}
