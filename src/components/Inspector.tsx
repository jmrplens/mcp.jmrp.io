import "./Inspector.css";

import { useLayoutEffect, useRef, useState } from "preact/hooks";

import type { McpServer } from "../data/servers";
import { type Lang, ui } from "../i18n/ui";
import { parseDeepLink, type Tab, TABS } from "../lib/inspector-deeplink";
import {
  type McpPrompt,
  type McpResource,
  promptSchema,
  promptsFrom,
  resourcesFrom,
} from "../lib/mcp-catalog";
import { signInWithPopup } from "../lib/oauth-popup";
import {
  formFields,
  type JsonSchema,
  type McpTool,
  requirementGroups,
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
 * "Exactly one of: md5 or id or doi" — el formulario no puede marcar ningún
 * campo suelto como obligatorio cuando el requisito es un GRUPO (libgen 1.7.1
 * los declara como anyOf/oneOf de ramas required), así que se enuncia encima
 * con las palabras del idioma de la página. A nivel de módulo por S3776: el
 * componente ya roza el límite de complejidad y esto son solo datos de render.
 *
 * @param tab Pestaña activa; solo las tools llevan inputSchema con grupos.
 * @param schema El `inputSchema` de la tool elegida.
 * @param t Bloque de cadenas del inspector en el idioma de la página.
 * @returns La línea ya redactada, o undefined si no hay grupos legibles.
 */
function requirementNoteFor(
  tab: Tab,
  schema: JsonSchema | undefined,
  t: (typeof ui)[Lang]["insp"],
): string | undefined {
  if (tab !== "tools") return undefined;
  const groups = requirementGroups(schema);
  if (!groups) return undefined;
  const label = groups.kind === "oneOf" ? t.groupOneOf : t.groupAnyOf;
  const spelled = groups.groups
    .map((group) => group.join(" + "))
    .join(` ${t.groupJoiner} `);
  return `${label}: ${spelled}`;
}

/** What the sign-in flow is doing, if anything. */
type SignInState = "idle" | "busy" | "denied" | "failed";

/**
 * The GitLab sign-in block: the button, what the flow is doing, and the note
 * that says where the token ends up.
 *
 * At module level for the same reason as `requirementNoteFor` above (S3776):
 * it holds no state of its own, only what the panel hands it, and leaving its
 * branches inline pushed the component over the complexity ceiling.
 *
 * @param props.t Inspector strings in the page's language.
 * @param props.signIn What the flow is doing right now.
 * @param props.busy Whether a call is in flight, which also disables the button.
 * @param props.storageHref Where the note sends a reader who wants to check it.
 * @param props.onSignIn Starts the flow.
 * @returns The block.
 */
function SignInBlock({
  t,
  signIn,
  busy,
  storageHref,
  onSignIn,
}: Readonly<{
  t: (typeof ui)[Lang]["insp"];
  signIn: SignInState;
  busy: boolean;
  storageHref: string;
  onSignIn: () => void;
}>) {
  const failed = signIn === "denied" || signIn === "failed";
  return (
    <div className="signin">
      <button
        type="button"
        className="signin-button"
        onClick={onSignIn}
        disabled={busy || signIn === "busy"}
      >
        {/* GitLab's own mark, from `simple-icons`, which reproduces official
            brand marks. It is not decoration: the point of the button is that
            the visitor authorises at gitlab.com with nobody in between, and
            the mark is what says so before the popup opens. Brand orange, not
            the site accent — this one destination is deliberately not ours. */}
        <span className="i-simple-icons:gitlab signin-mark" aria-hidden="true" />
        {signIn === "busy" ? t.signInBusy : t.signInWith}
      </button>
      {/* `<output>` rather than a paragraph with role="status": same live
          announcement, and it is the element the role was named after. */}
      {failed && (
        <output className="signin-error">
          {signIn === "denied" ? t.signInDenied : t.signInFailed}
        </output>
      )}
      <p className="signin-note">
        {t.signInNote} <a href={storageHref}>{t.signInVerify}</a>
      </p>
      <p className="signin-or">{t.signInOr}</p>
    </div>
  );
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
  /**
   * Where the privacy note sends a reader who wants to check it rather than
   * believe it: the section of /internals/ that describes what the inspector
   * keeps, and how to see for yourself with the browser's own tools.
   *
   * Built here rather than passed in because it is the only link this island
   * makes off its own page, and threading a prop through for one string would
   * be more moving parts than the string.
   */
  const inspectorStorageHref = `${lang === "es" ? "/es" : ""}/internals/#inspector-storage-h`;
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
  /**
   * What the sign-in button is doing, if anything.
   *
   * The token it obtains goes into `headerValues` like a pasted one — same
   * state, same lifetime, same rule. This only tracks the flow so the button
   * can say what happened instead of failing silently.
   */
  const [signIn, setSignIn] = useState<SignInState>("idle");
  /** Catálogos del servidor activo. Se llenan con cada `list`. */
  const [tools, setTools] = useState<McpTool[]>([]);
  const [prompts, setPrompts] = useState<McpPrompt[]>([]);
  const [resources, setResources] = useState<McpResource[]>([]);
  const [toolName, setToolName] = useState("");
  const [promptName, setPromptName] = useState("");
  const [resourceUri, setResourceUri] = useState("");
  /**
   * The deep-link `name`, waiting for the tab it targets to load its
   * catalog. Seeded by the effect below, not here — see there for why.
   * Cleared by `applyPendingName` the first time that catalog loads WITH a
   * match — see there for why a miss leaves it in place instead.
   */
  const pendingNameRef = useRef<{ tab: Tab; name: string } | null>(null);

  /**
   * Deep link: `?server=&tab=&name=`, applied once after mount.
   *
   * This is a `useLayoutEffect`, not read straight into the `useState`s
   * above, for a Preact-specific reason: `location` doesn't exist during
   * this island's server-rendered pass, but even gating that read behind an
   * `import.meta.env.SSR` check wouldn't work — Preact's hydration
   * deliberately skips patching DOM attributes/properties on the very first
   * client render (it trusts the server output already matches), so seeding
   * `useState`'s initial value straight from the URL computes the right
   * component STATE but that state never reaches the DOM: the `<select>`
   * and the tab buttons stay showing the server-rendered defaults. Verified
   * against this exact bundle by logging state inside the render (correct)
   * versus the DOM right after (still the SSR defaults).
   *
   * A `useLayoutEffect` runs after that initial hydrate commit, so its
   * `setServerId`/`setTab` calls trigger a normal (non-hydrating) re-render,
   * which Preact DOES apply — synchronously, before the browser paints, so
   * there is no visible flash of the wrong server or tab.
   *
   * Runs once: the URL never changes underneath this island (selecting from
   * the UI never writes back to it, see the module doc), so `servers` is the
   * only real dependency, and it never changes for a mounted island either.
   */
  useLayoutEffect(() => {
    const deepLink = parseDeepLink(location.search, servers);
    if (deepLink.serverId) setServerId(deepLink.serverId);
    if (deepLink.tab) setTab(deepLink.tab);
    if (deepLink.name) {
      pendingNameRef.current = { tab: deepLink.tab ?? "tools", name: deepLink.name };
    }
  }, [servers]);
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

  const requirementNote = requirementNoteFor(tab, selectedTool?.inputSchema, t);


  /**
   * Runs the OAuth popup and puts the resulting token where a pasted one goes.
   *
   * Nothing is persisted: the token lands in component state, so it dies on
   * reload, on navigating anywhere (this site has no client router, so every
   * navigation is a fresh document) and with the tab.
   */
  async function startSignIn(): Promise<void> {
    const oauth = server?.oauth?.inspector;
    const credential = server?.requiredHeaders[0];
    if (!oauth || !credential) return;
    setSignIn("busy");
    const result = await signInWithPopup(
      {
        clientId: oauth.clientId,
        authorizationServer: server.oauth?.authorizationServer ?? "",
        scopes: oauth.scopes,
      },
      oauth.redirectUri,
    );
    if (result.ok) {
      setHeaderValues((prev) => ({
        ...prev,
        [keyOf(credential.name)]: result.token,
      }));
      setSignIn("idle");
      return;
    }
    setSignIn(result.reason === "cancelled" ? "idle" : result.reason);
  }

  /**
   * Solo las cabeceras del servidor activo, y solo las que tienen valor.
   *
   * El esquema (`valuePrefix`, hoy `"Bearer "` en gitlab) lo pone AQUÍ y no el
   * visitante: lo que se teclea es el token, y pedirle además que escriba
   * `Bearer ` delante convierte un espacio de más en un 401 sin explicación.
   */
  function authHeaders(): Record<string, string> {
    const headers: Record<string, string> = {};
    for (const field of fields) {
      const value = headerValues[keyOf(field.name)]?.trim();
      if (value) headers[field.name] = `${field.valuePrefix ?? ""}${value}`;
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

  /**
   * Applies the deep-link `name` to a catalog that just finished loading, if
   * that catalog is the one the URL targeted.
   *
   * Only consumes `pendingNameRef` on an actual match. Leaving it in place on
   * a miss — rather than clearing it unconditionally — means a transient
   * failure (missing token, dropped request) doesn't cost the deep link its
   * one shot: reloading the same tab tries again. A name that is genuinely
   * not in the catalog just keeps missing harmlessly on every reload, which
   * costs nothing more than one `Array#find` over a short list.
   *
   * Applies the match with the SAME state updates the manual pickers use
   * (`chooseTool`/`choosePrompt`/`onPickResource`), but against the freshly
   * fetched `list` rather than the `tools`/`prompts` state variables: those
   * haven't re-rendered yet at this point in `loadCatalog`, so reading them
   * here would see the stale (pre-load) value instead of what just arrived.
   *
   * @param kind Which catalog just came back.
   * @param list The catalog, as just normalised from the server's response.
   * @param keyOf Reads the identifier to match the pending name against —
   *   the tool/prompt `name`, or the resource `uri` (its actual selection
   *   key; a resource's display `name` is optional and not unique).
   * @param select Applies the match, once found.
   */
  function applyPendingName<T>(
    kind: Tab,
    list: T[],
    keyOf: (item: T) => string,
    select: (item: T) => void,
  ) {
    const pending = pendingNameRef.current;
    // `pending?.tab` covers the null case on its own: it yields undefined,
    // which never equals a tab name, so the early return still fires.
    if (pending?.tab !== kind) return;
    const match = list.find((item) => keyOf(item) === pending.name);
    if (!match) return;
    pendingNameRef.current = null;
    select(match);
  }

  /** Los tres catálogos se piden igual; solo cambia dónde se guardan. */
  async function loadCatalog(kind: Tab) {
    const method = `${kind}/list`;
    const body = await sendRaw(method, {});
    if (kind === "tools") {
      const list = toolsFrom(body);
      setTools(list);
      applyPendingName(
        kind,
        list,
        (tool) => tool.name,
        (tool) => {
          setToolName(tool.name);
          setArgValues({});
          setToolArgs(skeletonFor(tool.inputSchema));
        },
      );
    } else if (kind === "prompts") {
      const list = promptsFrom(body);
      setPrompts(list);
      applyPendingName(
        kind,
        list,
        (prompt) => prompt.name,
        (prompt) => {
          setPromptName(prompt.name);
          setArgValues({});
        },
      );
    } else {
      const list = resourcesFrom(body);
      setResources(list);
      applyPendingName(
        kind,
        list,
        (resource) => resource.uri,
        (resource) => setResourceUri(resource.uri),
      );
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

          {/* The sign-in button sits ABOVE the credential field, not instead
              of it: both paths stay open. The button is the better one when it
              is available — read-only and short-lived — but a visitor with a
              token already in hand should not have to use a popup to get in.
              It renders only when the read-only application is configured;
              without it there would be a button that mints a read/write token,
              which is a worse deal than the field beside it. */}
          {server?.oauth?.inspector && (
            <SignInBlock
              t={t}
              signIn={signIn}
              busy={busy}
              storageHref={inspectorStorageHref}
              onSignIn={() => void startSignIn()}
            />
          )}

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
        {/* The two action buttons sit OUTSIDE the tablist. A `role="tablist"`
            may only contain `role="tab"` children, and `initialize` and
            `cancel` are not tabs: axe reported "Element has children which are
            not allowed: button", and it was the single failing Lighthouse
            audit on both pages (aria-required-children 0/100, with everything
            else at 100). The row looks the same — `.tabs-row` now carries the
            flex layout the tablist used to provide. */}
        <div className="tabs-row">
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
        </div>
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
              requirementNote={requirementNote}
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
