import "./Inspector.css";

import { useState } from "preact/hooks";

import type { McpServer } from "../data/servers";
import { type Lang, ui } from "../i18n/ui";
import {
  type McpPrompt,
  type McpResource,
  promptSchema,
  promptsFrom,
  resourcesFrom,
} from "../lib/mcp-catalog";
import {
  formFields,
  type McpTool,
  skeletonFor,
  toolsFrom,
  valuesToArgs,
} from "../lib/tool-schema";
import { Catalog, InvokePanel, StatusLine } from "./inspector-parts";
import { useMcpCall } from "./use-mcp-call";

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

/** Las tres cosas que un servidor MCP puede ofrecer, más el saludo. */
type Tab = "tools" | "prompts" | "resources";
const TABS: Tab[] = ["tools", "prompts", "resources"];

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
  const call = useMcpCall({
    networkError: t.networkError,
    timedOut: t.timedOut,
    cancelled: t.cancelled,
  });
  const { output, status, busy, elapsed, lastCmd } = call;
  const [serverId, setServerId] = useState(servers[0]?.id ?? "");
  /**
   * Valores de las cabeceras, en memoria y nada más. La clave lleva el id del
   * servidor por delante: si dos MCP declarasen una cabecera con el mismo
   * nombre, una clave compartida mandaría el secreto de uno al otro.
   */
  const [headerValues, setHeaderValues] = useState<Record<string, string>>({});
  const [tab, setTab] = useState<Tab>("tools");
  /** Catálogos del servidor activo. Se llenan con cada `list`. */
  const [tools, setTools] = useState<McpTool[]>([]);
  const [prompts, setPrompts] = useState<McpPrompt[]>([]);
  const [resources, setResources] = useState<McpResource[]>([]);
  const [toolName, setToolName] = useState("");
  const [promptName, setPromptName] = useState("");
  const [resourceUri, setResourceUri] = useState("");
  /** Lo tecleado en el formulario, por nombre de argumento. */
  const [argValues, setArgValues] = useState<Record<string, string>>({});
  /** Escape para esquemas que ningún formulario representa con honestidad. */
  const [rawMode, setRawMode] = useState(false);
  const [toolArgs, setToolArgs] = useState("{}");
  /** Aviso efímero del botón de copiar. */
  const [copyNote, setCopyNote] = useState("");

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
  const selectedPrompt = prompts.find((p) => p.name === promptName);
  /** Campos del formulario activo: los de la tool o los del prompt. */
  const argFields =
    tab === "prompts"
      ? formFields(promptSchema(selectedPrompt?.arguments ?? []))
      : formFields(selectedTool?.inputSchema);


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
    setPrompts([]);
    setResources([]);
    setToolName("");
    setPromptName("");
    setResourceUri("");
    setArgValues({});
    setToolArgs("{}");
  }

  /** Elegir tool limpia lo tecleado para la anterior y prepara el modo JSON. */
  function chooseTool(name: string) {
    setToolName(name);
    setArgValues({});
    const tool = tools.find((entry) => entry.name === name);
    setToolArgs(skeletonFor(tool?.inputSchema));
  }

  function choosePrompt(name: string) {
    setPromptName(name);
    setArgValues({});
  }

  function setArg(name: string, value: string) {
    setArgValues((prev) => ({ ...prev, [name]: value }));
  }

  /** Los tres catálogos se piden igual; solo cambia dónde se guardan. */
  async function loadCatalog(kind: Tab) {
    const method = `${kind}/list`;
    const body = await sendRaw(method, {});
    if (kind === "tools") {
      setTools(toolsFrom(body));
    } else if (kind === "prompts") {
      setPrompts(promptsFrom(body));
    } else {
      setResources(resourcesFrom(body));
    }
  }

  /**
   * Lanza un método y devuelve el cuerpo, para quien necesite leerlo.
   *
   * @param method Método JSON-RPC.
   * @param params Parámetros.
   * @returns El cuerpo de la respuesta.
   */
  async function sendRaw(method: string, params: unknown): Promise<unknown> {
    if (!server) return undefined;
    return call.send(server.endpoint, method, params, authHeaders());
  }

  /**
   * Construye los argumentos, del formulario o del JSON crudo.
   *
   * @returns Los argumentos, o `null` si el visitante escribió algo inválido
   *   (en cuyo caso ya se ha pintado el aviso).
   */
  function buildArgs(method: string): Record<string, unknown> | null {
    try {
      return rawMode
        ? (JSON.parse(toolArgs || "{}") as Record<string, unknown>)
        : valuesToArgs(argFields, argValues);
    } catch (error) {
      // Se avisa aquí y no se manda: el servidor devolvería un -32700 o un
      // "unexpected additional properties" mucho menos claros que decir qué
      // campo está mal.
      const message = `${t.badJson}: ${String(error)}`;
      call.setStatus({ method, outcome: "client", message });
      call.setOutput(message);
      return null;
    }
  }

  async function runTool() {
    const args = buildArgs("tools/call");
    if (!args) return;
    await sendRaw("tools/call", { name: toolName, arguments: args });
  }

  async function runPrompt() {
    const args = buildArgs("prompts/get");
    if (!args) return;
    // Los argumentos de un prompt son cadenas por definición del protocolo.
    const stringArgs = Object.fromEntries(
      Object.entries(args).map(([k, v]) => [k, String(v)]),
    );
    await sendRaw("prompts/get", { name: promptName, arguments: stringArgs });
  }

  async function readResource() {
    await sendRaw("resources/read", { uri: resourceUri });
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


  /** El botón de leer solo aparece con un recurso ya elegido. */
  const showRead = tab === "resources" && resourceUri !== "";

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
          <label className="field">
            <span>{t.server}</span>
            <select
              id="mcp-server"
              value={serverId}
              disabled={busy}
              onChange={(e) =>
                chooseServer((e.target as HTMLSelectElement).value)
              }
            >
              {servers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </label>

          {fields.map((field) => (
            <label className="field" key={keyOf(field.name)}>
              <span>{field.name}</span>
              <input
                type={field.secret ? "password" : "text"}
                autocomplete="off"
                spellcheck={false}
                placeholder={field.placeholder}
                disabled={busy}
                aria-required={
                  server?.requiredHeaders.includes(field) ? "true" : undefined
                }
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
          ))}
        </div>

        {blocked ? (
          <p className="need-header" data-testid="inspector-missing-header">
            {t.needHeader}{" "}
            {missing.map((h) => (
              <code key={h.name}>{h.name}</code>
            ))}
          </p>
        ) : null}

        {/* Pestañas: las tres cosas que un servidor MCP puede ofrecer. Antes
            había cuatro botones sueltos que solo listaban, y lo listado no se
            podía usar: se veía que había 37 prompts y ahí se acababa. */}
        <div className="tabs" role="tablist" aria-label={t.handshake}>
          {TABS.map((name) => (
            <button
              key={name}
              type="button"
              role="tab"
              id={`tab-${name}`}
              aria-selected={tab === name}
              // Solo el activo referencia el panel: se renderiza UN tabpanel,
              // el de la pestaña elegida, así que los demás apuntarían a un id
              // inexistente. html-validate lo caza con no-missing-references.
              aria-controls={tab === name ? `panel-${name}` : undefined}
              className={tab === name ? "tab is-active" : "tab"}
              onClick={() => setTab(name)}
            >
              {name === "tools" ? t.tabTools : null}
              {name === "prompts" ? t.tabPrompts : null}
              {name === "resources" ? t.tabResources : null}
            </button>
          ))}
          <button
            type="button"
            className="tab-init tab"
            disabled={busy || blocked}
            onClick={() => {
              void sendRaw("initialize", INIT_PARAMS);
            }}
          >
            initialize
          </button>
          {busy ? (
            <button
              type="button"
              className="danger"
              data-testid="inspector-cancel"
              onClick={() => call.cancel()}
            >
              {t.cancel} · {elapsed} s
            </button>
          ) : null}
        </div>

        <div
          className="panel"
          role="tabpanel"
          id={`panel-${tab}`}
          aria-labelledby={`tab-${tab}`}
        >
          <Catalog
            tab={tab}
            tools={tools}
            prompts={prompts}
            resources={resources}
            toolName={toolName}
            promptName={promptName}
            resourceUri={resourceUri}
            busy={busy}
            blocked={blocked}
            lang={lang}
            onLoad={() => {
              void loadCatalog(tab);
            }}
            onPickTool={chooseTool}
            onPickPrompt={choosePrompt}
            onPickResource={setResourceUri}
          />

          {showRead ? (
            <button
              type="button"
              className="primary"
              disabled={busy || blocked}
              onClick={() => {
                void readResource();
              }}
            >
              {t.readResource}
            </button>
          ) : null}

          {tab === "resources" ? null : (
            <InvokePanel
              kind={tab}
              name={tab === "tools" ? toolName : promptName}
              description={
                tab === "tools"
                  ? selectedTool?.description
                  : selectedPrompt?.description
              }
              fields={argFields}
              values={argValues}
              onChange={setArg}
              rawMode={rawMode}
              onRawMode={setRawMode}
              rawValue={toolArgs}
              onRawValue={setToolArgs}
              busy={busy}
              blocked={blocked}
              lang={lang}
              onRun={() => {
                void (tab === "tools" ? runTool() : runPrompt());
              }}
            />
          )}
        </div>
      </div>

      <StatusLine status={status} copyNote={copyNote} lang={lang} />

      {/* aria-live="off" a propósito: quien anuncia es la línea de estado de
          arriba. tabindex + role + nombre para que el panel, que tiene scroll
          propio, esté SIEMPRE en el orden de tabulación y con nombre — Chrome
          lo hacía enfocable solo cuando el contenido desbordaba. */}
      <pre
        className={`term-out${busy ? " is-stale" : ""}${failed ? " is-error" : ""}`}
        data-testid="inspector-output"
        aria-live="off"
        // Contenedor con scroll propio: sin tabIndex, quien navega con teclado
        // no puede desplazarlo. Es la excepción reconocida a "tabIndex solo en
        // elementos interactivos" (WCAG SCR34); Chrome lo hace enfocable solo
        // cuando el contenido desborda, y Firefox y Safari no lo hacen nunca.
        tabIndex={0}
        aria-label={t.responseLabel}
      >
        {lastCmd ? `jmrp@mcp:~$ ${lastCmd}\n` : ""}
        {output}
      </pre>
    </section>
  );
}
