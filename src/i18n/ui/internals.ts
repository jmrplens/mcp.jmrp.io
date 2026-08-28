/**
 * Internals page strings: how a request is actually routed, section by
 * section — the path, the three instances behind each server, the affinity
 * that pins a client to one of them, the egress country that follows from
 * it, and the personal-service framing that closes the page.
 *
 * `metaTitle`/`title`/`lede` predate this file's Task 7 content (see the
 * header comment on `src/i18n/ui.ts` for why this module is imported
 * directly and never spread into the merged `ui` object).
 *
 * The nginx directive quoted in `affinityCodeIntro` is real and runs in
 * production; `affinityCodeComment` is the only translated piece of it. The
 * salt itself is never in this file, nor anywhere else in the repo — see the
 * placeholder in `InternalsPage.astro`.
 */
export const internals = {
  en: {
    title: "Internals",
    metaTitle: "Internals — how a request reaches mcp.jmrp.io · jmrp.io",
    /**
     * Doubles as this page's meta description (`src/pages/internals.astro`
     * passes it straight to `Base`), so it is written to the snippet ceiling
     * rather than to taste: over ~155 characters a search engine cuts it and
     * the last hop — the one that names what the request is actually for —
     * is the half that disappears. Every hop of the six-step path survives
     * the trim; only the connective tissue ("from", "through", "to") and
     * "running" were dropped, the latter because `instancesEyebrow` below
     * already establishes that the three instances are up.
     */
    lede: "How a request actually reaches these servers: your browser, Cloudflare, nginx, one of three instances, an egress proxy, and the destination it asked for.",
    /** Link from `/internals/` back to the home page. */

    pathEyebrow: "The path of a request",
    pathBody: [
      "A call to either server crosses the same six steps before it comes back: your client to Cloudflare, Cloudflare to nginx on the home server that fronts both MCPs, nginx to one of three running instances of the server you called, that instance out through an egress proxy, and the egress proxy to the actual destination — a Library Genesis mirror for libgen, or gitlab.com for gitlab — a destination fixed by the deployment, not chosen by the caller.",
    ],

    instancesEyebrow: "Three instances, one nginx",
    instancesBody: [
      "Behind that nginx sit three instances of each server, load-balanced rather than run as a single process.",
      "Each instance keeps its own cache, so a hit on one is not a hit on the others: the three-way split is the price of being able to spread load across them at all.",
    ],

    affinityEyebrow: "Affinity: why the second request lands on the same node",
    affinityIntro:
      "Since 2026-08-22 nginx no longer rotates round-robin across those three instances: it picks one with a consistent hash, so the same client keeps landing on the same node instead of a different one each time.",
    affinityLibgen:
      "libgen hashes on the client's IP address (`hash $binary_remote_addr consistent`) — there is no token to key on, and the payoff is the read cache: repeat calls from the same visitor keep hitting the instance that already has them warm.",
    affinityGitlab:
      "gitlab hashes on the client's `Authorization: Bearer` credential instead, falling back to the IP address when a request carries none. The reason is structural, not a cache: gitlab spins up an isolated server per client, and its connection pool is indexed by `(token, URL)` — each entry checks scopes and edition against GitLab the first time it is used. Since this endpoint moved to OAuth it matters more, not less: an instance also caches the identity of a verified token for fifteen minutes, so bouncing between nodes would force that token to be re-verified against gitlab.com — a network call to a third party — on every hop. An OAuth access token hashes exactly like a PAT, since it arrives in the same header, with one wrinkle: gitlab.com expires access tokens after two hours, and a refreshed token is a different string. So affinity holds for the life of a token rather than forever, and moving costs one verification.",
    affinityCodeIntro: [
      "The directive that turns a credential into a routing decision looks like this. It reads the `Authorization` header, and two things happen to the token inside it: nginx hashes it together with a secret salt into `$mcp_affinity`, which is the value the consistent-hash balancer actually keys on.",
      "That hash is necessary, not decorative — it is the only way nginx can send a client back to the instance that already holds its pool, without ever comparing tokens to each other directly.",
      "What does not happen: the token itself is never written anywhere, and neither is the hash. `$mcp_affinity_salt` and `$mcp_affinity` are ordinary nginx variables, scoped to the single request that computed them — nothing here reaches a log line, and nothing outlives the request.",
      "Even so: default to distrusting any remote server you hand a token to — this one included. That is exactly why the directive is shown in full instead of just asserted.",
    ],
    /** The one translated line inside the otherwise-untranslated snippet. */
    affinityCodeComment: "# the real value is never published",
    affinityConsequence:
      "The practical effect: because egress is also fixed per instance (next section), landing on the same node means your calls keep appearing to come from the same country — stable, not alternating request to request.",
    /** Caption for the request-path figure. The diagram itself is decorative
     * (its shapes carry no text of their own); the strip's stage names and
     * the node numbers/countries are real HTML, and the numbered timeline
     * right below the figure carries the full detail — this caption is just
     * a one-line frame for the figure, not the accessible equivalent on its
     * own. Deliberately no branch by server here — see
     * `InternalsPage.astro`'s header comment for why an earlier version of
     * this diagram drew one and got rejected. One client, one nginx, one
     * pool of nodes: libgen and gitlab differ only in which key nginx
     * computes, never in the shape of the pipeline. */
    diagramCaption: "The same six steps every request crosses, and why the same client always lands on the same node.",
    /** Stage labels along the strip. `Cloudflare`/`nginx` are proper
     * nouns/product names, identical in both languages — see how the rest
     * of this file already treats them (e.g. `affinityIntro`). */
    diagramStageClient: "you",
    diagramStageNodes: "nodes",
    diagramStageEgress: "egress",
    diagramStageDestination: "destination",
    /** The six annotation bubbles, cycled one at a time beside the strip —
     * short by design, the full detail lives in `diagramTimelineStep1..6`
     * below. Order and substance match the approved spec's bubble table
     * exactly (`.superpowers/sdd/internals-diagram-spec.md`), plus bubble 6
     * (the request leaving for its destination), added so the traveling
     * highlight box has somewhere to go after "egress" instead of jumping
     * straight back to "you" — see `InternalsPage.astro`'s header comment,
     * "UPDATE 2026-08-23 (destination hop)". */
    diagramBubble1: "Your client opens the request, with a Bearer token or without one",
    diagramBubble2: "Cloudflare passes it through to the origin",
    diagramBubble3: "Here the key gets computed: your IP, or the token's hash",
    diagramBubble4: "The same key always picks the same node",
    diagramBubble5: "That node exits through its fixed country",
    diagramBubble6: "The request goes out to the server that answers it",
    /** Lead-in line for the prose timeline right below the figure — not a
     * heading (this page's heading levels are already accounted for), just
     * enough of a sentence for the numbered list to read naturally on its
     * own, including for anyone who never saw the figure above it. */
    /** Legend for the connector line, which is painted in one colour per
     * transport: the strip drew five hops and said nothing about how any of
     * them travels — the one thing a visitor asking "can anyone read my
     * token?" needs from a picture of the path. A legend, not a label per
     * joint: five labels riding on the wire were tried first and collided
     * with an icon at every hop below 481px (the gap between two adjacent
     * stage icons is ~30px there, a legible label ~27px), so the author
     * asked for colour plus one horizontal legend instead. Colour is never
     * the only carrier — these three words are real text, and the `wire*`
     * section below states it all in prose. `https`/`SSH` are protocol
     * names, identical in both languages. */
    diagramLegendTls: "https",
    diagramLegendLocal: "local",
    diagramLegendSsh: "SSH tunnel",
    /** One line under the strip: what those three colours amount to. */
    diagramLegendNote:
      "Every hop that crosses a network is encrypted; local is the one that never leaves the machine.",
    diagramTimelineIntro: "The same six steps, in full:",
    diagramTimelineStep1:
      "It starts on your machine: your MCP client sends the request to whichever endpoint you pointed it at, /libgen or /gitlab, carrying an `Authorization: Bearer` header if that server needs one — gitlab does, libgen does not.",
    diagramTimelineStep2:
      "Cloudflare receives it at the edge and forwards it, unchanged, to the home server that fronts both MCPs.",
    diagramTimelineStep3:
      "nginx turns the request into a routing key: your IP address if there is no credential, or an MD5 of a secret salt plus the token out of your `Authorization: Bearer` header if there is — the directive that does it is quoted in full under “Affinity” below.",
    diagramTimelineStep4:
      "That key feeds a consistent-hash balancer, which is why it keeps choosing the same one of the three running instances for you — never a different one from one call to the next.",
    diagramTimelineStep5:
      "That instance always leaves through the same country — Spain or the United Kingdom, fixed per instance — so your calls keep appearing to come from the same place instead of alternating.",
    diagramTimelineStep6:
      "That connection reaches the actual destination: a Library Genesis mirror if you called libgen, or gitlab.com if you called gitlab — fixed for this deployment since it moved to OAuth, not a host the caller picks.",

    /** The transport section. It exists because the diagram above now labels
     * each hop (`diagramLink*`) and a label like `https` is a claim: this is
     * where that claim is stated in full, INCLUDING the two points where TLS
     * terminates by design. Saying "encrypted end to end" and stopping there
     * would be the comfortable version and also the false one — a CDN and a
     * reverse proxy both decrypt by definition, and this page's whole job is
     * to say what actually happens. Every sentence here was checked against
     * the running config, not assumed: the loopback upstreams and the
     * http→https redirect in the vhost, TLSv1.3 on every origin hit in the
     * access log, `HTTPS_PROXY` on the instances, and the absence of
     * `$http_authorization` (and of the affinity hash) from every
     * `log_format` on the box. */
    /**
     * The inspector's storage, and how to check it rather than believe it.
     *
     * It lives on this page and not beside the button because a claim about
     * what a site does NOT keep is worth only as much as the way to verify it,
     * and that takes more room than a form allows.
     */
    storageEyebrow: "What the inspector keeps, and how to check",
    mdDirectiveNote:
      "The nginx directive itself is quoted in full on the page: {url}",
    storageBody: [
      "Nothing. The token you paste — or, when the sign-in button is enabled, the one it obtains — lives in the memory of the page's component and nowhere else: no localStorage, no sessionStorage, no cookies, no query string, no logs. Reloading drops it, navigating anywhere drops it — this site has no client-side router, so every link is a fresh document — and closing the tab drops it.",
      "That is a claim about an absence, which is exactly the kind you should never take on trust. Here is how to see it for yourself, with the browser you already have open.",
      "In Chrome or Edge, press F12 and go to Application → Storage. Paste a token in the inspector, call something, and look again: Local Storage, Session Storage and Cookies for this site stay empty. In Firefox that panel is called Storage; in Safari it is Develop → Show Web Inspector → Storage.",
      "Then look at where it goes. In the Network tab, run a call and open the request to /gitlab: the Authorization header is on that request and on no other. The only other place the token could appear is the sign-in exchange with gitlab.com, and only if you used that button, which is disabled at the moment — so today there is exactly one destination. The browser itself enforces the boundary, because this page's Content-Security-Policy names those two destinations and no others. Everything in this paragraph is visible in that panel, without taking anyone's word for it.",
    ],
    wireEyebrow: "On the wire: what is encrypted, and where it is not",
    wireBody: [
      "Every hop that crosses a network is encrypted. Your client reaches Cloudflare over HTTPS; Cloudflare reaches this server over HTTPS too — plain HTTP gets a redirect and the domain is on the HSTS preload list; and the call that finally leaves for its destination is HTTPS as well, negotiated by the instance itself and only forwarded, still sealed, through the SSH tunnel that gives it its exit country. Between nginx and the instances nothing leaves this machine, though it is worth being exact about what that means: nginx dials 127.0.0.1 and Docker's proxy hands the connection to a container on a private bridge. That segment is not loopback, so the honest claim is not that there is no network but that nobody is on it — the eight containers sharing the bridge are the six MCP instances and the two egress tunnels, every one of them running with all Linux capabilities dropped, so none can open the raw socket that reading it would take.",
      "So nobody sitting between the hops can read your token. Two points do see it, and by design: Cloudflare's edge, which decrypts and re-encrypts everything it proxies, as any CDN does; and this server, where nginx needs the token to compute the affinity hash and the instance needs it to make the call you asked for. Neither one writes it down — no access log on this machine records the `Authorization` header, and the hash derived from it is not logged either: it lives just long enough to pick an instance.",
      "The last hop used to be the one this server could not promise: gitlab went wherever your `GITLAB-URL` header pointed, so aiming it at an instance of your own on plain `http://` made that final hop exactly as encrypted as the address you gave. That header is gone — OAuth needs one named authorization server, so the instance is fixed to gitlab.com and the last hop is HTTPS to a host this deployment declares rather than one a caller supplies.",
    ],

    egressEyebrow: "Egress: which country a request leaves from",
    egressBody: [
      "Every outbound call, from any instance, leaves through an SSH tunnel to a VPS run by IONOS in Spain or the United Kingdom — never through the home network's own address.",
      "The assignment is fixed per instance, and mirrored between the two servers: libgen sends two of its three instances out through Spain and one through the United Kingdom; gitlab is the reverse, two through the United Kingdom and one through Spain. Whichever it is, what the destination sees is one of those VPS addresses, never the home network's.",
    ],

    personalEyebrow: "A personal service",
    personalBody: [
      "None of this changes what these servers are: a personal project, run by one person, with no SLA and no guarantee that either endpoint stays online — or unchanged — from one day to the next.",
    ],
    /** Link from `/internals/` to `/policies/`, for the full statements this page deliberately does not repeat. */
    policiesLink: "Full policies: privacy, logging and legal position",
  },
  es: {
    title: "Funcionamiento interno",
    metaTitle: "Funcionamiento interno — cómo enruta mcp.jmrp.io · jmrp.io",
    /** Ver `en.lede`: es también la meta description, de ahí la brevedad. */
    lede: "Cómo llega de verdad una petición a estos servidores: tu navegador, Cloudflare, nginx, una de las tres instancias, un proxy de salida y el destino pedido.",

    pathEyebrow: "El camino de una petición",
    pathBody: [
      "Una llamada a cualquiera de los dos servidores cruza los mismos seis pasos antes de volver: tu cliente hasta Cloudflare, Cloudflare hasta el nginx del servidor de casa que da la cara por los dos MCP, nginx hasta una de las tres instancias en marcha del servidor que llamaste, esa instancia hacia fuera por un proxy de salida, y el proxy de salida hasta el destino real — un mirror de Library Genesis para libgen, o gitlab.com para gitlab — un destino que fija el despliegue, no quien llama.",
    ],

    instancesEyebrow: "Tres instancias, un solo nginx",
    instancesBody: [
      "Detrás de ese nginx hay tres instancias de cada servidor, balanceadas en vez de correr como un único proceso.",
      "Cada instancia tiene su propia caché, así que un acierto en una no lo es en las otras: el reparto entre tres es el precio de poder repartir carga entre ellas.",
    ],

    affinityEyebrow: "Afinidad: por qué la segunda petición cae en el mismo nodo",
    affinityIntro:
      "Desde el 2026-08-22 nginx ya no rota en round-robin entre esas tres instancias: elige una por hash consistente, así que el mismo cliente sigue cayendo en el mismo nodo en vez de en uno distinto cada vez.",
    affinityLibgen:
      "libgen hace el hash sobre la IP del cliente (`hash $binary_remote_addr consistent`) — no hay token en el que apoyarse, y la ganancia es la caché de lectura: las llamadas repetidas del mismo visitante siguen cayendo en la instancia que ya las tiene calientes.",
    affinityGitlab:
      "gitlab hace el hash sobre la credencial `Authorization: Bearer` del cliente, con la IP como respaldo cuando una petición no lleva ninguna. El motivo es estructural, no de caché: gitlab levanta un servidor aislado por cliente, y su pool de conexiones se indexa por `(token, URL)` — cada entrada comprueba scopes y edición contra GitLab la primera vez que se usa. Desde que este endpoint pasó a OAuth pesa más, no menos: cada instancia cachea además la identidad de un token ya verificado durante quince minutos, así que rebotar entre nodos obligaría a re-verificar ese token contra gitlab.com —una llamada de red a un tercero— en cada salto. Un token de acceso OAuth se hashea igual que un PAT, porque llega en la misma cabecera, con un matiz: gitlab.com caduca los tokens de acceso a las dos horas, y un token renovado es una cadena distinta. Así que la afinidad aguanta lo que dure un token, no para siempre, y mudarse cuesta una verificación.",
    affinityCodeIntro: [
      "La directiva que convierte una credencial en una decisión de enrutado es esta. Lee la cabecera `Authorization`, y al token que va dentro le pasan dos cosas: nginx lo combina con una sal secreta y lo hashea en `$mcp_affinity`, que es el valor sobre el que de verdad decide el balanceo por hash consistente.",
      "Ese hash es necesario, no decorativo — es la única forma que tiene nginx de devolver a un cliente a la instancia que ya tiene su pool, sin comparar tokens entre sí directamente.",
      "Lo que NO pasa: el token en sí no se escribe en ningún sitio, y el hash tampoco. `$mcp_affinity_salt` y `$mcp_affinity` son variables de nginx corrientes, con el ámbito de la petición que las calculó — nada de esto llega a una línea de log, y nada sobrevive a la petición.",
      "Aun así: desconfía por defecto de cualquier servidor remoto al que le entregues un token — este incluido. Precisamente por eso se enseña la directiva entera en vez de solo afirmarlo.",
    ],
    /** Ver `en.affinityCodeComment`: la única línea traducida del snippet. */
    affinityCodeComment: "# el valor real no se publica",
    affinityConsequence:
      "El efecto práctico: como la salida también es fija por instancia (siguiente sección), caer en el mismo nodo significa que tus llamadas siguen pareciendo venir del mismo país — estable, no alternando de una petición a la siguiente.",
    /** Ver `en.diagramCaption`: leyenda breve de la figura del camino de la petición. */
    diagramCaption:
      "Los mismos seis pasos que cruza toda petición, y por qué el mismo cliente cae siempre en el mismo nodo.",
    /** Ver `en.diagramStageClient` etc.: etiquetas de la tira. */
    diagramStageClient: "tú",
    diagramStageNodes: "nodos",
    diagramStageEgress: "salida",
    diagramStageDestination: "destino",
    /** Ver `en.diagramBubble1..6`: los seis globos, texto literal de la
     * especificación aprobada (`.superpowers/sdd/internals-diagram-spec.md`),
     * más el globo 6 (la petición saliendo hacia su destino). */
    diagramBubble1: "Tu cliente abre la petición, con un token Bearer o sin él",
    diagramBubble2: "Cloudflare la pasa al origen",
    diagramBubble3: "Aquí se calcula la clave: tu IP, o el hash del token",
    diagramBubble4: "La misma clave elige siempre el mismo nodo",
    diagramBubble5: "Ese nodo sale por su país fijo",
    diagramBubble6: "Esa petición sale hacia el servidor que la responde",
    /** Ver `en.diagramTimelineIntro`. */
    /** Ver `en.diagramLegendTls`. */
    diagramLegendTls: "https",
    diagramLegendLocal: "local",
    diagramLegendSsh: "túnel SSH",
    /** Ver `en.diagramLegendNote`. */
    diagramLegendNote:
      "Todo salto que cruza una red va cifrado; local es el que no sale de la máquina.",
    diagramTimelineIntro: "Los mismos seis pasos, completos:",
    diagramTimelineStep1:
      "Empieza en tu máquina: tu cliente MCP envía la petición al endpoint al que lo apuntaste, /libgen o /gitlab, con una cabecera `Authorization: Bearer` si ese servidor la necesita — gitlab sí, libgen no.",
    diagramTimelineStep2:
      "Cloudflare la recibe en el borde y la reenvía, sin tocarla, al servidor de casa que da la cara por los dos MCP.",
    diagramTimelineStep3:
      "nginx convierte la petición en una clave de enrutado: tu dirección IP si no hay credencial, o un MD5 de una sal secreta más el token que va en tu cabecera `Authorization: Bearer` si lo hay — la directiva que lo hace está citada entera más abajo, en «Afinidad».",
    diagramTimelineStep4:
      "Esa clave alimenta un balanceador por hash consistente, por eso elige siempre la misma de las tres instancias en marcha para ti — nunca una distinta de una llamada a la siguiente.",
    diagramTimelineStep5:
      "Esa instancia sale siempre por el mismo país — España o Reino Unido, fijo por instancia — así que tus llamadas siguen pareciendo venir del mismo sitio en vez de alternar.",
    diagramTimelineStep6:
      "Esa conexión llega al destino real: un mirror de Library Genesis si llamaste a libgen, o gitlab.com si llamaste a gitlab — fijo en este despliegue desde que pasó a OAuth, no un host que elija quien llama.",

    /** Ver `en.storageEyebrow`. */
    storageEyebrow: "Qué guarda el inspector, y cómo comprobarlo",
    /** Ver `en.mdDirectiveNote`. */
    mdDirectiveNote:
      "La propia directiva de nginx está citada entera en la página: {url}",
    storageBody: [
      "Nada. El token que pegas —o, cuando el botón de acceso esté activo, el que consigue él— vive en la memoria del componente de la página y en ningún sitio más: sin localStorage, sin sessionStorage, sin cookies, sin barra de direcciones y sin logs. Al recargar desaparece, al navegar a cualquier sitio desaparece —este sitio no lleva enrutador de cliente, así que cada enlace es un documento nuevo— y al cerrar la pestaña desaparece.",
      "Eso es una afirmación sobre una ausencia, que es justo la clase que nunca deberías creerte por las buenas. Así puedes verlo tú mismo, con el navegador que ya tienes abierto.",
      "En Chrome o Edge, pulsa F12 y ve a Aplicación → Almacenamiento. Pega un token en el inspector, llama a algo y vuelve a mirar: Local Storage, Session Storage y Cookies de este sitio siguen vacíos. En Firefox ese panel se llama Almacenamiento; en Safari es Desarrollo → Mostrar inspector web → Almacenamiento.",
      "Después mira a dónde va. En la pestaña Red, lanza una llamada y abre la petición a /gitlab: la cabecera Authorization está en esa petición y en ninguna otra. El único otro sitio donde podría aparecer el token es el intercambio de acceso con gitlab.com, y solo si usaste ese botón, que ahora mismo está desactivado — así que hoy hay exactamente un destino. La frontera la impone el propio navegador, porque la Content-Security-Policy de esta página nombra esos dos destinos y ningún otro. Todo lo de este párrafo se ve en ese panel, sin fiarte de nadie.",
    ],
    /** Ver `en.wireEyebrow`. */
    wireEyebrow: "Por el cable: qué va cifrado y dónde deja de estarlo",
    wireBody: [
      "Todo salto que cruza una red va cifrado. Tu cliente llega a Cloudflare por HTTPS; Cloudflare llega a este servidor también por HTTPS —el HTTP a secas se responde con una redirección y el dominio está en la lista de precarga de HSTS—, y la llamada que sale por fin hacia su destino es HTTPS igualmente, negociada por la propia instancia y solo reenviada, aún sellada, por el túnel SSH que le da su país de salida. Entre nginx y las instancias no sale nada de esta máquina, aunque conviene ser exacto con qué significa eso: nginx marca 127.0.0.1 y el proxy de Docker entrega la conexión a un contenedor en un bridge privado. Ese tramo no es loopback, así que lo honesto no es decir que no hay red, sino que no hay nadie en ella — los ocho contenedores que comparten el bridge son las seis instancias MCP y los dos túneles de salida, todos corriendo con todas las capacidades de Linux retiradas, así que ninguno puede abrir el socket en crudo que haría falta para leerlo.",
      "Así que nadie que esté entre medias puede leer tu token. Sí lo ven dos puntos, y a propósito: el borde de Cloudflare, que descifra y vuelve a cifrar todo lo que proxya, como cualquier CDN; y este servidor, donde nginx necesita el token para calcular el hash de afinidad y la instancia lo necesita para hacer la llamada que le has pedido. Ninguno de los dos lo apunta: ningún log de acceso de esta máquina registra la cabecera `Authorization`, y el hash que sale de ella tampoco se registra — vive lo justo para elegir instancia.",
      "El último salto era el que este servidor no podía prometer: gitlab iba a donde apuntara tu cabecera `GITLAB-URL`, así que dirigirlo a una instancia tuya que escuchara en `http://` a secas dejaba ese tramo final tan cifrado como la dirección que le dieras. Esa cabecera ya no existe — OAuth necesita un único servidor de autorización con nombre, así que la instancia está fijada a gitlab.com y el último salto es HTTPS contra un host que declara este despliegue, no uno que aporte quien llama.",
    ],

    egressEyebrow: "Salida: de qué país sale una petición",
    egressBody: [
      "Toda llamada saliente, desde cualquier instancia, sale por un túnel SSH a un VPS de IONOS en España o en Reino Unido — nunca por la dirección propia de la red de casa.",
      "La asignación es fija por instancia, y cruzada entre los dos servidores: libgen saca dos de sus tres instancias por España y una por Reino Unido; gitlab es al revés, dos por Reino Unido y una por España. Sea cual sea, lo que ve el destino es una de esas direcciones de VPS, nunca la de la red de casa.",
    ],

    personalEyebrow: "Un servicio personal",
    personalBody: [
      "Nada de esto cambia lo que son estos servidores: un proyecto personal, mantenido por una persona, sin SLA y sin garantía de que ninguno de los dos endpoints siga en pie — o igual — de un día para otro.",
    ],
    /** Ver `en.policiesLink`: enlace a `/policies/` con las declaraciones completas. */
    policiesLink: "Políticas completas: privacidad, logs y postura legal",
  },
} as const;
