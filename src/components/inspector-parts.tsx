import type { Lang } from "../i18n/ui";
import { ui } from "../i18n/ui";
import { formatBytes, formatMs } from "../lib/format";
import type { McpPrompt, McpResource } from "../lib/mcp-catalog";
import { type FormField, type McpTool, schemaFields } from "../lib/tool-schema";
import ArgsForm from "./ArgsForm";
import type { Status } from "./use-mcp-call";

/**
 * Trozos del inspector que solo pintan.
 *
 * Están fuera de `Inspector.tsx` porque el JSX del componente acumulaba ~26
 * puntos de decisión —cada ternario y cada `&&` cuenta— y con eso pasaba de la
 * complejidad cognitiva que Sonar admite. Ninguno de estos tiene estado: se les
 * pasa lo ya calculado y devuelven markup.
 */

/**
 * Esquema de argumentos de la tool elegida.
 *
 * Sin esto el visitante adivina los argumentos: una búsqueda con `limit` se
 * rechaza con «unexpected additional properties», y sin argumentos con
 * «query is required». La tabla dice qué acepta y qué es obligatorio.
 *
 * @param props.tool Tool elegida, o `null` si aún no hay ninguna.
 * @param props.lang Idioma de la página.
 * @returns La tabla del esquema, o nada si no hay tool.
 */
export function ToolSchema({
  tool,
  lang,
}: Readonly<{ tool: McpTool | null; lang: Lang }>) {
  if (!tool) return null;

  const t = ui[lang].insp;
  const rows = schemaFields(tool.inputSchema);

  return (
    <div className="schema" data-testid="inspector-schema">
      <p className="schema-head">
        <code>{tool.name}</code>
        {tool.description ? <span> — {tool.description}</span> : null}
      </p>
      {rows.length === 0 ? (
        <p>{t.schemaEmpty}</p>
      ) : (
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
            {rows.map((row) => (
              <tr
                key={row.name}
                className={row.required ? "is-required" : undefined}
              >
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
      )}
    </div>
  );
}

/**
 * Resumen de la última llamada: la única región que se anuncia.
 *
 * El `aria-live` vivía en el `<pre>` del volcado, así que un lector de pantalla
 * leía 43.000 caracteres de una tacada y dos veces por acción. Aquí caben
 * cuatro datos y se distingue un acierto de los tres tipos de fallo.
 *
 * @param props.status Resultado de la última llamada, o `null` si no hay.
 * @param props.copyNote Aviso efímero del botón de copiar.
 * @param props.lang Idioma de la página.
 * @returns La línea de estado.
 */
export function StatusLine({
  status,
  copyNote,
  lang,
}: Readonly<{ status: Status | null; copyNote: string; lang: Lang }>) {
  const t = ui[lang].insp;

  /** Palabra del chip, por clase de resultado. */
  const label: Record<Status["outcome"], string> = {
    running: t.running,
    ok: t.ok,
    transport: t.errTransport,
    rpc: t.errRpc,
    tool: t.errTool,
    client: t.errClient,
  };

  /** Los datos opcionales se pintan igual; solo cambia cómo se formatean. */
  const facts: string[] = [];
  if (status) {
    if (status.code !== undefined) facts.push(String(status.code));
    if (status.ms !== undefined) facts.push(formatMs(status.ms));
    if (status.bytes !== undefined) facts.push(formatBytes(status.bytes));
    if (status.items) facts.push(`${status.items.count} ${status.items.kind}`);
  }

  return (
    <output
      className={`term-status is-${status?.outcome ?? "idle"}`}
      data-testid="inspector-status"
    >
      {status ? (
        <>
          <span className="chip">{label[status.outcome]}</span>
          <code>{status.method}</code>
          {facts.map((fact) => (
            <span key={fact}>· {fact}</span>
          ))}
          {status.message ? (
            <span className="msg">· {status.message}</span>
          ) : null}
        </>
      ) : (
        <span>{t.statusIdle}</span>
      )}
      {copyNote ? <span className="msg">· {copyNote}</span> : null}
    </output>
  );
}

/**
 * La lista de lo que ofrece el servidor en la pestaña activa.
 *
 * Antes esto era un botón que volcaba JSON: se veía que había 37 prompts y no
 * se podía hacer nada con ellos. Aquí cada entrada es seleccionable y enseña su
 * descripción, que es lo que permite elegir sin saberse el catálogo de memoria.
 *
 * @param props Estado de los tres catálogos y los manejadores de selección.
 * @returns El selector del catálogo activo.
 */
export function Catalog({
  tab,
  tools,
  prompts,
  resources,
  toolName,
  promptName,
  resourceUri,
  busy,
  blocked,
  lang,
  onLoad,
  onPickTool,
  onPickPrompt,
  onPickResource,
}: Readonly<{
  tab: "tools" | "prompts" | "resources";
  tools: McpTool[];
  prompts: McpPrompt[];
  resources: McpResource[];
  toolName: string;
  promptName: string;
  resourceUri: string;
  busy: boolean;
  blocked: boolean;
  lang: Lang;
  onLoad: () => void;
  onPickTool: (name: string) => void;
  onPickPrompt: (name: string) => void;
  onPickResource: (uri: string) => void;
}>) {
  const t = ui[lang].insp;

  // Un mapa en vez de tres ternarios encadenados: dar de alta otra categoría
  // es una entrada más, no otro nivel de anidamiento.
  const { count, load: loadLabel, empty: emptyLabel } = {
    tools: { count: tools.length, load: t.loadTools, empty: t.emptyTools },
    prompts: {
      count: prompts.length,
      load: t.loadPrompts,
      empty: t.emptyPrompts,
    },
    resources: {
      count: resources.length,
      load: t.loadResources,
      empty: t.emptyResources,
    },
  }[tab];

  return (
    <div className="catalog" data-testid={`catalog-${tab}`}>
      <div className="catalog-head">
        <button
          type="button"
          disabled={busy || blocked}
          onClick={onLoad}
          data-testid={`load-${tab}`}
        >
          {loadLabel}
        </button>
        {count > 0 ? (
          <span className="catalog-count">
            {count} · {tab}
          </span>
        ) : null}
      </div>

      {count === 0 ? <p className="tool-hint">{emptyLabel}</p> : null}

      {tab === "tools" && tools.length > 0 ? (
        <label className="field">
          <span>{t.tool}</span>
          <select
            value={toolName}
            disabled={busy}
            onChange={(e) => onPickTool((e.target as HTMLSelectElement).value)}
          >
            <option value="">{t.chooseTool}</option>
            {tools.map((tool) => (
              <option key={tool.name} value={tool.name}>
                {tool.name}
              </option>
            ))}
          </select>
        </label>
      ) : null}

      {tab === "prompts" && prompts.length > 0 ? (
        <label className="field">
          <span>{t.tabPrompts}</span>
          <select
            value={promptName}
            disabled={busy}
            onChange={(e) => onPickPrompt((e.target as HTMLSelectElement).value)}
          >
            <option value="">{t.pickPrompt}</option>
            {prompts.map((prompt) => (
              <option key={prompt.name} value={prompt.name}>
                {prompt.name}
              </option>
            ))}
          </select>
        </label>
      ) : null}

      {tab === "resources" && resources.length > 0 ? (
        <label className="field">
          <span>{t.tabResources}</span>
          <select
            value={resourceUri}
            disabled={busy}
            onChange={(e) =>
              onPickResource((e.target as HTMLSelectElement).value)
            }
          >
            <option value="">{t.pickResource}</option>
            {resources.map((res) => (
              <option key={res.uri} value={res.uri}>
                {res.name ?? res.uri}
                {res.mimeType ? ` · ${res.mimeType}` : ""}
              </option>
            ))}
          </select>
        </label>
      ) : null}
    </div>
  );
}

/**
 * El panel de invocación: cabecera de lo elegido, formulario y botón.
 *
 * Fuera del componente por el mismo motivo que los demás: cada rama del JSX
 * suma complejidad, y con las tres pestañas el inspector volvía a pasarse.
 * Aquí además queda junto lo que comparten tools y prompts, que se invocan
 * igual salvo el nombre del método.
 *
 * @param props Lo elegido, el estado del formulario y los manejadores.
 * @returns El panel, o nada si no hay nada elegido.
 */
export function InvokePanel({
  kind,
  name,
  description,
  fields,
  values,
  onChange,
  rawMode,
  onRawMode,
  rawValue,
  onRawValue,
  busy,
  blocked,
  lang,
  onRun,
}: Readonly<{
  kind: "tools" | "prompts";
  name: string;
  description?: string;
  fields: FormField[];
  values: Record<string, string>;
  onChange: (name: string, value: string) => void;
  rawMode: boolean;
  onRawMode: (raw: boolean) => void;
  rawValue: string;
  onRawValue: (value: string) => void;
  busy: boolean;
  blocked: boolean;
  lang: Lang;
  onRun: () => void;
}>) {
  const t = ui[lang].insp;
  if (!name) return <p className="tool-hint">{t.pickTool}</p>;

  // El modo JSON solo tiene sentido en tools: los argumentos de un prompt son
  // cadenas planas por definición del protocolo, no hay esquema que escapar.
  const showRaw = kind === "tools";

  return (
    <>
      <div className="args-head">
        <p className="schema-head">
          <code>{name}</code>
          {description ? <span> — {description}</span> : null}
        </p>
        {showRaw ? (
          <div className="mode">
            <button
              type="button"
              className={rawMode ? "mode-btn" : "mode-btn is-on"}
              onClick={() => onRawMode(false)}
            >
              {t.formMode}
            </button>
            <button
              type="button"
              className={rawMode ? "mode-btn is-on" : "mode-btn"}
              onClick={() => onRawMode(true)}
            >
              {t.jsonMode}
            </button>
          </div>
        ) : null}
      </div>

      {showRaw && rawMode ? (
        <label className="field">
          <span>{t.argsJson}</span>
          <textarea
            rows={5}
            spellcheck={false}
            disabled={busy}
            value={rawValue}
            onInput={(e) => onRawValue((e.target as HTMLTextAreaElement).value)}
          />
        </label>
      ) : (
        <ArgsForm
          fields={fields}
          values={values}
          onChange={onChange}
          onSubmit={busy || blocked ? undefined : onRun}
          lang={lang}
          disabled={busy}
        />
      )}

      <button
        type="button"
        className="primary"
        disabled={busy || blocked}
        onClick={onRun}
      >
        {kind === "tools" ? t.runTool : t.getPrompt}
      </button>
    </>
  );
}
