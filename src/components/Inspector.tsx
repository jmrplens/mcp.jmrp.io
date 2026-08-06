import "./Inspector.css";

import { useEffect, useRef, useState } from "preact/hooks";

import type { McpServer } from "../data/servers";
import { type Lang, ui } from "../i18n/ui";
import {
  callMcp,
  classifyMcp,
  listedItems,
  type McpOutcome,
} from "../lib/mcp-client";
import { type McpTool, schemaFields, skeletonFor, toolsFrom } from "../lib/tool-schema";

/**
 * Isla Preact que introspecciona y ejercita los servidores MCP desde el
 * navegador.
 *
 * La lista de servidores llega por prop para que siga teniendo una única
 * fuente de verdad: `src/data/servers.ts`. `lang` también, porque las
 * etiquetas de campo y los mensajes de error SÍ son texto de interfaz de un
 * sitio bilingüe; lo que no se traduce son los identificadores del protocolo
 * (nombres de método, de cabecera y de tool), que son literalmente lo que hay
 * que teclear en un cliente MCP.
 *
 * REGLA QUE NO SE PUEDE ROMPER: los valores de las cabeceras (el token de
 * GitLab entre ellos) viven SOLO en el estado del componente. Nada de
 * localStorage, sessionStorage, cookies, query string ni console.log: al
 * recargar tienen que desaparecer.
 */

const METHODS = [
  "initialize",
  "tools/list",
  "prompts/list",
  "resources/list",
] as const;

/**
 * `initialize` es el único método que necesita parámetros: sin ellos el
 * servidor responde -32602. La versión es la del protocolo que hablan estos
 * servidores; si el servidor soporta otra, negocia y devuelve la suya.
 */
const INIT_PARAMS = {
  protocolVersion: "2026-07-28",
  capabilities: {},
  clientInfo: { name: "mcp.jmrp.io inspector", version: "1" },
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

/** Lo que se sabe del último envío, para la línea de estado sobre el panel. */
type Status = {
  method: string;
  /** `running` mientras vuela; `client` si ni siquiera llegó a salir. */
  outcome: McpOutcome | "running" | "client";
  code?: number;
  ms?: number;
  bytes?: number;
  items?: { kind: string; count: number };
  message: string;
};

/** Duración legible: milisegundos por debajo del segundo, segundos por encima. */
function formatMs(ms: number): string {
  return ms < 1000 ? `${ms} ms` : `${(ms / 1000).toFixed(1)} s`;
}

/** Tamaño legible del cuerpo de la respuesta. */
function formatBytes(bytes: number): string {
  return bytes < 1024 ? `${bytes} B` : `${(bytes / 1024).toFixed(1)} kB`;
}

/**
 * Isla interactiva que habla con los servidores MCP desde el navegador del
 * visitante: introspección (initialize, tools/list, prompts/list,
 * resources/list) y ejecución de tools.
 *
 * El token de GitLab que se teclea aquí vive SOLO en el estado de este
 * componente: no se escribe en localStorage ni sessionStorage, no viaja en la
 * URL y desaparece al recargar.
 *
 * @param props.servers Lista de servidores, desde `src/data/servers.ts`.
 * @param props.lang Idioma de la página que monta la isla.
 * @returns El panel del inspector.
 */
export default function Inspector({
  servers,
  lang,
}: Readonly<{ servers: McpServer[]; lang: Lang }>) {
  const t = ui[lang].insp;
  const [serverId, setServerId] = useState(servers[0]?.id ?? "");
  const [output, setOutput] = useState("");
  const [busy, setBusy] = useState(false);
  /** Segundos que lleva la petición en vuelo. Sin esto, 6 s parecen colgarse. */
  const [elapsed, setElapsed] = useState(0);
  /**
   * Valores de las cabeceras, en memoria y nada más. La clave lleva el id del
   * servidor por delante: si dos MCP declarasen una cabecera con el mismo
   * nombre, una clave compartida mandaría el secreto de uno al otro.
   */
  const [headerValues, setHeaderValues] = useState<Record<string, string>>({});
  /** Catálogo del servidor activo. Se llena con la respuesta de `tools/list`. */
  const [tools, setTools] = useState<McpTool[]>([]);
  const [toolName, setToolName] = useState("");
  const [toolArgs, setToolArgs] = useState("{}");
  /** Último método lanzado, para pintar la línea de prompt del panel. */
  const [lastCmd, setLastCmd] = useState("");
  const [status, setStatus] = useState<Status | null>(null);
  /** Aviso efímero del botón de copiar. */
  const [copyNote, setCopyNote] = useState("");
  /** Petición en vuelo, para poder cancelarla desde el botón. */
  const abortRef = useRef<AbortController | null>(null);

  const server = servers.find((s) => s.id === serverId) ?? servers[0];
  const fields = server
    ? [...server.requiredHeaders, ...server.optionalHeaders]
    : [];

  const keyOf = (headerName: string) => `${server?.id ?? ""}:${headerName}`;

  /**
   * Cabeceras obligatorias que siguen vacías.
   *
   * Sin esto, gitlab sin token devuelve un 400 con el texto literal del
   * upstream, «no server available», que se lee como «el servidor está caído»
   * — la conclusión exactamente equivocada. El dato para evitarlo ya estaba en
   * `servers.ts`.
   */
  const missing = (server?.requiredHeaders ?? []).filter(
    (h) => !headerValues[keyOf(h.name)]?.trim(),
  );
  const blocked = missing.length > 0;

  const selectedTool = tools.find((tool) => tool.name === toolName);
  const schemaRows = schemaFields(selectedTool?.inputSchema);

  // El contador de segundos solo existe mientras hay algo en vuelo.
  useEffect(() => {
    if (!busy) return;
    const id = setInterval(() => setElapsed((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, [busy]);

  /** Solo las cabeceras del servidor activo, y solo las que tienen valor. */
  function authHeaders(): Record<string, string> {
    const headers: Record<string, string> = {};
    for (const field of fields) {
      const value = headerValues[keyOf(field.name)]?.trim();
      if (value) headers[field.name] = value;
    }
    return headers;
  }

  /**
   * Cambiar de servidor tira el catálogo y los argumentos.
   *
   * Dejar las tools del servidor anterior sería peor que no tener lista: el
   * selector ofrecería nombres que este otro servidor no implementa.
   */
  function chooseServer(id: string) {
    setServerId(id);
    setTools([]);
    setToolName("");
    setToolArgs("{}");
  }

  /** Elegir tool prerrellena el textarea con sus argumentos obligatorios. */
  function chooseTool(name: string) {
    setToolName(name);
    const tool = tools.find((entry) => entry.name === name);
    setToolArgs(skeletonFor(tool?.inputSchema));
  }

  async function send(method: string, params: unknown) {
    if (!server) return;

    const controller = new AbortController();
    abortRef.current = controller;
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, TIMEOUT_MS);

    setBusy(true);
    setElapsed(0);
    setCopyNote("");
    setLastCmd(method);
    // La salida anterior NO se borra: se atenúa. Borrarla dejaba al visitante
    // mirando un panel vacío durante los segundos que tarda la respuesta,
    // habiendo perdido lo que estaba leyendo.
    setStatus({ method, outcome: "running", message: "" });

    try {
      const res = await callMcp({
        endpoint: server.endpoint,
        method,
        params,
        headers: authHeaders(),
        signal: controller.signal,
      });
      const verdict = classifyMcp(res);
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
      // El catálogo se guarda aunque la llamada haya ido a otro sitio: solo
      // `tools/list` lo trae.
      if (method === "tools/list") setTools(toolsFrom(res.body));
    } catch (error) {
      const aborted = controller.signal.aborted;
      let message = `${t.networkError}: ${String(error)}`;
      if (aborted) message = timedOut ? t.timedOut : t.cancelled;
      setStatus({ method, outcome: "client", message });
      setOutput(message);
    } finally {
      clearTimeout(timer);
      abortRef.current = null;
      setBusy(false);
    }
  }

  async function run(method: string) {
    await send(method, method === "initialize" ? INIT_PARAMS : {});
  }

  async function runTool() {
    let args: unknown;
    try {
      args = JSON.parse(toolArgs || "{}");
    } catch (error) {
      // El JSON mal formado se avisa aquí: mandarlo al servidor solo devuelve
      // un -32700 mucho menos claro.
      const message = `${t.badJson}: ${String(error)}`;
      setStatus({ method: "tools/call", outcome: "client", message });
      setOutput(message);
      return;
    }
    await send("tools/call", { name: toolName, arguments: args });
  }

  async function copyOutput() {
    try {
      await navigator.clipboard.writeText(output);
      setCopyNote(t.copied);
    } catch {
      // Sin permiso de portapapeles (o sin contexto seguro) no hay nada que
      // hacer salvo decirlo: fallar en silencio deja al visitante creyendo
      // que ya lo tiene copiado.
      setCopyNote(t.copyFailed);
    }
  }

  /** Palabra del chip de estado, por clase de resultado. */
  const outcomeLabel: Record<Status["outcome"], string> = {
    running: t.running,
    ok: t.ok,
    transport: t.errTransport,
    rpc: t.errRpc,
    tool: t.errTool,
    client: t.errClient,
  };

  const failed = !!status && status.outcome !== "ok" && status.outcome !== "running";

  return (
    <section className="term" data-testid="inspector">
      {/* Barra de ventana: la misma pieza que la tarjeta de terminal de
          jmrp.io. Aquí no es decorativa — lo que hay debajo ES una consola
          JSON-RPC, así que la forma dice la verdad sobre la función. */}
      <header className="term-bar">
        <span className="lights" aria-hidden="true">
          <i></i>
          <i></i>
          <i></i>
        </span>
        <span className="term-title">~/mcp — {server?.name ?? "—"}</span>
        <button
          type="button"
          className="term-copy"
          disabled={!output}
          onClick={() => {
            void copyOutput();
          }}
        >
          {t.copy}
        </button>
      </header>

      <div className="term-body">
        <div className="row">
          <label className="field" for="mcp-server">
            <span>{t.server}</span>
            <select
              id="mcp-server"
              value={serverId}
              onChange={(e) => chooseServer((e.target as HTMLSelectElement).value)}
            >
              {servers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </label>

          {fields.map((field) => {
            const isRequired = (server?.requiredHeaders ?? []).includes(field);
            return (
              <label className="field" key={keyOf(field.name)} for={`mcp-h-${field.name}`}>
                <span>
                  {field.name}
                  {isRequired ? <b aria-hidden="true"> *</b> : null}
                </span>
                <input
                  id={`mcp-h-${field.name}`}
                  type={field.secret ? "password" : "text"}
                  autocomplete="off"
                  spellcheck={false}
                  required={isRequired}
                  aria-required={isRequired ? "true" : undefined}
                  placeholder={field.placeholder}
                  value={headerValues[keyOf(field.name)] ?? ""}
                  onInput={(e) => {
                    const value = (e.target as HTMLInputElement).value;
                    setHeaderValues((prev) => ({
                      ...prev,
                      [keyOf(field.name)]: value,
                    }));
                  }}
                />
              </label>
            );
          })}
        </div>

        {blocked ? (
          <p className="need-header" data-testid="inspector-missing-header">
            <code>{missing.map((h) => h.name).join(", ")}</code> {t.missingHeader}
          </p>
        ) : null}

        <div className="methods">
          {METHODS.map((m) => (
            <button
              key={m}
              type="button"
              disabled={busy || blocked}
              aria-busy={busy && lastCmd === m ? "true" : undefined}
              onClick={() => {
                void run(m);
              }}
            >
              {m}
            </button>
          ))}
          {busy ? (
            <button
              type="button"
              className="danger"
              data-testid="inspector-cancel"
              onClick={() => abortRef.current?.abort()}
            >
              {t.cancel} · {elapsed} s
            </button>
          ) : null}
        </div>

        {/* Un <form> de verdad: Enter en el campo de la tool lanza la llamada,
            que es el gesto que cualquiera intenta primero en una consola. */}
        <form
          className="row row-tool"
          onSubmit={(e) => {
            e.preventDefault();
            void runTool();
          }}
        >
          <label className="field" for="mcp-tool">
            <span>{t.tool}</span>
            {tools.length > 0 ? (
              <select
                id="mcp-tool"
                value={toolName}
                onChange={(e) => chooseTool((e.target as HTMLSelectElement).value)}
              >
                <option value="">{t.chooseTool}</option>
                {tools.map((tool) => (
                  <option key={tool.name} value={tool.name}>
                    {tool.name}
                  </option>
                ))}
              </select>
            ) : (
              <input
                id="mcp-tool"
                type="text"
                autocomplete="off"
                spellcheck={false}
                placeholder="search"
                value={toolName}
                onInput={(e) => setToolName((e.target as HTMLInputElement).value)}
              />
            )}
          </label>
          <label className="field field-args" for="mcp-args">
            <span>{t.args}</span>
            <textarea
              id="mcp-args"
              rows={3}
              spellcheck={false}
              value={toolArgs}
              onInput={(e) => setToolArgs((e.target as HTMLTextAreaElement).value)}
              onKeyDown={(e) => {
                // Enter tiene que seguir insertando salto de línea en un
                // textarea; el atajo es el de siempre para "enviar esto".
                if (e.key !== "Enter" || !(e.ctrlKey || e.metaKey)) return;
                e.preventDefault();
                void runTool();
              }}
            />
          </label>
          <button
            type="submit"
            className="primary"
            disabled={busy || blocked || !toolName.trim()}
          >
            tools/call
          </button>
        </form>

        {tools.length === 0 ? (
          <p className="tool-hint">{t.toolListHint}</p>
        ) : null}

        {/* El inputSchema que el servidor ya devuelve, enseñado donde sirve.
            Sin esto había que leer las ~1000 líneas del volcado de tools/list
            para saber qué acepta la tool, y los servidores validan estricto:
            adivinar falla siempre. */}
        {selectedTool ? (
          <div className="schema" data-testid="inspector-schema">
            <p className="schema-head">
              <code>{selectedTool.name}</code>
              {selectedTool.description ? <span> — {selectedTool.description}</span> : null}
            </p>
            {schemaRows.length > 0 ? (
              <table>
                <caption>{t.schemaTitle}</caption>
                <thead>
                  <tr>
                    <th scope="col">{t.colName}</th>
                    <th scope="col">{t.colType}</th>
                    <th scope="col">{t.colWhat}</th>
                  </tr>
                </thead>
                <tbody>
                  {schemaRows.map((row) => (
                    <tr key={row.name} className={row.required ? "is-required" : undefined}>
                      <th scope="row">
                        <code>{row.name}</code>
                      </th>
                      <td>
                        <code>{row.type}</code>
                        <span className="req">
                          {row.required ? t.required : t.optional}
                        </span>
                      </td>
                      <td>{row.description}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p>{t.schemaEmpty}</p>
            )}
          </div>
        ) : null}
      </div>

      {/* Resumen corto y ANUNCIABLE. El aria-live vivía en el <pre>, así que un
          lector de pantalla leía los 43.000 caracteres del volcado de una
          tacada, y dos veces por acción. Aquí caben cuatro datos. */}
      <p
        className={`term-status is-${status?.outcome ?? "idle"}`}
        role="status"
        data-testid="inspector-status"
      >
        {status ? (
          <>
            <span className="chip">{outcomeLabel[status.outcome]}</span>
            <code>{status.method}</code>
            {status.code === undefined ? null : <span>· {status.code}</span>}
            {status.ms === undefined ? null : <span>· {formatMs(status.ms)}</span>}
            {status.bytes === undefined ? null : <span>· {formatBytes(status.bytes)}</span>}
            {status.items ? (
              <span>
                · {status.items.count} {status.items.kind}
              </span>
            ) : null}
            {status.message ? <span className="msg">· {status.message}</span> : null}
          </>
        ) : (
          <span>{t.statusIdle}</span>
        )}
        {copyNote ? <span className="msg">· {copyNote}</span> : null}
      </p>

      {/* aria-live="off" a propósito: quien anuncia es la línea de estado de
          arriba. tabindex + role + nombre para que el panel, que tiene scroll
          propio, esté SIEMPRE en el orden de tabulación y con nombre — Chrome
          lo hacía enfocable solo cuando el contenido desbordaba. */}
      <pre
        className={`term-out${busy ? " is-stale" : ""}${failed ? " is-error" : ""}`}
        data-testid="inspector-output"
        aria-live="off"
        tabIndex={0}
        role="region"
        aria-label={t.responseLabel}
      >
        {lastCmd ? `jmrp@mcp:~$ ${lastCmd}\n` : ""}
        {output}
      </pre>
    </section>
  );
}
