import type { Lang } from "../i18n/ui";
import { ui } from "../i18n/ui";
import { formatBytes, formatMs } from "../lib/format";
import { type McpTool, schemaFields } from "../lib/tool-schema";
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
