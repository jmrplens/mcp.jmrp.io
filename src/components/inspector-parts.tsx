import type { Lang } from "../i18n/ui";
import { ui } from "../i18n/ui";
import { formatBytes, formatMs } from "../lib/format";
import type { McpPrompt, McpResource } from "../lib/mcp-catalog";
import {
  type FormField,
  type McpTool,
  requirementGroups,
  schemaFields,
} from "../lib/tool-schema";
import ArgsForm from "./ArgsForm";
import type { Status } from "./use-mcp-call";

/**
 * Pieces of the inspector that only render.
 *
 * They live outside `Inspector.tsx` because the component's JSX had built up
 * ~26 decision points — every ternary and every `&&` counts — and with that it
 * went past the cognitive complexity Sonar allows. None of these holds state:
 * they are handed what is already computed and return markup.
 */

/**
 * The chosen tool's argument schema.
 *
 * Without this the visitor guesses the arguments: a search with `limit` is
 * rejected with "unexpected additional properties", and one with no arguments
 * with "query is required". The table says what it accepts and what is
 * required.
 *
 * @param props.tool The chosen tool, or `null` when there is none yet.
 * @param props.lang The page's language.
 * @returns The schema table, or nothing when there is no tool.
 */
export function ToolSchema({
  tool,
  lang,
}: Readonly<{ tool: McpTool | null; lang: Lang }>) {
  if (!tool) return null;

  const t = ui[lang].insp;
  const rows = schemaFields(tool.inputSchema);
  const groups = requirementGroups(tool.inputSchema);

  return (
    <div
      className="schema"
      data-testid="inspector-schema"
    >
      <p className="schema-head">
        <code>{tool.name}</code>
        {tool.description ? <span> — {tool.description}</span> : null}
      </p>
      {groups && (
        <p className="schema-groups">
          <strong>
            {groups.kind === "oneOf" ? t.groupOneOf : t.groupAnyOf}:
          </strong>{" "}
          {groups.groups.map((group, gi) => (
            <>
              {gi > 0 && ` ${t.groupJoiner} `}
              {group.map((name, ni) => (
                <>
                  {ni > 0 && " + "}
                  <code>{name}</code>
                </>
              ))}
            </>
          ))}
        </p>
      )}
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
 * The last call's summary: the only region that is announced.
 *
 * The `aria-live` used to live on the dump's `<pre>`, so a screen reader read
 * 43,000 characters in one go, twice per action. Four facts fit here, and a
 * success is told apart from the three kinds of failure.
 *
 * @param props.status The last call's result, or `null` when there is none.
 * @param props.copyNote The copy button's fleeting notice.
 * @param props.lang The page's language.
 * @returns The status line.
 */
export function StatusLine({
  status,
  copyNote,
  lang,
}: Readonly<{ status: Status | null; copyNote: string; lang: Lang }>) {
  const t = ui[lang].insp;

  /** The chip's word, by result kind. */
  const label: Record<Status["outcome"], string> = {
    running: t.running,
    ok: t.ok,
    transport: t.errTransport,
    rpc: t.errRpc,
    tool: t.errTool,
    client: t.errClient,
  };

  /** The optional facts render the same way; only their formatting differs. */
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
 * The list of what the server offers in the active tab.
 *
 * This used to be a button that dumped JSON: you could see there were 37
 * prompts and could do nothing with them. Here each entry is selectable and
 * shows its description, which is what lets someone choose without knowing the
 * catalog by heart.
 *
 * @param props The three catalogs' state and the selection handlers.
 * @returns The active catalog's picker.
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

  // A map instead of three chained ternaries: registering another category is
  // one more entry, not another level of nesting.
  const {
    count,
    load: loadLabel,
    empty: emptyLabel,
  } = {
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
    <div
      className="catalog"
      data-testid={`catalog-${tab}`}
    >
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
              <option
                key={tool.name}
                value={tool.name}
              >
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
            onChange={(e) =>
              onPickPrompt((e.target as HTMLSelectElement).value)
            }
          >
            <option value="">{t.pickPrompt}</option>
            {prompts.map((prompt) => (
              <option
                key={prompt.name}
                value={prompt.name}
              >
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
              <option
                key={res.uri}
                value={res.uri}
              >
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
 * The invocation panel: a header for what is chosen, the form and the button.
 *
 * Outside the component for the same reason as the others: every JSX branch
 * adds complexity, and with the three tabs the inspector went over again. It
 * also keeps together what tools and prompts share, since they are invoked the
 * same way apart from the method's name.
 *
 * @param props What is chosen, the form's state and the handlers.
 * @returns The panel, or nothing when nothing is chosen.
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
  requirementNote,
}: Readonly<{
  kind: "tools" | "prompts";
  name: string;
  description?: string;
  /**
   * "Exactly one of: md5 | id | doi" — pre-formatted by the caller from
   * requirementGroups(), because the form itself cannot mark any single
   * field required when the requirement is a GROUP.
   */
  requirementNote?: string;
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

  // JSON mode only makes sense for tools: a prompt's arguments are flat
  // strings by the protocol's definition, so there is no schema to escape.
  const showRaw = kind === "tools";

  return (
    <>
      <div className="args-head">
        <p className="schema-head">
          <code>{name}</code>
          {description ? <span> — {description}</span> : null}
        </p>
        {requirementNote ? (
          <p className="schema-groups">{requirementNote}</p>
        ) : null}
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
