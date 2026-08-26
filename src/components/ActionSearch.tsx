import "./ActionSearch.css";

import { useEffect, useState } from "preact/hooks";

import type { Lang } from "../i18n/ui";
import { serversPage } from "../i18n/ui/servers-page";

/**
 * Isla Preact del buscador sobre el catálogo de acciones de gitlab
 * (`gitlab://tools`).
 *
 * Progresiva de verdad: el pase SSR emite `null`, así que en el HTML
 * estático no existe ningún control — sin JavaScript, la tabla de dominios
 * que la página pinta encima de esta isla ya es el contenido completo. Al
 * hidratar aparece el input, y el índice no se descarga al montar sino en el
 * PRIMER foco: quien no usa el buscador no paga la transferencia.
 *
 * El índice llega por `fetch` same-origin de la URL que la página pasa por
 * prop (`indexUrl`: el endpoint estático `/servers/<id>/actions.json`, la
 * vista sin credenciales del manifiesto que emite
 * `src/pages/servers/[server]/actions.json.ts`). Aquí no se importa
 * `src/data/surface.ts` ni ningún módulo `node:`: ese loader lee del disco
 * y rompería el bundle de cliente a propósito — ver su cabecera.
 *
 * Los identificadores del protocolo (id, dominio, nombres de tool) no se
 * traducen, como en el inspector; solo la interfaz alrededor
 * (`serversPage[lang]`) es bilingüe.
 */

/**
 * Una entrada del índice, con los cinco campos en lista blanca del snapshot
 * (`read_only` en snake_case: proyección literal del manifiesto, no
 * transformación). Duplicado consciente del tipo de `surface.ts`: ese módulo
 * no puede entrar en un bundle de cliente, y la guardia estructural de la
 * forma vive en el extractor y sus tests.
 */
interface ActionIndexEntry {
  id: string;
  title: string;
  domain: string;
  destructive: boolean;
  read_only: boolean;
}

/** Máximo de resultados pintados; el resto se resume en la línea de conteo. */
const MAX_RESULTS = 50;

type LoadState = "idle" | "loading" | "ready" | "error";

/** Guardia mínima sobre lo que devuelve el fetch antes de pintarlo. */
function isIndexEntry(value: unknown): value is ActionIndexEntry {
  if (typeof value !== "object" || value === null) return false;
  const entry = value as Record<string, unknown>;
  return (
    typeof entry.id === "string" &&
    typeof entry.title === "string" &&
    typeof entry.domain === "string" &&
    typeof entry.destructive === "boolean" &&
    typeof entry.read_only === "boolean"
  );
}

/**
 * Buscador progresivo del catálogo de acciones.
 *
 * @param props.lang Idioma de la página que monta la isla.
 * @param props.indexUrl URL same-origin del snapshot con las entradas.
 * @param props.domainPageBase Prefijo localizado de las páginas por dominio
 *   (`/servers/<id>/actions/`); el dominio del resultado se concatena tal cual.
 * @returns El buscador hidratado, o `null` en el pase SSR.
 */
export default function ActionSearch({
  lang,
  indexUrl,
  domainPageBase,
}: Readonly<{ lang: Lang; indexUrl: string; domainPageBase: string }>) {
  const sp = serversPage[lang];
  /**
   * `mounted` separa el pase SSR del render hidratado: el efecto solo corre
   * en cliente, así que el HTML estático nunca contiene un input muerto.
   */
  const [mounted, setMounted] = useState(false);
  const [state, setState] = useState<LoadState>("idle");
  const [entries, setEntries] = useState<ActionIndexEntry[]>([]);
  const [query, setQuery] = useState("");

  useEffect(() => {
    setMounted(true);
  }, []);

  /**
   * Descarga el índice al primer foco del input (una sola vez si va bien).
   * Desde "error" se permite reintentar en el siguiente foco: un fallo
   * transitorio de red no debe dejar el buscador muerto hasta recargar.
   */
  async function load(): Promise<void> {
    if (state !== "idle" && state !== "error") return;
    setState("loading");
    try {
      const response = await fetch(indexUrl);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data: unknown = await response.json();
      const raw = (data as { entries?: unknown }).entries;
      if (!Array.isArray(raw)) throw new Error("índice sin entries");
      setEntries(raw.filter((item) => isIndexEntry(item)));
      setState("ready");
    } catch {
      // La tabla SSR de arriba sigue contando cada dominio; aquí solo se
      // avisa de que el buscador no está disponible.
      setState("error");
    }
  }

  if (!mounted) return null;

  const needle = query.trim().toLowerCase();
  const matches = needle
    ? entries.filter(
        (entry) =>
          entry.id.toLowerCase().includes(needle) ||
          entry.title.toLowerCase().includes(needle) ||
          entry.domain.toLowerCase().includes(needle),
      )
    : [];
  const shown = matches.slice(0, MAX_RESULTS);
  const overflow = matches.length - shown.length;

  return (
    <div className="action-search">
      <label className="as-label" htmlFor="action-search-q">
        {sp.searchLabel}
      </label>
      <input
        id="action-search-q"
        className="as-input"
        type="search"
        placeholder={sp.searchPlaceholder}
        value={query}
        onFocus={() => void load()}
        onInput={(e) => setQuery((e.target as HTMLInputElement).value)}
      />
      <section
        className="as-results"
        aria-live="polite"
        aria-label={sp.searchResultsLabel}
      >
        {state === "loading" && <p className="as-note">{sp.searchLoading}</p>}
        {state === "error" && <p className="as-note">{sp.searchError}</p>}
        {state === "ready" && needle !== "" && matches.length === 0 && (
          <p className="as-note">{sp.searchNoResults}</p>
        )}
        {shown.length > 0 && (
          <ul className="as-list">
            {shown.map((entry) => (
              <li key={entry.id} className="as-item">
                {/* El id enlaza a su ficha de referencia: la página del
                    dominio, con el ancla de la acción (la isla de allí lo
                    abre; sin JS el navegador salta igual). */}
                <a
                  className="as-id-link"
                  href={`${domainPageBase}${entry.domain}/#${entry.id}`}
                >
                  <code className="as-id">{entry.id}</code>
                </a>
                <span className="as-title">{entry.title}</span>
                <span className="chip as-chip--domain">{entry.domain}</span>
                {entry.destructive && (
                  <span className="chip as-chip--destructive">
                    {sp.annotationDestructive}
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
        {overflow > 0 && (
          <p className="as-note">
            {overflow} {sp.searchMoreResults}
          </p>
        )}
      </section>
    </div>
  );
}
