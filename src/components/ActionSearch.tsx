import "./ActionSearch.css";

import { useEffect, useState } from "preact/hooks";

import type { Lang } from "../i18n/ui";
import { serversPage } from "../i18n/ui/servers-page";

/**
 * The Preact island for searching gitlab's action catalog
 * (`gitlab://tools`).
 *
 * Genuinely progressive: the SSR pass emits `null`, so no control exists in
 * the static HTML at all — without JavaScript, the domain table the page
 * renders above this island is already the complete content. On hydration the
 * input appears, and the index is not downloaded on mount but on FIRST focus:
 * whoever does not use the search pays no transfer.
 *
 * The index arrives through a same-origin `fetch` of the URL the page passes
 * as a prop (`indexUrl`: the static endpoint `/servers/<id>/actions.json`, the
 * credential-free view of the manifest `src/pages/servers/[server]/actions.json.ts`
 * emits). Neither `src/data/surface.ts` nor any `node:` module is imported
 * here: that loader reads from disk and would break the client bundle on
 * purpose — see its header.
 *
 * The protocol's identifiers (id, domain, tool names) are not translated, as
 * in the inspector; only the interface around them (`serversPage[lang]`) is
 * bilingual.
 */

/**
 * One index entry, with the snapshot's five allowlisted fields (`read_only` in
 * snake_case: a literal projection of the manifest, not a transformation). A
 * deliberate duplicate of `surface.ts`'s type: that module cannot enter a
 * client bundle, and the structural guard on the shape lives in the extractor
 * and its tests.
 */
interface ActionIndexEntry {
  id: string;
  title: string;
  domain: string;
  destructive: boolean;
  read_only: boolean;
}

/** The maximum results rendered; the rest is summarized in the count line. */
const MAX_RESULTS = 50;

type LoadState = "idle" | "loading" | "ready" | "error";

/** A minimal guard on what the fetch returns, before rendering it. */
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
 * The progressive search over the action catalog.
 *
 * @param props.lang The language of the page mounting the island.
 * @param props.indexUrl The same-origin URL of the snapshot holding the entries.
 * @param props.domainPageBase The localized prefix for the per-domain pages
 *   (`/servers/<id>/actions/`); the result's domain is concatenated as-is.
 * @returns The hydrated search, or `null` on the SSR pass.
 */
export default function ActionSearch({
  lang,
  indexUrl,
  domainPageBase,
}: Readonly<{ lang: Lang; indexUrl: string; domainPageBase: string }>) {
  const sp = serversPage[lang];
  /**
   * `mounted` separates the SSR pass from the hydrated render: the effect only
   * runs on the client, so the static HTML never contains a dead input.
   */
  const [mounted, setMounted] = useState(false);
  const [state, setState] = useState<LoadState>("idle");
  const [entries, setEntries] = useState<ActionIndexEntry[]>([]);
  const [query, setQuery] = useState("");

  useEffect(() => {
    setMounted(true);
  }, []);

  /**
   * Downloads the index on the input's first focus (once, when it succeeds).
   * From "error" a retry is allowed on the next focus: a transient network
   * failure must not leave the search dead until a reload.
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
      // The SSR table above still counts every domain; this only says the
      // search itself is unavailable.
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
      <label
        className="as-label"
        htmlFor="action-search-q"
      >
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
              <li
                key={entry.id}
                className="as-item"
              >
                {/* The id links to its reference entry: the domain's page,
                    with the action's anchor (the island there opens it;
                    without JS the browser still jumps). */}
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
