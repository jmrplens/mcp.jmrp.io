import { useEffect, useRef, useState } from "preact/hooks";

import {
  callMcp,
  classifyMcp,
  listedItems,
  type McpOutcome,
} from "../lib/mcp-client";
import {
  attempt,
  type DenyReason,
  initialLimiterState,
  type LimiterState,
} from "../lib/rate-limit";

/**
 * La máquina de peticiones del inspector: una llamada en vuelo como mucho, con
 * su estado, su reloj y su cancelación.
 *
 * Vive fuera del componente porque allí se mezclaba con el formulario —qué
 * servidor está elegido, qué cabeceras ha tecleado el visitante, qué tool— y
 * entre las dos cosas el componente pasaba de la complejidad cognitiva que
 * Sonar admite. Aquí queda "cómo se llama a un servidor MCP" y allí "qué
 * pinta el formulario", que además se pueden leer por separado.
 */

/** Resultado de una llamada, tal y como lo pinta la línea de estado. */
export type Status = {
  method: string;
  /** `running` mientras vuela; `client` si ni siquiera llegó a salir. */
  outcome: McpOutcome | "running" | "client";
  code?: number;
  ms?: number;
  bytes?: number;
  items?: { kind: string; count: number };
  message: string;
};

/**
 * Techo propio, por debajo del corte de Cloudflare (100 s, ver
 * /root/mcp_server_info.md).
 *
 * Que corte Cloudflare y que corte el inspector se ven igual de mal, pero solo
 * uno de los dos puede explicarse: si esperamos a los 100 s, el visitante
 * recibe una página de error del edge y concluye que el servidor devuelve
 * basura. Abandonando a los 90 s el mensaje lo escribimos nosotros.
 */
const TIMEOUT_MS = 90_000;

/** Textos que el hook necesita para redactar sus propios mensajes de error. */
export interface CallTexts {
  networkError: string;
  timedOut: string;
  cancelled: string;
  /** Braked for going too fast; `{s}` is the whole seconds left. */
  tooFast: string;
  /** Braked for too many in a row; `{s}` is the whole seconds left. */
  cooling: string;
}

export interface McpCall {
  /** Volcado que se pinta en el panel. */
  output: string;
  setOutput: (value: string) => void;
  /** Resumen de la última llamada, o `null` si aún no se ha lanzado ninguna. */
  status: Status | null;
  setStatus: (value: Status) => void;
  /** Hay una petición en vuelo. */
  busy: boolean;
  /** Segundos que lleva en vuelo. Sin esto, 6 s parecen colgarse. */
  elapsed: number;
  /** Último método lanzado, para la línea de prompt del panel. */
  lastCmd: string;
  /**
   * The last response's body, as an object.
   *
   * `output` already holds that body through `JSON.stringify`, which is good
   * for rendering but not for reading into. The reader view needs the object
   * to pull `result.content[]` out, so it is kept separately instead of
   * re-parsing the string we just produced.
   */
  lastBody: unknown;
  send: (
    endpoint: string,
    method: string,
    params: unknown,
    headers: Record<string, string>,
  ) => Promise<unknown>;
  cancel: () => void;
  /**
   * Seconds of block left, or 0 when there is none.
   *
   * Exposed so the buttons can switch off and say why, rather than leaving
   * someone pressing something that no longer goes anywhere.
   */
  cooldown: number;
}

/**
 * Estado y acciones para hablar con un servidor MCP.
 *
 * @param texts Mensajes de error, ya traducidos.
 * @returns La llamada en curso y las acciones para lanzarla o abortarla.
 */
export function useMcpCall(texts: CallTexts): McpCall {
  const [output, setOutput] = useState("");
  const [status, setStatus] = useState<Status | null>(null);
  const [busy, setBusy] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [lastCmd, setLastCmd] = useState("");
  const [lastBody, setLastBody] = useState<unknown>(undefined);
  /** Petición en vuelo, para poder cancelarla desde el botón. */
  const abortRef = useRef<AbortController | null>(null);
  /**
   * The brake's state. In a ref rather than component state because it
   * changes on every attempt and none of those changes needs to repaint
   * anything — the only thing rendered is the countdown below.
   */
  const limiterRef = useRef<LimiterState>(initialLimiterState);
  const [cooldown, setCooldown] = useState(0);

  // The block's countdown, in seconds, for as long as it lasts.
  useEffect(() => {
    if (cooldown <= 0) return;
    const id = setInterval(() => setCooldown((n) => Math.max(0, n - 1)), 1000);
    return () => clearInterval(id);
  }, [cooldown]);

  // El contador de segundos solo existe mientras hay algo en vuelo.
  useEffect(() => {
    if (!busy) return;
    const id = setInterval(() => setElapsed((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, [busy]);

  function cancel() {
    abortRef.current?.abort();
  }

  /**
   * Lanza una llamada y deja el estado listo para pintarse.
   *
   * @param endpoint URL del servidor MCP.
   * @param method Método JSON-RPC.
   * @param params Parámetros del método.
   * @param headers Cabeceras de autenticación del servidor activo.
   * @returns El cuerpo de la respuesta, o `undefined` si falló.
   */
  async function send(
    endpoint: string,
    method: string,
    params: unknown,
    headers: Record<string, string>,
  ): Promise<unknown> {
    // The brake, before anything else: this is the only place a request to
    // an MCP server goes out from, so checking it here is enough. See
    // `rate-limit.ts` for what this guards against and what it does not.
    const now = Date.now();
    const verdict = attempt(limiterRef.current, now, method);
    limiterRef.current = verdict.state;
    if (!verdict.allowed) {
      const seconds = Math.ceil(verdict.retryAfterMs / 1000);
      const template: Record<DenyReason, string> = {
        gap: texts.tooFast,
        burst: texts.cooling,
        cooldown: texts.cooling,
      };
      const message = template[verdict.reason].replace("{s}", () =>
        String(seconds),
      );
      if (verdict.reason !== "gap") setCooldown(seconds);
      setStatus({ method, outcome: "client", message });
      setLastBody(undefined);
      setOutput(message);
      return undefined;
    }

    const controller = new AbortController();
    abortRef.current = controller;
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, TIMEOUT_MS);

    setBusy(true);
    setElapsed(0);
    setLastCmd(method);
    // La salida anterior NO se borra: se atenúa. Borrarla dejaba al visitante
    // mirando un panel vacío durante los segundos que tarda la respuesta,
    // habiendo perdido lo que estaba leyendo.
    setStatus({ method, outcome: "running", message: "" });

    try {
      const res = await callMcp({
        endpoint,
        method,
        params,
        headers,
        signal: controller.signal,
      });
      const verdict = classifyMcp(res);
      setLastBody(res.body);
      setOutput(res.body ? JSON.stringify(res.body, null, 2) : res.text);
      setStatus({
        method,
        outcome: verdict.outcome,
        code: verdict.code,
        ms: res.durationMs,
        bytes: res.bytes,
        items: listedItems(res.body),
        message: verdict.message,
      });
      return res.body;
    } catch (error) {
      const aborted = controller.signal.aborted;
      let message = `${texts.networkError}: ${String(error)}`;
      if (aborted) message = timedOut ? texts.timedOut : texts.cancelled;
      setStatus({ method, outcome: "client", message });
      setLastBody(undefined);
      setOutput(message);
      return undefined;
    } finally {
      clearTimeout(timer);
      abortRef.current = null;
      setBusy(false);
    }
  }

  return {
    output,
    setOutput,
    status,
    setStatus,
    busy,
    elapsed,
    lastCmd,
    lastBody,
    send,
    cancel,
    cooldown,
  };
}
