/**
 * Reading the tool catalog `tools/list` returns, and each tool's
 * `inputSchema`.
 *
 * It lives apart from the component for two reasons. The first is that it can
 * be tested with `node --test`, no browser and no network. The second is that
 * what is here is the difference between guessing the arguments and knowing
 * them: the servers validate strictly (one extra property aborts the call with
 * `unexpected additional properties`), so the skeleton `skeletonFor` produces
 * is the only thing that stops a visitor's first attempt from always failing.
 *
 * The JSON Schema is NOT validated: only the part that can be rendered is read
 * (`properties`, `required`, `type`, `description`, `enum`, `default`). A
 * schema with `oneOf`, `$ref` or composition is still shown for whatever it
 * has of those keys, and the visitor fills the rest in by hand.
 */

/** The slice of JSON Schema this module knows how to read. */
export type JsonSchema = {
  /** May be an array: `["null","array"]` marks an optional. */
  type?: string | string[];
  title?: string;
  description?: string;
  properties?: Record<string, JsonSchema>;
  required?: string[];
  items?: JsonSchema;
  enum?: unknown[];
  default?: unknown;
  /** Composition: libgen 1.7.1 declares its identifier groups this way. */
  anyOf?: JsonSchema[];
  oneOf?: JsonSchema[];
};

/** A tool exactly as `tools/list` declares it. */
export type McpTool = {
  name: string;
  title?: string;
  description?: string;
  inputSchema?: JsonSchema;
};

/** One `inputSchema` property, flattened for rendering in a table. */
export type SchemaField = {
  name: string;
  /** Readable type: `string`, `string[]`, `"a" | "b"`… Empty when undeclared. */
  type: string;
  required: boolean;
  description: string;
};

/**
 * The schema's alternative requirement groups, when it declares any.
 *
 * libgen 1.7.1 (at this site's audit's request) encodes "at least one of
 * md5/isbn/doi" as an `anyOf` of `{required: [...]}` branches, and
 * get_details' "exactly one" as a `oneOf`. This reader extracts ONLY that
 * shape: branches whose `required` is a non-empty list of strings. Any other
 * composition returns undefined and the form says nothing — half a truth about
 * a schema is worse than showing it as it is (the module's rule: nothing is
 * validated, what is readable is rendered).
 *
 * @param schema The tool's `inputSchema`.
 * @returns The branches with their kind, or undefined when there are no
 *   readable groups.
 */
export function requirementGroups(
  schema: JsonSchema | undefined,
): { kind: "anyOf" | "oneOf"; groups: string[][] } | undefined {
  if (!schema) return undefined;
  let kind: "anyOf" | "oneOf" | undefined;
  if (schema.oneOf) kind = "oneOf";
  else if (schema.anyOf) kind = "anyOf";
  if (!kind) return undefined;
  const branches = (kind === "oneOf" ? schema.oneOf : schema.anyOf) ?? [];
  const groups: string[][] = [];
  for (const branch of branches) {
    const req = branch.required;
    if (
      !Array.isArray(req) ||
      req.length === 0 ||
      req.some((x) => typeof x !== "string")
    ) {
      return undefined;
    }
    groups.push(req);
  }
  return groups.length > 0 ? { kind, groups } : undefined;
}

/** `true` when the value is a plain object (not null, not an array). */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * The `inputSchema` of a `tools/list` entry.
 *
 * `input_schema` is accepted too: it is the spec's snake_case name and some
 * servers emit it that way. Accepting both costs one line; not accepting it
 * leaves the arguments table empty without saying why.
 */
function inputSchemaOf(entry: Record<string, unknown>): JsonSchema | undefined {
  const raw = isRecord(entry.inputSchema)
    ? entry.inputSchema
    : entry.input_schema;
  return isRecord(raw) ? raw : undefined;
}

/**
 * Pulls the tool list out of a `tools/list` JSON-RPC body.
 *
 * Returns `[]` for any unexpected shape rather than throwing: this is called
 * on whatever an arbitrary server answers, and one odd response must not take
 * the whole island down.
 *
 * @param body The parsed JSON-RPC body.
 * @returns The named tools, in the order the server gave them.
 */
export function toolsFrom(body: unknown): McpTool[] {
  if (!isRecord(body)) return [];
  const result = body.result;
  if (!isRecord(result)) return [];
  const list = result.tools;
  if (!Array.isArray(list)) return [];

  const tools: McpTool[] = [];
  for (const entry of list) {
    if (!isRecord(entry)) continue;
    const name = entry.name;
    if (typeof name !== "string" || !name) continue;
    tools.push({
      name,
      title: typeof entry.title === "string" ? entry.title : undefined,
      description:
        typeof entry.description === "string" ? entry.description : undefined,
      inputSchema: inputSchemaOf(entry),
    });
  }
  return tools;
}

/** A property type's readable name, arrays and enums included. */
/**
 * The declared type, with `"null"` discarded.
 *
 * `type` can arrive as an array — `["null","array"]` marks an optional — and
 * rendering it as-is gave "nullarray", which is nothing's type.
 *
 * @param type The schema's `type`.
 * @returns The real type, or `undefined` when undeclared.
 */
function baseType(type: string | string[] | undefined): string | undefined {
  return Array.isArray(type) ? type.find((x) => x !== "null") : type;
}

function typeLabel(schema: JsonSchema): string {
  if (Array.isArray(schema.enum) && schema.enum.length > 0) {
    return schema.enum.map((v) => JSON.stringify(v)).join(" | ");
  }
  const base = baseType(schema.type);
  if (base === "array") {
    const item = baseType(schema.items?.type);
    return item ? `${item}[]` : "array";
  }
  return base ?? "";
}

/**
 * Flattens `inputSchema.properties` into a table of properties.
 *
 * The required ones come first: they are what the visitor has to fill in no
 * matter what, and in schemas with fifteen optional properties they were
 * buried.
 *
 * @param schema A tool's `inputSchema`.
 * @returns The properties, required first and otherwise in declaration order.
 */
export function schemaFields(schema: JsonSchema | undefined): SchemaField[] {
  if (!schema?.properties) return [];
  const required = new Set(schema.required);
  const fields = Object.entries(schema.properties).map(([name, prop]) => ({
    name,
    type: typeLabel(prop ?? {}),
    required: required.has(name),
    description: prop?.description ?? "",
  }));
  // sort() is stable in JS, so within each group the server's declaration
  // order survives, which is usually the order in which they make sense.
  return fields.sort((a, b) => Number(b.required) - Number(a.required));
}

/** A property's filler value, by type. */
function placeholderFor(schema: JsonSchema): unknown {
  if (schema.default !== undefined) return schema.default;
  if (Array.isArray(schema.enum) && schema.enum.length > 0)
    return schema.enum[0];
  switch (schema.type) {
    case "number":
    case "integer": {
      return 0;
    }
    case "boolean": {
      return false;
    }
    case "array": {
      return [];
    }
    case "object": {
      return {};
    }
    default: {
      return "";
    }
  }
}

/**
 * A tool's argument skeleton: JSON with ONLY the required properties.
 *
 * Only the required ones, and that is deliberate: sending every optional with
 * its default changes what the call means (a `page: 0` the visitor never asked
 * for), and some servers reject empty values they would not have rejected had
 * the property been absent. The optionals are shown in the table, not sent.
 *
 * @param schema The chosen tool's `inputSchema`.
 * @returns Indented JSON, ready for the textarea. `{}` when nothing is
 *   required.
 */
export function skeletonFor(schema: JsonSchema | undefined): string {
  const required = schema?.required ?? [];
  const properties = schema?.properties ?? {};
  if (required.length === 0) return "{}";

  const skeleton: Record<string, unknown> = {};
  for (const name of required) {
    skeleton[name] = placeholderFor(properties[name] ?? {});
  }
  return JSON.stringify(skeleton, null, 2);
}

/* ==========================================================================
 * Forms
 *
 * Everything above describes a schema in order to READ it; everything here, in
 * order to FILL IT IN. The inspector used to ask for arguments as raw JSON,
 * which is the interface an LLM needs and a person does not: it requires
 * knowing the property names, their types and which are required by heart.
 * ========================================================================== */

/** The control a property is asked for with. */
export type FieldControl =
  "text" | "textarea" | "number" | "checkbox" | "select" | "list" | "json";

/** One schema property, already resolved to a concrete control. */
export type FormField = SchemaField & {
  control: FieldControl;
  /** The `select`'s options, when there are any. */
  options: string[];
  /** The initial value, already as text. Comes from the schema's `default`. */
  initial: string;
  /** For `list` and `json`: what is expected, in one line. */
  hint: string;
};

/**
 * Picks a property's control.
 *
 * `enum` beats the type: if the server enumerates the valid values, a dropdown
 * prevents the mistake before it is made. Everything else follows `type`, and
 * whatever is not recognized falls back to JSON, which always works.
 *
 * @param schema The property's schema.
 * @returns The control to ask for it with.
 */
function controlFor(schema: JsonSchema): FieldControl {
  if (Array.isArray(schema.enum) && schema.enum.length > 0) return "select";
  switch (baseType(schema.type)) {
    case "boolean": {
      return "checkbox";
    }
    case "number":
    case "integer": {
      return "number";
    }
    case "array": {
      // A list of simple values is typed line by line; there is no honest way
      // to ask for a list of objects without JSON.
      const item = baseType(schema.items?.type);
      return item === undefined || ["object", "array"].includes(item)
        ? "json"
        : "list";
    }
    case "object": {
      return "json";
    }
    case "string": {
      // Long text (a query, a body) is far better in a textarea. The heuristic
      // is the description, which is all there is.
      const d = (schema.description ?? "").toLowerCase();
      return d.includes("markdown") || d.includes("body") || d.includes("text")
        ? "textarea"
        : "text";
    }
    default: {
      return "text";
    }
  }
}

/** What is expected in the controls whose format is not self-evident. */
const HINTS: Partial<Record<FieldControl, string>> = {
  list: "un valor por línea",
  json: "JSON",
};

/**
 * A field's initial value, as text.
 *
 * @param value The `default` the schema declares.
 * @returns The value as-is when it is already text, its JSON when not, or
 *   empty.
 */
function initialValue(value: unknown): string {
  if (value === undefined) return "";
  return typeof value === "string" ? value : JSON.stringify(value);
}

/**
 * Describes a tool's or a prompt's form.
 *
 * @param schema The tool's `inputSchema`.
 * @returns One field per property, required ones first.
 */
export function formFields(schema: JsonSchema | undefined): FormField[] {
  if (!schema?.properties) return [];
  return schemaFields(schema).map((field) => {
    const prop = schema.properties?.[field.name] ?? {};
    const control = controlFor(prop);
    const initial = initialValue(prop.default);
    return {
      ...field,
      control,
      options: Array.isArray(prop.enum) ? prop.enum.map(String) : [],
      initial,
      hint: HINTS[control] ?? "",
    };
  });
}

/** The two messages this can throw, already in the reader's language. */
export interface ArgErrors {
  /** `{field}` and `{value}` are substituted. */
  notANumber: string;
  /** `{field}` and `{detail}` are substituted. */
  badJson: string;
}

/**
 * Turns what was typed into the call's arguments.
 *
 * Empty strings are OMITTED rather than sent: the servers validate strictly and
 * an empty optional is rejected just like a malformed one. It is the difference
 * between "I am not filling this in" and "I am filling it in with nothing".
 *
 * The error texts are passed in rather than written here. They used to be
 * hardcoded in one language while the panel appends them to a localized
 * prefix, so a reader in the other language was shown a message that was
 * half translated. This module has no locale of its own, so the caller
 * supplies both.
 *
 * @param fields The form's fields.
 * @param values What was typed, by property name.
 * @param errors The messages to throw, in the page's language.
 * @returns The arguments, ready for `tools/call`.
 * @throws When a JSON or number field cannot be converted.
 */
export function valuesToArgs(
  fields: FormField[],
  values: Record<string, string>,
  errors: ArgErrors,
): Record<string, unknown> {
  const args: Record<string, unknown> = {};

  for (const field of fields) {
    const raw = (values[field.name] ?? "").trim();
    if (raw === "") continue;

    switch (field.control) {
      case "checkbox": {
        args[field.name] = raw === "true";
        break;
      }
      case "number": {
        const n = Number(raw);
        if (Number.isNaN(n)) {
          throw new TypeError(
            errors.notANumber
              .replace("{field}", () => field.name)
              .replace("{value}", () => raw),
          );
        }
        args[field.name] = n;
        break;
      }
      case "list": {
        args[field.name] = raw
          .split("\n")
          .map((line) => line.trim())
          .filter(Boolean);
        break;
      }
      case "json": {
        try {
          args[field.name] = JSON.parse(raw);
        } catch (error) {
          throw new TypeError(
            errors.badJson
              .replace("{field}", () => field.name)
              .replace("{detail}", () => String(error)),
          );
        }
        break;
      }
      default: {
        args[field.name] = raw;
      }
    }
  }

  return args;
}
