import "./DomainActionsFilter.css";

import { useEffect, useState } from "preact/hooks";

import type { Lang } from "../i18n/ui";
import { serversPage } from "../i18n/ui/servers-page";

/**
 * Isla del filtro de una página de dominio
 * (`/servers/<id>/actions/<dominio>/`).
 *
 * Progresiva como `ActionSearch`: el pase SSR emite `null`, así que sin
 * JavaScript no existe ningún control y la lista completa de `<details>`
 * colapsados — que la página pinta por SSR — es el contenido íntegro y
 * navegable. Al hidratar aparecen el input y los dos conmutadores.
 *
 * A diferencia de `ActionSearch`, aquí NO se descarga ningún índice: el dato
 * ya está en el DOM (la página lo publica entero, que es el punto de que sea
 * indexable). La isla solo LEE los `<details data-*>` que la página emitió —
 * la descripción del TEXTO ya renderizado, no de un data-attr que la
 * duplicaría (~300 KB en `project`) — y los muestra/oculta/reordena:
 *
 * - Coincidencia por id/título → visible, en su orden natural (order 0).
 * - Coincidencia solo por descripción → visible al final (order 1) y
 *   ABIERTA, para que se vea por qué casa; al limpiar el filtro se cierra.
 * - Sin coincidencia → oculta.
 *
 * La reordenación es CSS `order` sobre el contenedor flex — el DOM no se
 * mueve, así que los anclajes (`#<id>`) y el estado abierto/cerrado del
 * usuario sobreviven al filtrado.
 *
 * El deep-link `#<action-id>` también vive aquí: al montar, si el hash nombra
 * una acción, se abre y se hace scroll. Sin JS el ancla sigue funcionando
 * (el navegador salta al `<details>`, solo que colapsado).
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
  return [...list.querySelectorAll<HTMLDetailsElement>("details.action-item")].map(
    (el) => ({
      el,
      item: el.closest("li") ?? el,
      name: `${el.dataset.actionId ?? ""} ${el.dataset.actionTitle ?? ""}`.toLowerCase(),
      desc: (el.querySelector(".action-desc")?.textContent ?? "").toLowerCase(),
      destructive: el.dataset.destructive === "true",
      readOnly: el.dataset.readOnly === "true",
    }),
  );
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
      (!onlyDestructive || card.destructive) && (!onlyReadOnly || card.readOnly);
    const nameHit = q === "" || card.name.includes(q);
    const descHit = q !== "" && !nameHit && card.desc.includes(q);
    const show = passesToggles && (nameHit || descHit);
    card.item.hidden = !show;
    // Reordenación sin mover el DOM: ver el comentario de cabecera.
    card.item.style.order = descHit ? "1" : "0";
    // Solo se fuerza el estado en coincidencias por descripción; el
    // abierto/cerrado que el usuario haya dejado en el resto se respeta.
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
 * decodeURIComponent por si el cliente codifica el punto de los ids.
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

  // Handles del DOM en estado (una sola escritura al montar): los helpers de
  // módulo son quienes los mutan; el componente solo decide CUÁNDO.
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
      <label className="domain-filter-label" htmlFor="domain-filter-q">
        <span className="sr-only">{sp.domainFilterLabel}</span>
        <input
          id="domain-filter-q"
          type="search"
          className="domain-filter-input"
          placeholder={sp.domainFilterPlaceholder}
          value={query}
          onInput={(event) => setQuery((event.target as HTMLInputElement).value)}
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
      {/* Fila propia para leyenda + contador: dejarlos en el flex de los
          conmutadores hacía que en móvil el wrap partiera la leyenda por
          cualquier sitio (captura del autor). Dos filas deliberadas: arriba
          los conmutadores; aquí la leyenda a la izquierda y el contador a la
          derecha. Los estilos del punto viven en el CSS de la isla: los
          scoped de la página no alcanzan al DOM renderizado en cliente. */}
      <div className="domain-filter-status">
        <span className="domain-legend">
          <span className="df-dot df-dot--destructive" aria-hidden="true"></span>
          {sp.domainChipDestructive}
        </span>
        <span className="domain-legend">
          <span className="df-dot df-dot--readonly" aria-hidden="true"></span>
          {sp.domainChipReadOnly}
        </span>
        <span className="domain-filter-count" aria-live="polite">
          {countText}
        </span>
      </div>
      {shown === 0 && <p className="domain-filter-empty">{sp.domainFilterNoMatch}</p>}
    </div>
  );
}
