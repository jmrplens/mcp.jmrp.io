import type { JsonSchema } from "./tool-schema";

/**
 * Lectura de los otros dos catálogos del protocolo: `prompts/list` y
 * `resources/list`.
 *
 * El inspector solo los listaba: se veía que existían 37 prompts,
 * pero no qué argumentos pedía cada uno ni qué devolvía. Aquí se normalizan
 * para poder pintarlos y, principalmente, para poder usarlos.
 *
 * Los prompts declaran sus argumentos como un array `{name, description,
 * required}`, no como un JSON Schema. `promptSchema` los traduce a un esquema
 * para que el formulario se genere con el mismo código que el de las tools.
 */

/** Argumento de un prompt, tal y como lo declara `prompts/list`. */
export type PromptArgument = {
  name: string;
  description?: string;
  required?: boolean;
};

/** Un prompt del catálogo. */
export type McpPrompt = {
  name: string;
  title?: string;
  description?: string;
  arguments: PromptArgument[];
};

/** Un recurso del catálogo. */
export type McpResource = {
  uri: string;
  name?: string;
  title?: string;
  description?: string;
  mimeType?: string;
};

/** El valor si es una cadena; si no, la alternativa. */
function str(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

/** `true` si el valor es un objeto plano (no null, no array). */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** El array que cuelga de `result.<key>`, o vacío. */
function listOf(body: unknown, key: string): Record<string, unknown>[] {
  if (!isRecord(body)) return [];
  const result = body.result;
  if (!isRecord(result)) return [];
  const items = result[key];
  return Array.isArray(items) ? items.filter((x) => isRecord(x)) : [];
}

/**
 * Normaliza la respuesta de `prompts/list`.
 *
 * @param body Cuerpo JSON-RPC de la respuesta.
 * @returns Los prompts, con sus argumentos ya normalizados.
 */
export function promptsFrom(body: unknown): McpPrompt[] {
  return listOf(body, "prompts").map((entry) => ({
    name: str(entry.name),
    title: typeof entry.title === "string" ? entry.title : undefined,
    description:
      typeof entry.description === "string" ? entry.description : undefined,
    arguments: Array.isArray(entry.arguments)
      ? entry.arguments.filter((a) => isRecord(a)).map((a) => ({
          name: str(a.name),
          description:
            typeof a.description === "string" ? a.description : undefined,
          required: a.required === true,
        }))
      : [],
  }));
}

/**
 * Normaliza la respuesta de `resources/list`.
 *
 * @param body Cuerpo JSON-RPC de la respuesta.
 * @returns Los recursos declarados por el servidor.
 */
export function resourcesFrom(body: unknown): McpResource[] {
  return listOf(body, "resources").map((entry) => ({
    uri: str(entry.uri),
    name: typeof entry.name === "string" ? entry.name : undefined,
    title: typeof entry.title === "string" ? entry.title : undefined,
    description:
      typeof entry.description === "string" ? entry.description : undefined,
    mimeType: typeof entry.mimeType === "string" ? entry.mimeType : undefined,
  }));
}

/**
 * Traduce los argumentos de un prompt a un JSON Schema.
 *
 * Los prompts no declaran esquema —solo nombre, descripción y si es
 * obligatorio— pero el formulario ya sabe pintar un esquema. Traducirlos aquí
 * evita un segundo generador de formularios que se desincronizaría del primero.
 *
 * Todos los argumentos de un prompt son cadenas por definición del protocolo.
 *
 * @param args Argumentos declarados por el prompt.
 * @returns Un esquema equivalente.
 */
export function promptSchema(args: PromptArgument[]): JsonSchema {
  return {
    type: "object",
    properties: Object.fromEntries(
      args.map((a) => [a.name, { type: "string", description: a.description }]),
    ),
    required: args.filter((a) => a.required).map((a) => a.name),
  };
}
