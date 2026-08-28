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
      "What these servers see and keep, what happens if the service goes down, where a request appears to come from, and the legal footing under all of it.",
    /** Link from `/policies/` back to the home page. */
    privacyEyebrow: "Privacy & data",
    privacyBody: [
      "This service is run by José Manuel Requena Plens (jmrp.io), who is also the author of both servers. The site sets no cookies and runs no analytics scripts: the Content-Security-Policy names exactly one third party — gitlab.com, and only so the inspector's sign-in flow can exchange an authorization code for a token, which is disabled right now — and the browser refuses every other destination.",
      "Credentials you send travel as headers to the server you chose, are used for that request and are not persisted.",
    ],
    /**
     * The sentence this replaces ended "Details, in the notice on each
     * server's card" and pointed nowhere: that notice lives on the home
     * page's server cards, not on `/servers/<id>/`, and "card" is a term of
     * art on this site (`serversPage.eyebrowServer` is literally "MCP server
     * card"), so a reader following the site's own vocabulary was sent to
     * the one page that does not render it. `/inspector/` already hit this
     * and already solved it by linking — see `inspector.noticePointer`;
     * solving the same sentence two different ways would be the
     * inconsistency, not the fix.
     *
     * Split across two keys because `privacyBody` is printed as plain text
     * (`{paragraph}`), so an `<a>` cannot live inside the string. The prose
     * says "on the home page" out loud so the sentence stays true for anyone
     * who never clicks — and it says "only gitlab asks for one" because the
     * old plural ("each server's card") implied libgen wanted a credential
     * too, which it does not.
     */
    credentialNotice:
      "Only gitlab asks for one. Where that value goes, what the browser itself prevents, and how to scope and revoke it are set out in full in its security notice on the home page:",
    /**
     * Verbatim the `<h4>` of the notice it lands on, so the link text names
     * the question the anchor answers rather than describing it.
     */
    credentialNoticeLink: "Where does your GitLab token go?",
    logsEyebrow: "Logs and retention",
    logsBody: [
      "The web server keeps standard access logs — IP address, user agent, request path, status code, referrer, and the country, city and network operator that IP resolves to — for abuse prevention and for the author's own traffic report, rotated out after at most a year.",
      "The body of a call is never logged: it carries the arguments, which is to say whatever you actually searched for or asked. Usage metrics record the JSON-RPC method, the tool name, the call's status and timing, and the caller's IP address — which is there so the author can tell their own test traffic from real use — but never the arguments, and never the response.",
    ],
    slaEyebrow: "No SLA",
    slaBody: [
      "This is a personal service, offered as-is with no service-level agreement: no uptime guarantee, no support channel, and no commitment that either endpoint stays online — or unchanged — from one day to the next. Do not build anything critical on top of it; both servers are open source, and running your own instance is one static binary away.",
    ],
    egressEyebrow: "Where a request appears to come from",
    egressBody: [
      "Calls the servers make outward — to the Library Genesis mirrors, the open-access providers, or gitlab.com — leave through egress proxies hosted on VPS machines in Spain and the United Kingdom, not from wherever you or this site happen to be. To that third party, the request's source is one of those VPS addresses: neither your own IP address nor your home network's ever reaches it.",
    ],
    legalEyebrow: "Legal position",
    /**
     * Three paragraphs — scope, mechanism, responsibility — where there used
     * to be one, and every source named where the old text said "public
     * indexes and shadow-library mirrors" in the abstract.
     *
     * Naming less surface than you actually touch is not the cautious
     * position, it is the weak one: libgen's own card already names Library
     * Genesis, Anna's Archive, Sci-Hub, SciDB and randombook.org by hand
     * (`src/data/servers.ts`, and the SEP-1649 card behind
     * `/servers/libgen/`), so a legal notice that declined to say them read
     * as a gap between the two pages rather than as restraint.
     *
     * The ORDER, on the other hand, belongs to the tool and not to the
     * server. This paragraph used to open by saying the service "queries the
     * open-access providers first", which lifted a sentence out of
     * `download`'s description and stretched it over everything. `search`
     * does the opposite, and `search` is the tool a session starts with: the
     * live server says "The primary catalog (Library Genesis) is queried
     * first", and its `extra_sources` default (`auto`) reaches the
     * open-access providers "only when the catalog finds nothing or fails".
     * Of every claim on this site, the one in the legal notice can least
     * afford to overstate in the direction that flatters — so the order is
     * stated per tool, and the exception inside `download` itself (a book
     * asked for by its catalogue hash goes straight to the mirrors that mint
     * those hashes) is named rather than smoothed over.
     *
     * The mechanism paragraph distinguishes `download` from `read` on
     * purpose. "Nothing is downloaded here" would be false — `read` does
     * fetch the file to extract a slice of text, and each instance keeps its
     * own cache (see `internals.instancesBody`). The defensible claim, and
     * the one that carries the legal weight, is that this host publishes no
     * catalogue and offers no file to anyone else.
     *
     * Split into three because each has to survive being extracted on its
     * own: a retriever that lifts only the middle paragraph should still
     * come away with the whole mechanism.
     */
    legalBody: [
      "libgen runs no catalogue and hosts nothing of its own: it is a client of indexes and libraries other people operate — open-access providers — arXiv, Crossref, OpenLibrary, Project Gutenberg, dblp, PubMed, ERIC, OpenAlex and bioRxiv — and the shadow-library sources: a Library Genesis mirror, randombook.org, Anna's Archive, Sci-Hub, and the SciDB article viewer Anna's Archive runs. Which of them a call reaches, and in what order, is a property of the tool you call rather than of the service as a whole: its search starts from the Library Genesis catalogue and widens to Anna's Archive and the open-access providers — arXiv, Crossref, OpenLibrary, Project Gutenberg, dblp, PubMed and ERIC — only when that catalogue comes up empty, or on every call if you ask for that with extra_sources=always, while its download draws on a different open-access set — OpenAlex, Crossref and bioRxiv — and reaches a shadow-library source only when none of those serves it — a book asked for by its catalogue hash, which is the shadow libraries' own identifier, is looked up there directly. Each tool states its own order in its description, on libgen's server card.",
      "Over HTTP — the only way this endpoint is reached — its download tool never delivers a file: it resolves the identifier you gave it and hands back a link to whichever source holds the item, for your own client to fetch. Its read tool does fetch the file, but only to return the slice of text you asked for. Either way mcp.jmrp.io publishes no catalogue and offers no file for anyone else to fetch: the transfer, if you make it, is between you and that third party.",
      "What you do with the links it returns is your responsibility, under whichever law applies to you. gitlab does nothing more than relay calls to gitlab.com with the credential you supply, and grants no right beyond what that instance already grants its own user.",
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
      "Qué datos ven y guardan estos servidores, qué pasa si el servicio se cae, de dónde parece venir una petición, y la postura legal de todo ello.",
    privacyEyebrow: "Privacidad y datos",
    privacyBody: [
      "Este servicio lo opera José Manuel Requena Plens (jmrp.io), autor también de los dos servidores. El sitio no usa cookies ni scripts de analítica: la Content-Security-Policy nombra exactamente un tercero —gitlab.com, y solo para que el flujo de acceso del inspector pueda canjear un código de autorización por un token, que ahora mismo está desactivado— y el navegador rechaza cualquier otro destino.",
      "Las credenciales que envías viajan como cabeceras al servidor que elijas, se usan para esa petición y no se persisten.",
    ],
    /**
     * Ver `en.credentialNotice`: el aviso vive en la portada, no en la ficha
     * del servidor, así que va enlazado — y en dos claves porque el párrafo
     * se pinta como texto plano.
     */
    credentialNotice:
      "Solo gitlab pide una. A dónde va ese valor, qué impide el propio navegador y cómo acotarlo y revocarlo se explican por extenso en su aviso de seguridad, en la portada:",
    /** Ver `en.credentialNoticeLink`: literal el `<h4>` del aviso destino. */
    credentialNoticeLink: "¿A dónde va tu token de GitLab?",
    logsEyebrow: "Logs y retención",
    logsBody: [
      "El servidor web guarda logs de acceso estándar — dirección IP, user agent, ruta, código de estado, referente, y el país, la ciudad y el operador de red a los que resuelve esa IP — para prevenir abusos y para el informe de tráfico del propio autor, rotados como mucho al año.",
      "El cuerpo de una llamada nunca se registra: lleva los argumentos, es decir, lo que de verdad buscas o preguntas. Las métricas de uso registran el método JSON-RPC, el nombre de la herramienta, el estado y los tiempos de la llamada, y la IP de quien llama —que está ahí para que el autor pueda separar su propio tráfico de pruebas del real—, pero nunca los argumentos ni la respuesta.",
    ],
    slaEyebrow: "Sin SLA",
    slaBody: [
      "Este es un servicio personal, ofrecido tal cual y sin acuerdo de nivel de servicio: sin garantía de disponibilidad, sin canal de soporte y sin compromiso de que ninguno de los dos endpoints siga en pie —o igual— de un día para otro. No montes nada crítico encima: los dos servidores son open source, y levantar tu propia instancia está a un único binario estático de distancia.",
    ],
    egressEyebrow: "De dónde parece venir una petición",
    egressBody: [
      "Las llamadas que los servidores hacen hacia fuera — a los mirrors de Library Genesis, a los proveedores de acceso abierto, o a gitlab.com — salen por proxies de salida alojados en VPS en España y Reino Unido, no desde donde estés tú ni desde donde esté este sitio. Para ese tercero, el origen de la petición es una de esas direcciones de VPS: ni tu propia IP ni la de tu red doméstica le llegan nunca.",
    ],
    legalEyebrow: "Postura legal",
    /**
     * Ver `en.legalBody`: alcance, mecanismo y responsabilidad, un párrafo
     * cada uno, con todas las fuentes nombradas y el orden atribuido a cada
     * tool — no al servidor entero.
     */
    legalBody: [
      "libgen no opera catálogo alguno ni aloja nada propio: es un cliente de índices y bibliotecas que gestionan otros — proveedores de acceso abierto —arXiv, Crossref, OpenLibrary, Project Gutenberg, dblp, PubMed, ERIC, OpenAlex y bioRxiv— y las fuentes de bibliotecas en la sombra: un mirror de Library Genesis, randombook.org, Anna's Archive, Sci-Hub y el visor de artículos SciDB de Anna's Archive. A cuáles llega una llamada, y en qué orden, lo decide la herramienta que llamas y no el servicio entero: su search parte del catálogo de Library Genesis y solo se abre a Anna's Archive y a los proveedores de acceso abierto —arXiv, Crossref, OpenLibrary, Project Gutenberg, dblp, PubMed y ERIC— cuando ese catálogo viene vacío, o en todas las llamadas si lo pides con extra_sources=always, mientras que su download recurre a un conjunto abierto distinto —OpenAlex, Crossref y bioRxiv— y solo llega a una fuente de biblioteca en la sombra cuando ninguno de esos sirve el ítem — un libro pedido por su hash de catálogo, que es el identificador propio de esas bibliotecas, se busca directamente allí. Cada herramienta declara su propio orden en su descripción, en la ficha de libgen.",
      "Por HTTP — la única forma de llegar a este endpoint — su herramienta download nunca entrega un fichero: resuelve el identificador que le des y devuelve un enlace a la fuente que tenga el ítem, para que lo descargue tu propio cliente. Su herramienta read sí lo descarga, pero solo para devolver el fragmento de texto que pediste. En ambos casos mcp.jmrp.io no publica catálogo alguno ni pone ningún fichero a disposición de nadie: la transferencia, si la haces, ocurre entre ese tercero y tú.",
      "Lo que hagas con los enlaces que devuelve es responsabilidad tuya, bajo la ley que te sea aplicable. gitlab no hace más que retransmitir llamadas a gitlab.com con la credencial que le des, y no concede ningún derecho más allá del que ya te concede esa instancia.",
    ],
  },
} as const;
