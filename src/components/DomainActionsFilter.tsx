import "./DomainActionsFilter.css";

import { useEffect, useState } from "preact/hooks";

import type { Lang } from "../i18n/ui";
import { serversPage } from "../i18n/ui/servers-page";

/**
 * The filter island for a domain page
 * (`/servers/<id>/actions/<domain>/`).
 *
 * Progressive like `ActionSearch`: the SSR pass emits `null`, so without
 * JavaScript no control exists and the complete list of collapsed `<details>`
 * — which the page renders server-side — is the entire, navigable content. On
 * hydration the input and the two toggles appear.
 *
 * Unlike `ActionSearch`, NO index is downloaded here: the data is already in
 * the DOM (the page publishes all of it, which is the point of it being
 * indexable). The island only READS the `<details data-*>` the page emitted —
 * the description from the ALREADY-RENDERED text, not from a data-attr that
 * would duplicate it (~300 KB on `project`) — and shows/hides/reorders them:
 *
 * - A match on id/title → visible, in its natural order (order 0).
 * - A match on the description only → visible at the end (order 1) and OPEN,
 *   so it is clear why it matched; clearing the filter closes it again.
 * - No match → hidden.
 *
 * The reordering is CSS `order` on the flex container — the DOM does not move,
 * so the anchors (`#<id>`) and the reader's own open/closed state survive the
 * filtering.
 *
 * The `#<action-id>` deep link lives here too: on mount, if the hash names an
 * action, it is opened and scrolled to. Without JS the anchor still works (the
 * browser jumps to the `<details>`, just collapsed).
 */

/** The per-card handle the island reads once from the SSR'd DOM. */
interface CardRef {
  el: HTMLDetailsElement;
  /**
   * The flex item `hidden`/`order` must act on: the wrapping `<li>` (the flex
   * container is the `<ol>`). On the `<details>` itself, `order` is a no-op
   * and `hidden` still leaves the empty `<li>` contributing its row gap.
   */
  item: HTMLElement;
  /** id + title, lowercased — the first-class match target. */
  name: string;
  /** Full description text, lowercased — the second-class match target. */
  desc: string;
  destructive: boolean;
  readOnly: boolean;
}

/**
 * Reads the SSR'd cards once. Module-level on purpose: it (and
 * {@link applyFilter}) mutate DOM elements, which react-hooks/immutability
 * forbids inside the component body — and correctly so for render values;
 * these are page-owned nodes the island only enhances.
 *
 * @param listId DOM id of the list container.
 * @returns One handle per `<details class="action-item">`.
 */
function collectCards(listId: string): CardRef[] {
  const list = document.querySelector(`#${CSS.escape(listId)}`);
  if (!list) return [];
  return [
    ...list.querySelectorAll<HTMLDetailsElement>("details.action-item"),
  ].map((el) => ({
    el,
    item: el.closest("li") ?? el,
    name: `${el.dataset.actionId ?? ""} ${el.dataset.actionTitle ?? ""}`.toLowerCase(),
    desc: (el.querySelector(".action-desc")?.textContent ?? "").toLowerCase(),
    destructive: el.dataset.destructive === "true",
    readOnly: el.dataset.readOnly === "true",
  }));
}

/**
 * Applies one filter state to the cards; see the header for the
 * match/order/open rules.
 *
 * @param cards From {@link collectCards}.
 * @param rawQuery The input's value, untrimmed.
 * @param onlyDestructive The "destructive only" toggle.
 * @param onlyReadOnly The "read-only only" toggle.
 * @returns How many cards stay visible.
 */
function applyFilter(
  cards: readonly CardRef[],
  rawQuery: string,
  onlyDestructive: boolean,
  onlyReadOnly: boolean,
): number {
  const q = rawQuery.trim().toLowerCase();
  let visible = 0;
  for (const card of cards) {
    const passesToggles =
      (!onlyDestructive || card.destructive) &&
      (!onlyReadOnly || card.readOnly);
    const nameHit = q === "" || card.name.includes(q);
    const descHit = q !== "" && !nameHit && card.desc.includes(q);
    const show = passesToggles && (nameHit || descHit);
    card.item.hidden = !show;
    // Reordering without moving the DOM: see the header comment.
    card.item.style.order = descHit ? "1" : "0";
    // The state is only forced on description matches; whatever open/closed
    // state the reader left on the rest is respected.
    if (descHit) {
      card.el.open = true;
      card.el.dataset.autoOpened = "true";
    } else if (q === "" && card.el.dataset.autoOpened === "true") {
      card.el.open = false;
      delete card.el.dataset.autoOpened;
    }
    if (show) visible += 1;
  }
  return visible;
}

/**
 * Opens and scrolls to the action the URL hash names, if any.
 * decodeURIComponent in case the client encodes the dot in the ids.
 */
function openHashTarget(): void {
  const hash = decodeURIComponent(globalThis.location.hash.slice(1));
  if (!hash) return;
  const target = document.querySelector(`#${CSS.escape(hash)}`);
  if (target instanceof HTMLDetailsElement) {
    target.open = true;
    target.scrollIntoView();
  }
}

/**
 * Filter bar over the SSR'd action list of one domain page.
 *
 * @param props `lang` for the UI strings, `listId` naming the DOM container
 *   whose `<details>` it filters, `total` for the "{shown} of {total}" count.
 * @returns The controls once hydrated; `null` during SSR.
 */
export default function DomainActionsFilter({
  lang,
  listId,
  total,
}: Readonly<{ lang: Lang; listId: string; total: number }>) {
  const sp = serversPage[lang];
  const [mounted, setMounted] = useState(false);
  const [query, setQuery] = useState("");
  const [onlyDestructive, setOnlyDestructive] = useState(false);
  const [onlyReadOnly, setOnlyReadOnly] = useState(false);
  const [shown, setShown] = useState(total);

  // DOM handles in state (written once on mount): the module helpers are what
  // mutate them; the component only decides WHEN.
  const [cards, setCards] = useState<readonly CardRef[]>([]);

  useEffect(() => {
    setCards(collectCards(listId));
    setMounted(true);
    openHashTarget();
  }, [listId]);

  useEffect(() => {
    if (!mounted) return;
    setShown(applyFilter(cards, query, onlyDestructive, onlyReadOnly));
  }, [mounted, cards, query, onlyDestructive, onlyReadOnly]);

  if (!mounted) return null;

  const countText = sp.domainFilterCount
    .replace("{shown}", () => String(shown))
    .replace("{total}", () => String(total));

  return (
    <div className="domain-filter">
      <label
        className="domain-filter-label"
        htmlFor="domain-filter-q"
      >
        <span className="sr-only">{sp.domainFilterLabel}</span>
        <input
          id="domain-filter-q"
          type="search"
          className="domain-filter-input"
          placeholder={sp.domainFilterPlaceholder}
          value={query}
          onInput={(event) =>
            setQuery((event.target as HTMLInputElement).value)
          }
        />
      </label>
      <div className="domain-filter-toggles">
        <label className="domain-toggle">
          <input
            type="checkbox"
            checked={onlyDestructive}
            onChange={() => setOnlyDestructive((v) => !v)}
          />
          {sp.domainToggleDestructive}
        </label>
        <label className="domain-toggle">
          <input
            type="checkbox"
            checked={onlyReadOnly}
            onChange={() => setOnlyReadOnly((v) => !v)}
          />
          {sp.domainToggleReadOnly}
        </label>
      </div>
      {/* A row of its own for the legend and the counter: leaving them in the
          toggles' flex meant that on mobile the wrap broke the legend at any
          old point (the author's screenshot). Two rows, deliberately: the
          toggles above; here the legend on the left and the counter on the
          right. The dot's styles live in the island's CSS: the page's scoped
          ones do not reach DOM rendered on the client. */}
      <div className="domain-filter-status">
        <span className="domain-legend">
          <span
            className="df-dot df-dot--destructive"
            aria-hidden="true"
          ></span>
          {sp.domainChipDestructive}
        </span>
        <span className="domain-legend">
          <span
            className="df-dot df-dot--readonly"
            aria-hidden="true"
          ></span>
          {sp.domainChipReadOnly}
        </span>
        <span
          className="domain-filter-count"
          aria-live="polite"
        >
          {countText}
        </span>
      </div>
      {shown === 0 && (
        <p className="domain-filter-empty">{sp.domainFilterNoMatch}</p>
      )}
    </div>
  );
}
