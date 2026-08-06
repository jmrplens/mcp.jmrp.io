/**
 * Lectura del catálogo de tools que devuelve `tools/list` y del `inputSchema`
 * de cada una.
 *
 * Existe aparte del componente por dos razones. La primera es que se puede
 * probar con `node --test` sin navegador ni red. La segunda es que lo que hay
 * aquí es la diferencia entre adivinar los argumentos y saberlos: los
 * servidores validan estricto (una propiedad de más aborta la llamada con
 * `unexpected additional properties`), así que el esqueleto que sale de
 * `skeletonFor` es la única forma de que el primer intento del visitante no
 * falle siempre.
 *
 * NO se valida el JSON Schema: solo se lee la parte que se puede pintar
 * (`properties`, `required`, `type`, `description`, `enum`, `default`). Un
 * esquema con `oneOf`, `$ref` o composición se enseña igualmente por lo que
 * tenga de esas claves y el visitante completa el resto a mano.
 */

/** Trozo de JSON Schema que este módulo sabe leer. */
export type JsonSchema = {
  /** Puede ser un array: `["null","array"]` marca un opcional. */
  type?: string | string[];
  title?: string;
  description?: string;
  properties?: Record<string, JsonSchema>;
  required?: string[];
  items?: JsonSchema;
  enum?: unknown[];
  default?: unknown;
};

/** Una tool tal y como la declara `tools/list`. */
export type McpTool = {
  name: string;
  title?: string;
  description?: string;
  inputSchema?: JsonSchema;
};

/** Una propiedad del `inputSchema`, ya aplanada para pintarla en una tabla. */
export type SchemaField = {
  name: string;
  /** Tipo legible: `string`, `string[]`, `"a" | "b"`… Vacío si no se declara. */
  type: string;
  required: boolean;
  description: string;
};

/** `true` si el valor es un objeto plano (no null, no array). */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * El `inputSchema` de una entrada de `tools/list`.
 *
 * Se acepta también `input_schema`: es el nombre del spec en snake_case y
 * algún servidor lo emite así. Aceptar los dos cuesta una línea; no aceptarlo
 * deja la tabla de argumentos vacía sin decir por qué.
 */
function inputSchemaOf(entry: Record<string, unknown>): JsonSchema | undefined {
  const raw = isRecord(entry.inputSchema) ? entry.inputSchema : entry.input_schema;
  return isRecord(raw) ? raw : undefined;
}

/**
 * Saca la lista de tools de un cuerpo JSON-RPC de `tools/list`.
 *
 * Devuelve `[]` ante cualquier forma inesperada en vez de lanzar: esto se
 * llama sobre lo que conteste un servidor cualquiera, y una respuesta rara no
 * puede tumbar la isla entera.
 *
 * @param body Cuerpo JSON-RPC ya parseado.
 * @returns Las tools con nombre, en el orden en que las dio el servidor.
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

/** Nombre legible del tipo de una propiedad, incluido el de los arrays y enums. */
/**
 * El tipo declarado, descartando `"null"`.
 *
 * `type` puede venir como array —`["null","array"]` marca un opcional— y
 * pintarlo tal cual daba "nullarray", que no es el tipo de nada.
 *
 * @param type El `type` del esquema.
 * @returns El tipo real, o `undefined` si no se declara.
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
 * Aplana `inputSchema.properties` a una tabla de propiedades.
 *
 * Las obligatorias van primero: son las que el visitante tiene que rellenar
 * sí o sí, y en esquemas con quince propiedades opcionales quedaban
 * enterradas.
 *
 * @param schema El `inputSchema` de una tool.
 * @returns Las propiedades, obligatorias primero y por orden de declaración.
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
  // sort() es estable en JS, así que dentro de cada grupo se respeta el orden
  // de declaración del servidor, que suele ser el orden en que tienen sentido.
  return fields.sort((a, b) => Number(b.required) - Number(a.required));
}

/** Valor de relleno para una propiedad, por tipo. */
function placeholderFor(schema: JsonSchema): unknown {
  if (schema.default !== undefined) return schema.default;
  if (Array.isArray(schema.enum) && schema.enum.length > 0) return schema.enum[0];
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
 * Esqueleto de argumentos para una tool: JSON con SOLO las propiedades
 * obligatorias.
 *
 * Solo las obligatorias, y esto es deliberado: mandar todas las opcionales con
 * su valor por defecto cambia el significado de la llamada (un `page: 0` que
 * el visitante no pidió), y algunos servidores rechazan valores vacíos que no
 * habrían rechazado si la propiedad no viniera. Las opcionales se enseñan en
 * la tabla, no se envían.
 *
 * @param schema El `inputSchema` de la tool elegida.
 * @returns JSON indentado, listo para el textarea. `{}` si no hay obligatorias.
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
 * Formularios
 *
 * Lo de arriba describe un esquema para LEERLO; lo de aquí, para RELLENARLO.
 * El inspector pedía los argumentos como JSON crudo, que es la interfaz que
 * necesita un LLM y no una persona: obliga a saber de memoria los nombres de
 * las propiedades, su tipo y cuáles son obligatorias.
 * ========================================================================== */

/** Control con el que se pide una propiedad. */
export type FieldControl =
  | "text"
  | "textarea"
  | "number"
  | "checkbox"
  | "select"
  | "list"
  | "json";

/** Una propiedad del esquema, ya resuelta a un control concreto. */
export type FormField = SchemaField & {
  control: FieldControl;
  /** Opciones del `select`, si las hay. */
  options: string[];
  /** Valor inicial, ya en texto. Sale del `default` del esquema. */
  initial: string;
  /** Para `list` y `json`: qué se espera, en una línea. */
  hint: string;
};

/**
 * Elige el control de una propiedad.
 *
 * `enum` gana al tipo: si el servidor enumera los valores válidos, un
 * desplegable evita el error antes de cometerlo. Lo demás sigue al `type`, y
 * lo que no se reconoce cae a JSON, que siempre funciona.
 *
 * @param schema Esquema de la propiedad.
 * @returns El control con el que pedirla.
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
      // Una lista de valores simples se teclea línea a línea; una de objetos
      // no hay forma honesta de pedirla sin JSON.
      const item = baseType(schema.items?.type);
      return item === undefined || ["object", "array"].includes(item)
        ? "json"
        : "list";
    }
    case "object": {
      return "json";
    }
    case "string": {
      // Los textos largos (una consulta, un cuerpo) se agradecen en textarea.
      // La heurística es la descripción, que es lo único que hay.
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

/** Qué se espera en los controles cuyo formato no es evidente. */
const HINTS: Partial<Record<FieldControl, string>> = {
  list: "un valor por línea",
  json: "JSON",
};

/**
 * Valor inicial de un campo, en texto.
 *
 * @param value El `default` declarado por el esquema.
 * @returns El valor tal cual si ya es texto, su JSON si no, o vacío.
 */
function initialValue(value: unknown): string {
  if (value === undefined) return "";
  return typeof value === "string" ? value : JSON.stringify(value);
}

/**
 * Describe el formulario de una tool o de un prompt.
 *
 * @param schema El `inputSchema` de la tool.
 * @returns Un campo por propiedad, obligatorios primero.
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

/**
 * Convierte lo tecleado en el formulario a los argumentos de la llamada.
 *
 * Las cadenas vacías se OMITEN en vez de mandarse: los servidores validan
 * estricto y un opcional vacío se rechaza igual que uno mal escrito. Es la
 * diferencia entre «no lo relleno» y «lo relleno con nada».
 *
 * @param fields Campos del formulario.
 * @param values Lo tecleado, por nombre de propiedad.
 * @returns Los argumentos listos para `tools/call`.
 * @throws Si un campo JSON o de número no se puede convertir.
 */
export function valuesToArgs(
  fields: FormField[],
  values: Record<string, string>,
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
          throw new TypeError(`${field.name}: "${raw}" no es un número`);
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
          throw new TypeError(`${field.name}: JSON inválido — ${String(error)}`);
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
