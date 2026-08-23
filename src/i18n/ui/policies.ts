/**
 * Policies page strings: privacy, logging, availability, egress and the
 * legal position — everything the home page used to fold into one "Privacy
 * & data" section, now split into the subsections a visitor actually asks
 * about, plus the visible freshness line that closes the page.
 */
export const policies = {
  en: {
    policiesMetaTitle: "Policies — privacy, logging and legal position · jmrp.io",
    /**
     * The page's `<h1>`. Prefixed like the rest of this module: these keys are
     * flattened into the shared `ui` object, where a bare `title` would
     * collide with the site identity one in `common.ts`.
     */
    policiesTitle: "Policies",
    /**
     * Kicker above the h1 (`.section-title`, "// POLICIES"), like jmrp.io's
     * PrivacyPage.astro/AboutPage.astro put one above every content page's
     * h1. Inspector already had `inspectorEyebrow` for the same slot; this
     * page had none, so its h1 sat with nothing above it.
     */
    policiesEyebrow: "Policies",
    /**
     * Meta description AND the page's opening paragraph — same reasoning as
     * `inspector.inspectorIntro`: one string serving both roles can't drift
     * out of sync with itself.
     */
    policiesIntro:
      "What this page covers: what data these servers see and keep, what happens if the service goes down, where a request looks like it comes from, and the legal footing under all of it.",
    /** Link from `/policies/` back to the home page. */
    privacyEyebrow: "Privacy & data",
    privacyBody: [
      "This service is run by José Manuel Requena Plens (jmrp.io), who is also the author of both servers. The site sets no cookies and runs no analytics scripts: the Content-Security-Policy forbids talking to any third party, and the browser enforces it.",
      "Credentials you send travel as headers to the server you chose, are used for that request and are not persisted. Details, in the notice on each server's card.",
    ],
    logsEyebrow: "Logs and retention",
    logsBody: [
      "The web server keeps standard access logs — IP address, user agent, request path and status code — for abuse prevention, rotated out after at most a year.",
      "The body of a call is never logged: it carries the arguments, which is to say whatever you actually searched for or asked. Usage metrics record only the JSON-RPC method and the tool name — never the arguments, and never the response.",
    ],
    slaEyebrow: "No SLA",
    slaBody: [
      "This is a personal service, offered as-is with no service-level agreement: no uptime guarantee, no support channel, and no commitment that either endpoint stays online — or unchanged — from one day to the next. Do not build anything critical on top of it; both servers are open source, and running your own instance is one static binary away.",
    ],
    egressEyebrow: "Where a request appears to come from",
    egressBody: [
      "Calls the servers make outward — to the Library Genesis mirrors, the open-access providers, or the GitLab instance you point gitlab at — leave through egress proxies hosted on VPS machines in Spain and the United Kingdom, not from wherever you or this site happen to be. To that third party, the request's source is one of those VPS addresses: neither your own IP address nor your home network's ever reaches it.",
    ],
    legalEyebrow: "Legal position",
    legalBody: [
      "libgen is a client of public indexes and shadow-library mirrors it neither operates nor controls, and it hosts nothing of its own. What you do with the links it returns is your responsibility, under whichever law applies to you. gitlab does nothing more than relay calls to the GitLab instance and token you supply, and grants no right beyond what that instance already grants its own user.",
    ],
    // Visible freshness inside <main>: the footer carries the same date, but
    // readability prunes it and extractors saw the page as undated.
  },
  es: {
    policiesMetaTitle: "Políticas — privacidad, logs y postura legal · jmrp.io",
    /** Ver `en.policiesTitle`: el `<h1>` de la página. */
    policiesTitle: "Políticas",
    /** Ver `en.policiesEyebrow`: kicker encima del h1. */
    policiesEyebrow: "Políticas",
    /** Ver `en.policiesIntro`: sirve de meta description y de párrafo inicial. */
    policiesIntro:
      "Qué cubre esta página: qué datos ven y guardan estos servidores, qué pasa si el servicio se cae, de dónde parece venir una petición, y la base legal de todo ello.",
    privacyEyebrow: "Privacidad y datos",
    privacyBody: [
      "Este servicio lo opera José Manuel Requena Plens (jmrp.io), autor también de los dos servidores. El sitio no usa cookies ni scripts de analítica: la Content-Security-Policy prohíbe hablar con terceros, y la aplica el navegador.",
      "Las credenciales que envías viajan como cabeceras al servidor que elijas, se usan para esa petición y no se persisten. El detalle, en el aviso de la ficha de cada servidor.",
    ],
    logsEyebrow: "Logs y retención",
    logsBody: [
      "El servidor web guarda logs de acceso estándar — dirección IP, user agent, ruta y código de estado — para prevenir abusos, rotados como mucho al año.",
      "El cuerpo de una llamada nunca se registra: lleva los argumentos, es decir, lo que de verdad buscas o preguntas. Las métricas de uso registran solo el método JSON-RPC y el nombre de la herramienta — nunca los argumentos, ni la respuesta.",
    ],
    slaEyebrow: "Sin SLA",
    slaBody: [
      "Este es un servicio personal, ofrecido tal cual y sin acuerdo de nivel de servicio: sin garantía de disponibilidad, sin canal de soporte y sin compromiso de que ninguno de los dos endpoints siga en pie —o igual— de un día para otro. No montes nada crítico encima: los dos servidores son open source, y levantar tu propia instancia es un único binario estático.",
    ],
    egressEyebrow: "De dónde parece venir una petición",
    egressBody: [
      "Las llamadas que los servidores hacen hacia fuera — a los mirrors de Library Genesis, a los proveedores de acceso abierto, o a la instancia de GitLab a la que apuntes gitlab — salen por proxies de salida alojados en VPS en España y Reino Unido, no desde donde estés tú ni desde donde esté este sitio. Para ese tercero, el origen de la petición es una de esas direcciones de VPS: ni tu propia IP ni la de tu red doméstica le llegan nunca.",
    ],
    legalEyebrow: "Postura legal",
    legalBody: [
      "libgen es un cliente de índices públicos y mirrors de bibliotecas en la sombra que no opera ni controla, y no aloja nada propio. Lo que hagas con los enlaces que devuelve es responsabilidad tuya, bajo la ley que te sea aplicable. gitlab no hace más que retransmitir llamadas a la instancia de GitLab y el token que le des, y no concede ningún derecho más allá del que ya te concede esa instancia.",
    ],
  },
} as const;
