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
 * The inspector's request machine: at most one call in flight, with its state,
 * its clock and its cancellation.
 *
 * It lives outside the component because in there it mixed with the form —
 * which server is picked, which headers the visitor typed, which tool — and
 * between the two the component went past the cognitive complexity Sonar
 * allows. What is left here is "how an MCP server is called" and there "what
 * the form renders", and the two can now be read separately.
 */

/** A call's result, exactly as the status line renders it. */
export type Status = {
  method: string;
  /** `running` while in flight; `client` when it never even left. */
  outcome: McpOutcome | "running" | "client";
  code?: number;
  ms?: number;
  bytes?: number;
  items?: { kind: string; count: number };
  message: string;
};

/**
 * Our own ceiling, below Cloudflare's cut-off (100 s, see
 * /root/mcp_server_info.md).
 *
 * Cloudflare cutting and the inspector cutting look equally bad, but only one
 * of the two can be explained: waiting for 100 s hands the visitor an edge
 * error page and they conclude the server returns garbage. Giving up at 90 s
 * means we write the message.
 */
const TIMEOUT_MS = 90_000;

/** The texts the hook needs to write its own error messages. */
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
  /** The dump rendered in the panel. */
  output: string;
  setOutput: (value: string) => void;
  /** The last call's summary, or `null` when none has been fired yet. */
  status: Status | null;
  setStatus: (value: Status) => void;
  /** A request is in flight. */
  busy: boolean;
  /** Seconds it has been in flight. Without this, 6 s feels like a hang. */
  elapsed: number;
  /** The last method fired, for the panel's prompt line. */
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
 * State and actions for talking to an MCP server.
 *
 * @param texts Error messages, already translated.
 * @returns The call in progress and the actions to fire or abort it.
 */
export function useMcpCall(texts: CallTexts): McpCall {
  const [output, setOutput] = useState("");
  const [status, setStatus] = useState<Status | null>(null);
  const [busy, setBusy] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [lastCmd, setLastCmd] = useState("");
  const [lastBody, setLastBody] = useState<unknown>(undefined);
  /** The request in flight, so the button can cancel it. */
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

  // The seconds counter only exists while something is in flight.
  useEffect(() => {
    if (!busy) return;
    const id = setInterval(() => setElapsed((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, [busy]);

  function cancel() {
    abortRef.current?.abort();
  }

  /**
   * Fires a call and leaves the state ready to render.
   *
   * @param endpoint The MCP server's URL.
   * @param method The JSON-RPC method.
   * @param params The method's parameters.
   * @param headers The active server's authentication headers.
   * @returns The response body, or `undefined` when it failed.
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
    // The previous output is NOT cleared: it dims. Clearing it left the visitor
    // staring at an empty panel for however long the response takes, having
    // lost what they were reading.
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
