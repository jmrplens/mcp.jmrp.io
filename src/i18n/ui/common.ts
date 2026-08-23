/**
 * Site identity strings: shared by more than one page.
 *
 * `title`, `metaTitle` and `lede` are not only the home page's hero text:
 * `seo.ts`, `og-[lang].png.ts`, `llms.ts` and `jsonld.ts` all read them as the
 * SITE's own identity (the OG image caption, the llms.txt index line, the
 * JSON-LD `description`, the 404 page's fallback description), so they live
 * here rather than in `home.ts`. `subtitle` exists purely for those same
 * machine-readable surfaces — it is not rendered on the page itself.
 */
export const common = {
  en: {
    title: "MCP servers",
    /**
     * `<title>` del documento, SEPARADO del `title` visible.
     *
     * El H1 debe seguir siendo corto («MCP servers»); el del documento no: con
     * 21 caracteres se desperdiciaba la mitad del ancho que renderiza Google y
     * —peor— la expresión por la que de verdad se busca esto, «Model Context
     * Protocol», solo aparecía en la description. Los ~60 caracteres son el
     * presupuesto que Google muestra antes de recortar.
     */
    metaTitle: "MCP servers — free Model Context Protocol endpoints · jmrp.io",
    subtitle: "Self-hosted Model Context Protocol servers, free to use.",
    lede: "Two Model Context Protocol servers, self-hosted and free to use. Point your MCP client at an endpoint, or try them in the browser.",
    // Chrome strings: header, footer and the skip link. Every page renders
    // them through `Base.astro`.
    /**
     * Read by the SHARED `UpdatedLine.astro`, which every page renders — so it
     * belongs here, not in one page's module. It lived in `policies.ts` and
     * only worked because that module happens to be spread into `ui`: the day
     * it were pulled out of the merge, as `internals` already was, the home
     * page would have lost its date silently.
     */
    updatedIn: "This page was last updated on",
    /**
     * The same sentence used to sit in three page modules, and `policies` had
     * to prefix its copy only because `inspector` already owned the bare name
     * in the merged `ui` object — the collision guard forced a rename instead
     * of the obvious fix. One string, one home.
     */
    backToHome: "Back to the servers",
    skip: "Skip to content",
    source: "Source",
    other: "Español",
    /**
     * Accessible label prefix for the inactive segment of the two-letter
     * `EN | ES` pill (`.lang-seg`, Base.astro) — `${switchTo} ${other}`,
     * same pattern as jmrp.io's `ui.switchLanguage` ("Switch to {lang}").
     * The visible text is just the two-letter code (`ES`), which is not
     * descriptive enough on its own for a screen reader.
     */
    switchTo: "Switch to",
    footerBy: "Servers and site by",
    footerUpdated: "Updated",
    /**
     * Footer link to `/policies/`. It lives in the shared chrome, not on the
     * home page, because every page should be able to reach it — the same
     * reasoning that put `security.txt` in this footer after it existed with
     * no link to it from anywhere.
     */
    footerPolicies: "Policies",
    // Header navigation: one label per PageId. Short on purpose — they sit
    // next to each other in a single row, unlike the page's own <h1>.
    navHome: "Home",
    navInspector: "Inspector",
    navInternals: "Internals",
    navPolicies: "Policies",
    navServers: "Servers",
    /** `aria-label` of the `<nav>` landmark that holds the four page links. */
    mainNavLabel: "Main navigation",
    /** `aria-label` of the language-switch `<nav>` group. */
    langSwitchLabel: "Switch language",
    /** sr-only label inside the burger control that opens the mobile drawer. */
    menuOpen: "Menu",
    /** sr-only label on both the scrim and the drawer's close control. */
    menuClose: "Close menu",
    /** `aria-label` of the drawer's `role="dialog"` container. */
    menuDialogLabel: "Navigation menu",
    /**
     * Fallback `aria-label` for the theme button, rendered before the inline
     * script resolves the real state. Overwritten immediately by
     * `themeToLight`/`themeToDark` once the current theme is known.
     */
    themeToggle: "Toggle theme",
    themeToLight: "Switch to light theme",
    themeToDark: "Switch to dark theme",
  },
  es: {
    title: "Servidores MCP",
    /** Ver `en.metaTitle`: título del documento, no el H1. */
    metaTitle:
      "Servidores MCP — Model Context Protocol de uso libre · jmrp.io",
    subtitle: "Servidores Model Context Protocol self-hosted, de uso libre.",
    lede: "Dos servidores Model Context Protocol, self-hosted y de uso libre. Apunta tu cliente MCP a un endpoint, o pruébalos en el navegador.",
    /** Ver `en.updatedIn`: lo lee el componente compartido de la fecha. */
    updatedIn: "Esta página se actualizó por última vez el",
    /** Ver `en.backToHome`: enlace de vuelta a la portada, en las tres. */
    backToHome: "Volver a los servidores",
    skip: "Saltar al contenido",
    source: "Código",
    other: "English",
    /** Ver `en.switchTo`. */
    switchTo: "Cambiar a",
    footerBy: "Servidores y sitio de",
    footerUpdated: "Actualizado",
    /** Ver `en.footerPolicies`: enlace del pie a `/policies/`. */
    footerPolicies: "Políticas",
    /** Ver `en.navHome`..`en.navPolicies`: etiquetas cortas de la navegación. */
    navHome: "Inicio",
    navInspector: "Inspector",
    navInternals: "Funcionamiento interno",
    navPolicies: "Políticas",
    navServers: "Servidores",
    /** Ver `en.mainNavLabel`. */
    mainNavLabel: "Navegación principal",
    /** Ver `en.langSwitchLabel`. */
    langSwitchLabel: "Cambiar idioma",
    /** Ver `en.menuOpen`. */
    menuOpen: "Menú",
    /** Ver `en.menuClose`. */
    menuClose: "Cerrar menú",
    /** Ver `en.menuDialogLabel`. */
    menuDialogLabel: "Menú de navegación",
    /** Ver `en.themeToggle`. */
    themeToggle: "Alternar tema",
    /** Ver `en.themeToLight`. */
    themeToLight: "Cambiar a tema claro",
    /** Ver `en.themeToDark`. */
    themeToDark: "Cambiar a tema oscuro",
  },
} as const;
