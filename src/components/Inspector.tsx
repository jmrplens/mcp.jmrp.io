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
import { readableText } from "../lib/mcp-client";
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
import Markdown from "./Markdown";
import { useMcpCall } from "./use-mcp-call";

/**
 * A Preact island that introspects and exercises the MCP servers from the
 * browser.
 *
 * The server list arrives as a prop so it keeps a single source of truth:
 * `src/data/servers.ts`. So does `lang`, because the field labels and error
 * messages ARE interface text on a bilingual site; what is never translated
 * are the protocol's identifiers (method, header and tool names), which are
 * literally what has to be typed into an MCP client.
 *
 * THE RULE THAT CANNOT BE BROKEN: the header values (the GitLab token among
 * them) live ONLY in component state. No localStorage, sessionStorage,
 * cookies, query string or console.log: on reload they have to be gone.
 */

/**
 * `initialize` is the only method that needs parameters: without them the
 * server answers -32602. The version is the protocol these servers speak; if
 * a server supports another it negotiates and returns its own.
 */
const INIT_PARAMS = {
  protocolVersion: "2026-07-28",
  capabilities: {},
  clientInfo: { name: "mcp.jmrp.io inspector", version: "1" },
};

/**
 * "Exactly one of: md5 or id or doi" — the form cannot mark any single field
 * as required when the requirement is a GROUP (libgen 1.7.1 declares them as
 * anyOf/oneOf of required branches), so it is stated above the fields in the
 * page's language. At module level because of S3776: the component already
 * sits near the complexity ceiling and this is only render data.
 *
 * @param tab The active tab; only tools carry an inputSchema with groups.
 * @param schema The chosen tool's `inputSchema`.
 * @param t The inspector's strings in the page's language.
 * @returns The finished line, or undefined when there are no readable groups.
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
        <span
          className="i-simple-icons:gitlab signin-mark"
          aria-hidden="true"
        />
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
 * Classes for the output panel: stale while a call is in flight, error when
 * the last one failed.
 *
 * At module level for the same reason as `requirementNoteFor` above (S3776):
 * two ternaries inline in an attribute counted against the component for what
 * is a lookup table with two flags.
 *
 * @param busy Whether a call is in flight.
 * @param failed Whether the last call failed.
 * @returns The class attribute.
 */
function outputClass(busy: boolean, failed: boolean): string {
  const stale = busy ? " is-stale" : "";
  const error = failed ? " is-error" : "";
  return `term-out${stale}${error}`;
}

/**
 * Whether anything that sends a request is unavailable right now.
 *
 * At module level for the same reason as `outputClass` above (S3776): a
 * derivation is not a branch of the render, and inline it counted as one.
 *
 * @param busy Whether a call is in flight.
 * @param cooldown Seconds of brake left.
 * @returns True while nothing may be sent.
 */
function isFrozen(busy: boolean, cooldown: number): boolean {
  return busy || cooldown > 0;
}

/**
 * Where the privacy note sends a reader who wants to check it rather than
 * believe it: the section of /internals/ describing what this island keeps.
 *
 * At module level with the other derivations above (S3776).
 *
 * @param lang The page's locale.
 * @returns The link target.
 */
function storageHref(lang: Lang): string {
  const prefix = lang === "es" ? "/es" : "";
  return `${prefix}/internals/#inspector-storage-h`;
}

/**
 * Whether the laid-out view is the one to show.
 *
 * Reader is the default, but only where there is something to lay out: with
 * no readable text the JSON is the answer, and pretending otherwise would
 * hide it.
 *
 * @param view The view the reader last picked.
 * @param readable The response's readable text, if any.
 * @returns True when the reader view should render.
 */
function showsReaderView(view: string, readable: string | undefined): boolean {
  return view === "reader" && readable !== undefined;
}

/**
 * Picks how the answer is shown: laid out, or as the body that arrived.
 *
 * A component of its own for the reason `SignInBlock` is (S3776) — its
 * branches counted against the panel — and because the two buttons need
 * labels that stand on their own. There is a second "JSON" button in the
 * arguments form, and the two mean different things: that one picks how you
 * WRITE the call, this one how you READ the answer. A `role="group"` around
 * them would have said so only to a screen reader that announces group names,
 * so each button carries the whole label instead.
 *
 * @param props.t Inspector strings in the page's language.
 * @param props.reader Whether the laid-out view is the one showing.
 * @param props.onPick Reports the view the reader chose.
 * @returns The switch.
 */
function ViewSwitch({
  t,
  reader,
  onPick,
}: Readonly<{
  t: (typeof ui)[Lang]["insp"];
  reader: boolean;
  onPick: (view: "reader" | "json") => void;
}>) {
  return (
    <div className="view-switch">
      <button
        type="button"
        aria-pressed={reader}
        aria-label={`${t.viewLabel}: ${t.viewFormatted}`}
        title={t.viewFormattedHint}
        onClick={() => onPick("reader")}
      >
        {t.viewFormatted}
      </button>
      <button
        type="button"
        aria-pressed={!reader}
        aria-label={`${t.viewLabel}: ${t.viewRaw}`}
        title={t.viewRawHint}
        onClick={() => onPick("json")}
      >
        {t.viewRaw}
      </button>
    </div>
  );
}

/**
 * The interactive island that talks to the MCP servers from the visitor's
 * browser: introspection (initialize, tools/list, prompts/list,
 * resources/list) and running tools.
 *
 * The GitLab token typed in here lives ONLY in this component's state: it is
 * never written to localStorage or sessionStorage, never travels in the URL,
 * and is gone on reload.
 *
 * @param props.servers The server list, from `src/data/servers.ts`.
 * @param props.lang The language of the page mounting the island.
 * @returns The inspector panel.
 */
export default function Inspector({
  servers,
  lang,
}: Readonly<{ servers: McpServer[]; lang: Lang }>) {
  const t = ui[lang].insp;
  const inspectorStorageHref = storageHref(lang);
  const call = useMcpCall({
    networkError: t.networkError,
    timedOut: t.timedOut,
    cancelled: t.cancelled,
    tooFast: t.tooFast,
    cooling: t.cooling,
  });
  const { output, status, busy, elapsed, lastCmd, lastBody, cooldown } = call;

  /**
   * Nothing that sends a request is available while the block lasts.
   *
   * Only what calls is frozen: the server picker and the credential field
   * stay live, because getting the next call ready while you wait is exactly
   * what should still be possible.
   */
  const frozen = isFrozen(busy, cooldown);

  /**
   * The last response's readable text, when there is one.
   *
   * A `tools/call` answers Markdown — libgen's search returns a table of
   * links — while a `tools/list` or an error does not. With nothing to lay
   * out the view switch does not appear at all: there, the JSON is the
   * answer.
   */
  const readable = readableText(lastBody as never);
  const [view, setView] = useState<"reader" | "json">("reader");
  const showReader = showsReaderView(view, readable);

  const [serverId, setServerId] = useState(servers[0]?.id ?? "");
  /**
   * The header values, in memory and nowhere else. The key is prefixed with
   * the server's id: if two MCPs declared a header with the same name, a
   * shared key would send one's secret to the other.
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
  /** The active server's catalogs. Filled by each `list`. */
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
      pendingNameRef.current = {
        tab: deepLink.tab ?? "tools",
        name: deepLink.name,
      };
    }
  }, [servers]);
  /** What has been typed into the form, by argument name. */
  const [argValues, setArgValues] = useState<Record<string, string>>({});
  /** The escape hatch for schemas no form represents honestly. */
  const [rawMode, setRawMode] = useState(false);
  const [toolArgs, setToolArgs] = useState("{}");
  /** The copy button's fleeting notice. */
  const [copyNote, setCopyNote] = useState("");

  const server = servers.find((s) => s.id === serverId) ?? servers[0];
  const fields = server
    ? [...server.requiredHeaders, ...server.optionalHeaders]
    : [];

  const keyOf = (headerName: string) => `${server?.id ?? ""}:${headerName}`;

  /**
   * Required headers still left empty.
   *
   * Without this, gitlab with no token returns a 400 carrying the upstream's
   * literal text, "no server available", which reads as "the server is down" —
   * exactly the wrong conclusion. The data needed to prevent it was already in
   * `servers.ts`.
   */
  const missing = (server?.requiredHeaders ?? []).filter(
    (h) => !headerValues[keyOf(h.name)]?.trim(),
  );
  const blocked = missing.length > 0;

  const selectedTool = tools.find((tool) => tool.name === toolName);
  const selectedPrompt = prompts.find((p) => p.name === promptName);
  /** The active form's fields: the tool's or the prompt's. */
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
   * Only the active server's headers, and only those with a value.
   *
   * The scheme (`valuePrefix`, today `"Bearer "` on gitlab) is added HERE and
   * not by the visitor: what gets typed is the token, and asking them to write
   * `Bearer ` in front too turns one stray space into an unexplained 401.
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
   * Switching server throws away the catalog and the arguments.
   *
   * Keeping the previous server's tools would be worse than having no list at
   * all: the picker would offer names this other server does not implement.
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

  /** Picking a tool clears what was typed for the previous one and preps JSON mode. */
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

  /** All three catalogs are requested the same way; only where they land differs. */
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
   * Fires a method and returns the body, for whoever needs to read it.
   *
   * @param method The JSON-RPC method.
   * @param params The parameters.
   * @returns The response body.
   */
  async function sendRaw(method: string, params: unknown): Promise<unknown> {
    if (!server) return undefined;
    return call.send(server.endpoint, method, params, authHeaders());
  }

  /**
   * Builds the arguments, from the form or from the raw JSON.
   *
   * @returns The arguments, or `null` when the visitor typed something invalid
   *   (in which case the notice has already been rendered).
   */
  function buildArgs(method: string): Record<string, unknown> | null {
    try {
      return rawMode
        ? (JSON.parse(toolArgs || "{}") as Record<string, unknown>)
        : valuesToArgs(argFields, argValues, {
            notANumber: t.argNotANumber,
            badJson: t.argBadJson,
          });
    } catch (error) {
      // Reported here rather than sent: the server would return a -32700 or an
      // "unexpected additional properties", both far less clear than saying
      // which field is wrong.
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
    // A prompt's arguments are strings by the protocol's definition.
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
      // Without clipboard permission (or outside a secure context) there is
      // nothing to do but say so: failing silently leaves the visitor believing
      // they already have it copied.
      setCopyNote(t.copyFailed);
    }
  }

  /** The read button only appears once a resource has been chosen. */
  const showRead = tab === "resources" && resourceUri !== "";

  const failed =
    !!status && status.outcome !== "ok" && status.outcome !== "running";

  return (
    <section
      className="term"
      data-testid="inspector"
    >
      {/* The window bar: the same piece as jmrp.io's terminal card. Here it is
          not decoration — what sits below IS a JSON-RPC console, so the shape
          tells the truth about the function. */}
      <header className="term-bar">
        <span
          className="lights"
          aria-hidden="true"
        >
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
        {readable !== undefined && (
          <ViewSwitch
            t={t}
            reader={showReader}
            onPick={setView}
          />
        )}
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
                <option
                  key={s.id}
                  value={s.id}
                >
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
            <label
              className="field"
              key={keyOf(field.name)}
            >
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
          <p
            className="need-header"
            data-testid="inspector-missing-header"
          >
            {t.needHeader}{" "}
            {missing.map((h) => (
              <code key={h.name}>{h.name}</code>
            ))}
          </p>
        ) : null}

        {/* Tabs: the three things an MCP server can offer. There used to be
            four loose buttons that only listed, and what they listed could not
            be used: you could see there were 37 prompts and that was that. */}
        {/* The two action buttons sit OUTSIDE the tablist. A `role="tablist"`
            may only contain `role="tab"` children, and `initialize` and
            `cancel` are not tabs: axe reported "Element has children which are
            not allowed: button", and it was the single failing Lighthouse
            audit on both pages (aria-required-children 0/100, with everything
            else at 100). The row looks the same — `.tabs-row` now carries the
            flex layout the tablist used to provide. */}
        <div className="tabs-row">
          <div
            className="tabs"
            role="tablist"
            aria-label={t.handshake}
          >
            {TABS.map((name) => (
              <button
                key={name}
                type="button"
                role="tab"
                id={`tab-${name}`}
                aria-selected={tab === name}
                // Only the active one references the panel: exactly ONE
                // tabpanel is rendered, the chosen tab's, so the others would
                // point at an id that does not exist. html-validate catches it
                // with no-missing-references.
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
            busy={frozen}
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
              busy={frozen}
              blocked={blocked}
              lang={lang}
              onRun={() => {
                void (tab === "tools" ? runTool() : runPrompt());
              }}
            />
          )}
        </div>
      </div>

      <StatusLine
        status={status}
        copyNote={copyNote}
        lang={lang}
      />

      {/* aria-live="off" on purpose: the status line above is what announces.
          tabindex + role + name so the panel, which has its own scroll, is
          ALWAYS in the tab order and named — Chrome only made it focusable
          when the content overflowed. */}
      {/* A div, not a pre: the reader view puts tables and lists inside,
          which would be invalid HTML within a pre. The pre stays in there
          for the JSON view, which is the one that needs its whitespace. */}
      {/* A <section> with a name, rather than a div carrying role="region":
          same role, and it is the element the role was named after. */}
      <section
        className={outputClass(busy, failed)}
        data-testid="inspector-output"
        aria-live="off"
        // A container with its own scroll: without tabIndex, a keyboard user
        // cannot scroll it. This is the recognized exception to "tabIndex only
        // on interactive elements" (WCAG SCR34); Chrome makes it focusable
        // only when the content overflows, and Firefox and Safari never do.
        tabIndex={0}
        aria-label={t.responseLabel}
      >
        {showReader ? (
          <Markdown source={readable} />
        ) : (
          <pre className="term-raw">
            {lastCmd ? `jmrp@mcp:~$ ${lastCmd}\n` : ""}
            {output}
          </pre>
        )}
      </section>
    </section>
  );
}
