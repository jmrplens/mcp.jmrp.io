/**
 * Cliente MCP mínimo para el inspector.
 *
 * Los servidores sirven streamable HTTP y responden `text/event-stream`
 * (`event: message\ndata: {...}`), así que `res.json()` falla: hay que
 * quedarse con la última línea `data:`. Se acepta también JSON plano por si
 * algún servidor se arranca con --json-response.
 *
 * GET devuelve 405 en modo stateless: aquí siempre se usa POST.
 *
 * `callMcp` NO lanza cuando el servidor contesta mal. Devuelve siempre un
 * `McpResponse` con el código, el tiempo y el tamaño, y es `classifyMcp` quien
 * decide de qué clase es el fallo. La razón es que hay TRES clases de fallo y
 * dos de ellas llegan como HTTP 200: un `error` JSON-RPC, y —la peor— un
 * `result` con `isError: true`, que sin mirarlo por dentro es indistinguible
 * de un acierto. Lanzando un string se perdía esa distinción y el inspector
 * pintaba los tres casos, y el éxito, exactamente igual.
 *
 * Sin dependencias del DOM a propósito: se testea con `node --test` y se
 * le puede inyectar `fetchImpl` para no tocar la red.
 */

/** Cuerpo JSON-RPC 2.0, en la parte que le importa al inspector. */
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
   * Cabeceras extra (p. ej. `Authorization: Bearer …`). Nunca se registran ni
   * se guardan. El esquema lo compone quien llama: aquí llega ya el valor
   * completo de la cabecera, no la credencial suelta.
   */
  headers?: Record<string, string>;
  fetchImpl?: typeof fetch;
  /** Para cancelar desde la interfaz y para el timeout de cliente. */
  signal?: AbortSignal;
};

/** Cuanto se sabe de una respuesta, incluido lo que no es su cuerpo. */
export type McpResponse = {
  ok: boolean;
  status: number;
  /** Cuerpo JSON-RPC parseado. `undefined` si el cuerpo no era JSON. */
  body?: JsonRpcBody;
  /** El cuerpo tal cual llegó, para poder enseñar un error de transporte. */
  text: string;
  /** Tamaño del cuerpo en bytes (UTF-8), no en caracteres. */
  bytes: number;
  durationMs: number;
  /** Por qué no se pudo parsear el cuerpo, si es que no se pudo. */
  parseError?: string;
};

/**
 * De qué clase es el resultado.
 *
 * - `ok`: el servidor hizo lo que se le pidió.
 * - `transport`: no hubo respuesta JSON-RPC (HTTP != 2xx, o cuerpo ilegible).
 * - `rpc`: hubo respuesta y trae `error` (método desconocido, params inválidos…).
 * - `tool`: la tool se ejecutó y falló (`result.isError`). Llega como HTTP 200.
 */
export type McpOutcome = "ok" | "transport" | "rpc" | "tool";

/** Veredicto sobre una respuesta, con el dato del protocolo que lo justifica. */
export type McpVerdict = {
  outcome: McpOutcome;
  /** Código: HTTP si es de transporte, JSON-RPC (-32602…) si es `rpc`. */
  code?: number;
  /** Mensaje del servidor, ya recortado. Vacío si no dio ninguno. */
  message: string;
};

/** Extrae el objeto JSON-RPC de una respuesta SSE (o de JSON plano). */
export function parseSseJsonRpc(text: string): unknown {
  const trimmed = text.trim();
  if (trimmed.startsWith("{")) return JSON.parse(trimmed);

  const dataLines = trimmed
    .split("\n")
    .filter((l) => l.startsWith("data:"))
    .map((l) => l.slice(5).trim())
    .filter(Boolean);

  // Se comprueba `last` en vez de `dataLines.length`: son equivalentes en
  // runtime, pero `.at(-1)` devuelve `string | undefined` y solo esta forma
  // estrecha el tipo. Con la comprobación por longitud, TypeScript seguía
  // viendo un posible `undefined` en JSON.parse.
  const last = dataLines.at(-1);
  if (last === undefined) {
    throw new Error(
      `respuesta no JSON del servidor MCP: ${trimmed.slice(0, 200)}`,
    );
  }
  return JSON.parse(last);
}

/** Bytes UTF-8 de un texto: lo que de verdad viajó, no cuántos caracteres son. */
function byteLength(text: string): number {
  return new TextEncoder().encode(text).length;
}

/**
 * Envía un método JSON-RPC al endpoint MCP.
 *
 * Solo rechaza si la petición no llega a completarse: fallo de red, o
 * cancelación (`AbortError`). Un servidor que contesta 400, o 200 con un
 * error dentro, devuelve un `McpResponse` normal — mirarlo es trabajo de
 * `classifyMcp`.
 *
 * @param opts Endpoint, método, parámetros y cabeceras de la llamada.
 * @returns La respuesta con código, cuerpo, tamaño y duración.
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
    // Un cuerpo ilegible no es una excepción del inspector: es un dato sobre
    // el servidor, y hay que poder enseñarlo junto al código y al tiempo.
    return { ...base, parseError: String(error) };
  }
}

/** Primer texto del `content` de un resultado de tool, si lo hay. */
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
 * Decide de qué clase es una respuesta.
 *
 * El orden importa: primero el transporte (si no hay JSON-RPC no hay nada más
 * que mirar), luego el `error` del sobre, y solo al final el `isError` de la
 * tool, que es el que se colaba como éxito.
 *
 * @param res La respuesta devuelta por `callMcp`.
 * @returns Clase del resultado, con código y mensaje del servidor.
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

/** Lo que se ha listado y cuántos, para el resumen de una línea. */
export type ListedItems = { kind: string; count: number };

/**
 * Cuenta lo que trae un método de listado.
 *
 * Sirve para poder decir «0 resources» en vez de dejar un `[]` en pantalla que
 * el visitante no sabe si es correcto o es que algo está roto.
 *
 * @param body Cuerpo JSON-RPC ya parseado.
 * @returns Qué se listó y cuántos elementos, o `undefined` si no era un listado.
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
