/**
 * The inspector's reader view, for EVERY response, from any MCP server.
 *
 * It used to lay out one shape only: the `result.content` text of a
 * `tools/call`. libgen writes Markdown there, so its searches rendered as a
 * table; everything else fell back to raw JSON — a prompt rendered with
 * `prompts/get` (its text lives in `result.messages`), a resource read with
 * `resources/read` (in `result.contents`), every `…/list`, `initialize`
 * with the server's instructions, and every error. gitlab mostly answers in
 * those other shapes, so for gitlab the reader was nearly never there.
 *
 * The old rule was "no reader view when the JSON IS the answer", because an
 * EMPTY reader would have hidden the only answer there was. This never
 * produces an empty one: a list becomes a list, an error states its code and
 * message, and anything it does not recognize is shown as formatted JSON —
 * with the raw JSON view one tap away in every case.
 *
 * It keys on the SHAPE of the result, never on the server or the method, so a
 * third MCP server added to `servers.ts` gets the same treatment unchanged.
 *
 * SAFETY. All of this is text a third party wrote, and libgen's own tool
 * description calls its results untrusted. The output is Markdown source for
 * `md.ts`, which never builds HTML — Preact escapes every text node, and
 * links pass a scheme allowlist — so nothing here can inject markup. What
 * this module does guard is the SYNTAX: a value cannot close a code fence
 * early or break out of an inline code span.
 */

/** A plain object, not null, not an array. */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** A string field, or undefined. */
function text(
  record: Record<string, unknown>,
  key: string,
): string | undefined {
  const value = record[key];
  return typeof value === "string" && value !== "" ? value : undefined;
}

/**
 * A fenced code block that its own content cannot close.
 *
 * `md.ts` closes a fence on any line that STARTS with three backticks, after
 * trimming, so such a line inside the value is broken with a zero-width space
 * between the first two backticks. It looks the same and no longer matches.
 */
function fence(body: string, lang = ""): string {
  const safe = body
    .split("\n")
    .map((line) => line.replace(/^(\s*)```/, "$1`​``"))
    .join("\n");
  return `\`\`\`${lang}\n${safe}\n\`\`\``;
}

/** An inline code span that cannot be closed from inside. */
function code(value: string): string {
  return `\`${value.replaceAll("`", "'")}\``;
}

/** One line of prose: newlines and runs of spaces collapsed. */
function oneLine(value: string): string {
  return value.replaceAll(/\s+/g, " ").trim();
}

/** Pretty JSON, for anything shown as data. */
function json(value: unknown): string {
  return fence(JSON.stringify(value, null, 2), "json");
}

/**
 * Text as the reader should show it.
 *
 * A text block that is really a JSON document — gitlab answers most calls that
 * way — is shown as formatted JSON rather than as one enormous paragraph.
 * Anything else is taken to be Markdown, which is what servers that bother to
 * format write, and what plain text degrades to harmlessly.
 */
function prose(value: string): string {
  const trimmed = value.trim();
  if (
    (trimmed.startsWith("{") && trimmed.endsWith("}")) ||
    (trimmed.startsWith("[") && trimmed.endsWith("]"))
  ) {
    try {
      return json(JSON.parse(trimmed));
    } catch {
      // Not JSON after all: fall through and show it as written.
    }
  }
  return value;
}

/** A byte count for a note, from a base64 payload. */
function sizeOf(base64: unknown): string {
  if (typeof base64 !== "string") return "";
  const bytes = Math.floor((base64.length * 3) / 4);
  return bytes < 1024 ? ` · ${bytes} B` : ` · ${(bytes / 1024).toFixed(1)} kB`;
}

/**
 * What a resource body says, by its media type.
 *
 * Markdown is rendered; JSON is formatted; any other text is shown verbatim
 * in a block, since prose layout would reflow a CSV or a log into nonsense.
 * A binary `blob` is described, not dumped.
 */
function resourceBody(item: Record<string, unknown>): string {
  const mime = text(item, "mimeType") ?? "";
  const body = text(item, "text");
  if (body !== undefined) {
    if (mime.includes("markdown")) return body;
    if (mime.includes("json")) return prose(body);
    return mime === "" ? prose(body) : fence(body);
  }
  if (typeof item.blob === "string") {
    return `*binary content · ${mime || "unknown type"}${sizeOf(item.blob)}*`;
  }
  return "";
}

/**
 * One content block of a tool result or a prompt message.
 *
 * Images and audio are described rather than drawn: `md.ts` has no image
 * node on purpose, and a picture from a third party is not something this
 * page should render unasked.
 */
function block(entry: unknown): string {
  if (!isRecord(entry)) return "";
  switch (entry.type) {
    case "text": {
      return typeof entry.text === "string" ? prose(entry.text) : "";
    }
    case "image":
    case "audio": {
      return `*${entry.type} · ${text(entry, "mimeType") ?? "unknown type"}${sizeOf(entry.data)}*`;
    }
    case "resource_link": {
      const uri = text(entry, "uri") ?? "";
      const name = text(entry, "title") ?? text(entry, "name");
      const desc = text(entry, "description");
      const named = name ? " — " + oneLine(name) : "";
      return [`→ ${code(uri)}${named}`, desc ? oneLine(desc) : ""]
        .filter(Boolean)
        .join("\n\n");
    }
    case "resource": {
      const resource = isRecord(entry.resource) ? entry.resource : {};
      const uri = text(resource, "uri");
      return [uri ? code(uri) : "", resourceBody(resource)]
        .filter(Boolean)
        .join("\n\n");
    }
    default: {
      return json(entry);
    }
  }
}

/** The blocks of a content array, joined, skipping any that rendered empty. */
function blocks(content: unknown[]): string {
  return content
    .map((entry) => block(entry))
    .filter(Boolean)
    .join("\n\n");
}

/** The catalog arrays a `…/list` answer can carry, with how to name an entry. */
const CATALOGS: [key: string, noun: string, id: string][] = [
  ["tools", "tools", "name"],
  ["prompts", "prompts", "name"],
  ["resources", "resources", "uri"],
  ["resourceTemplates", "resource templates", "uriTemplate"],
];

/**
 * A `…/list` answer, as a list.
 *
 * A list and not a table: descriptions run long, a narrow screen squeezes a
 * table into a column of single words, and a `|` inside a description would
 * split its row. One item per entry — its identifier in code, its human name
 * if it has a different one, and its description on the same line.
 */
function catalog(items: unknown[], noun: string, id: string): string {
  const rows = items.filter((x) => isRecord(x));
  if (rows.length === 0) return `*No ${noun}.*`;
  const lines = rows.map((row) => {
    const key = text(row, id) ?? text(row, "name") ?? "?";
    const label = text(row, "title") ?? text(row, "name");
    const desc = text(row, "description");
    const named = label && label !== key ? " **" + oneLine(label) + "**" : "";
    const described = desc ? " — " + oneLine(desc) : "";
    return `- ${code(key)}${named}${described}`;
  });
  return [`**${rows.length} ${noun}**`, lines.join("\n")].join("\n\n");
}

/** An `initialize` answer: who the server is, what it can do, and what it says. */
function initialize(result: Record<string, unknown>): string {
  const info = isRecord(result.serverInfo) ? result.serverInfo : {};
  const caps = isRecord(result.capabilities)
    ? Object.keys(result.capabilities)
    : [];
  const name = text(info, "title") ?? text(info, "name") ?? "server";
  const version = text(info, "version");
  const out = [`## ${name}${version ? " " + version : ""}`];
  const desc = text(info, "description");
  if (desc) out.push(desc);
  const protocol = text(result, "protocolVersion");
  if (protocol) out.push(`Protocol ${code(protocol)}`);
  if (caps.length > 0) {
    out.push(
      `**Capabilities:** ${caps
        .toSorted((a, b) => a.localeCompare(b))
        .map((c) => code(c))
        .join(" ")}`,
    );
  }
  const instructions = text(result, "instructions");
  if (instructions) out.push("## Instructions", instructions);
  return out.join("\n\n");
}

/** A JSON-RPC error: its code and message first, any data after. */
function error(err: Record<string, unknown>): string {
  const codeValue = typeof err.code === "number" ? String(err.code) : "?";
  const message = text(err, "message") ?? "no message";
  const head = `**Error ${codeValue}** — ${oneLine(message)}`;
  return err.data === undefined ? head : `${head}\n\n${json(err.data)}`;
}

/** A `tools/call` result: its content blocks, flagged if the tool failed. */
function toolResult(
  result: Record<string, unknown>,
  content: unknown[],
): string {
  const shown = blocks(content);
  const parts = [];
  if (result.isError === true) parts.push("**The tool reported an error.**");
  if (shown) parts.push(shown);
  // Only when the text said nothing: a server that sends both usually puts
  // the same data in each, and printing it twice helps no one.
  if (!shown && result.structuredContent !== undefined) {
    parts.push(json(result.structuredContent));
  }
  return parts.length > 0
    ? parts.join("\n\n")
    : "*The tool returned no content.*";
}

/** A `prompts/get` result: its description, then each message under its role. */
function promptResult(
  result: Record<string, unknown>,
  messages: unknown[],
): string {
  const parts = [];
  const desc = text(result, "description");
  if (desc) parts.push(`*${oneLine(desc)}*`);
  for (const message of messages) {
    if (!isRecord(message)) continue;
    const role = text(message, "role") ?? "message";
    const content = Array.isArray(message.content)
      ? blocks(message.content)
      : block(message.content);
    parts.push(`**${role}**`, content || "*(empty)*");
  }
  return parts.join("\n\n");
}

/** A `resources/read` result: each item under its URI. */
function resourceResult(contents: unknown[]): string {
  const parts = contents
    .filter((item) => isRecord(item))
    .map((item) => {
      const uri = text(item, "uri");
      return [uri ? `### ${code(uri)}` : "", resourceBody(item)]
        .filter(Boolean)
        .join("\n\n");
    });
  return parts.length > 0 ? parts.join("\n\n") : "*The resource is empty.*";
}

/** A `completion/complete` result: the suggested values. */
function completionResult(values: unknown[]): string {
  const found = values.filter((v) => typeof v === "string");
  return found.length > 0
    ? found.map((v) => `- ${code(v)}`).join("\n")
    : "*No completions.*";
}

/**
 * The Markdown for a `result`, by its shape.
 *
 * The order matters where shapes could overlap: a result is recognized by the
 * FIRST field it carries from this list, and a tool result is checked before
 * anything else because it is by far the most common answer.
 */
function resultMarkdown(result: Record<string, unknown>): string {
  if (Array.isArray(result.content)) return toolResult(result, result.content);
  if (Array.isArray(result.messages))
    return promptResult(result, result.messages);
  if (Array.isArray(result.contents)) return resourceResult(result.contents);
  for (const [key, noun, id] of CATALOGS) {
    const items = result[key];
    if (Array.isArray(items)) return catalog(items, noun, id);
  }
  if (
    isRecord(result.serverInfo) ||
    typeof result.protocolVersion === "string"
  ) {
    return initialize(result);
  }
  if (isRecord(result.completion) && Array.isArray(result.completion.values)) {
    return completionResult(result.completion.values);
  }
  // ping, and anything else that succeeds with an empty object.
  if (Object.keys(result).length === 0) {
    return "*Empty result: the call succeeded and returned nothing.*";
  }
  return json(result);
}

/**
 * The Markdown for one response.
 *
 * @param body The JSON-RPC body the server answered with.
 * @returns Markdown source for the reader view, or `undefined` only when
 *   there is no body at all — nothing has been sent yet.
 */
export function readerMarkdown(body: unknown): string | undefined {
  if (body === undefined || body === null) return undefined;
  if (!isRecord(body)) return json(body);
  if (isRecord(body.error)) return error(body.error);
  return isRecord(body.result) ? resultMarkdown(body.result) : json(body);
}
