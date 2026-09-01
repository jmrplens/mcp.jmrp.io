/**
 * Internals page strings: how a request is actually routed, section by
 * section — the path, what the inspector keeps, what is encrypted where, the
 * three instances behind each server, the affinity that pins a client to
 * one of them, the exit that follows from it, what happens when any of that
 * fails, and the personal-service framing that closes the page.
 *
 * `metaTitle`/`title`/`lede` predate this file's Task 7 content (see the
 * header comment on `src/i18n/ui.ts` for why this module is imported
 * directly and never spread into the merged `ui` object).
 *
 * The nginx directive quoted in `affinityCodeIntro` is real and runs in
 * production; `affinityCodeComment` is the only translated piece of it. The
 * salt itself is never in this file, nor anywhere else in the repo — see the
 * placeholder in `InternalsPage.astro`.
 *
 * Every number in here — three instances, three exit nodes, the minutes in
 * "When something fails" — was checked against the running configuration
 * and the scripts in ops/ on 2026-09-01, not assumed. The figure's node and
 * exit counts come from `src/data/topology.json`, which the deploy path
 * regenerates from the census; the prose states the same numbers and must be
 * updated in the same commit if they ever change.
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
     * the trim. "Your client", not "your browser": step 1 of the timeline
     * says an MCP client sends the request, and the lede must not contradict
     * its own timeline.
     */
    lede: "How a request actually reaches these servers: your client, Cloudflare, nginx, one of three instances, its WireGuard exit, and the destination it asked for.",

    pathEyebrow: "The path of a request",
    /**
     * Two sentences, no hop list. The six hops are told by the figure's
     * bubbles and, in full, by the numbered timeline right under it; a third
     * telling in an 85-word sentence added nothing and was the one place that
     * kept calling the exit a "proxy" after it stopped being one.
     */
    pathBody: [
      "A call to either server crosses the same six steps before it comes back — the figure draws them, and the numbered list under it walks through each one. The one thing the caller chooses is which server: pointing a client at /libgen or /gitlab happens before the request exists on the wire, and everything after that is the same pipeline.",
    ],

    instancesEyebrow: "Three instances, one nginx",
    instancesBody: [
      "Behind that nginx sit three instances of each server, load-balanced rather than run as a single process.",
      "Each instance keeps its own cache, so a hit on one is not a hit on the others: the three-way split is the price of being able to spread load across them at all.",
    ],

    affinityEyebrow: "Affinity: why the second request lands on the same node",
    affinityIntro:
      "nginx does not rotate round-robin across those three instances: it picks one with a consistent hash, so the same client keeps landing on the same node instead of a different one each time.",
    affinityLibgen:
      "libgen hashes on the client's IP address (`hash $binary_remote_addr consistent`) — there is no token to key on, and the payoff is the read cache: repeat calls from the same visitor keep hitting the instance that already has them warm.",
    affinityGitlab:
      "gitlab hashes on the client's `Authorization: Bearer` credential instead, falling back to the IP address when a request carries none. The reason is structural, not a cache: gitlab spins up an isolated server per client, and its connection pool is indexed by `(token, URL)` — each entry checks scopes and edition against GitLab the first time it is used. With OAuth it matters even more: an instance also caches the identity of a verified token for fifteen minutes, so bouncing between nodes would force that token to be re-verified against gitlab.com — a network call to a third party — on every hop. An OAuth access token hashes exactly like a PAT, since it arrives in the same header, with one wrinkle: gitlab.com expires access tokens after two hours, and a refreshed token is a different string. So affinity holds for the life of a token rather than forever, and moving costs one verification.",
    affinityCodeIntro: [
      "The directive that turns a credential into a routing decision looks like this. It reads the `Authorization` header, and two things happen to the token inside it: nginx hashes it together with a secret salt into `$mcp_affinity`, which is the value the consistent-hash balancer actually keys on.",
      "That hash is necessary, not decorative — it is the only way nginx can send a client back to the instance that already holds its pool, without ever comparing tokens to each other directly.",
      "What does not happen: the token itself is never written anywhere, and neither is the hash. `$mcp_affinity_salt` and `$mcp_affinity` are ordinary nginx variables, scoped to the single request that computed them — nothing here reaches a log line, and nothing outlives the request.",
      "Even so: default to distrusting any remote server you hand a token to — this one included. That is exactly why the directive is shown in full instead of just asserted.",
    ],
    /** The one translated line inside the otherwise-untranslated snippet. */
    affinityCodeComment: "# the real value is never published",
    /**
     * "Same address", not "same country": two of the three exit nodes are in
     * Spain, so the country alone no longer identifies the exit. What is
     * stable per instance is the node, hence the address a destination sees.
     */
    affinityConsequence:
      "The practical effect: because each instance also has a fixed exit node (next section), landing on the same node means your calls keep appearing to come from the same address — stable, not alternating request to request.",
    /** Caption for the request-path figure. The diagram itself is decorative
     * (its shapes carry no text of their own); the strip's stage names, the
     * node numbers and the exits' country codes are real HTML, and the
     * numbered timeline right below the figure carries the full detail —
     * this caption is just a one-line frame for the figure, not the
     * accessible equivalent on its own. Deliberately no branch by server
     * here — see `InternalsPage.astro`'s header comment for why an earlier
     * version of this diagram drew one and got rejected. One client, one
     * nginx, one pool of nodes: libgen and gitlab differ only in which key
     * nginx computes, never in the shape of the pipeline. */
    diagramCaption:
      "The same six steps every request crosses, and why the same client always lands on the same node.",
    /** Stage labels along the strip. `Cloudflare`/`nginx` are proper
     * nouns/product names, identical in both languages — see how the rest
     * of this file already treats them (e.g. `affinityIntro`). */
    diagramStageClient: "you",
    diagramStageNodes: "nodes",
    diagramStageEgress: "exits",
    diagramStageDestination: "destination",
    /** The six annotation bubbles, cycled one at a time beside the strip —
     * short by design, the full detail lives in `diagramTimelineStep1..6`
     * below. Order and substance follow the approved spec's bubble table
     * (`.superpowers/sdd/internals-diagram-spec.md`), plus bubble 6 (the
     * request leaving for its destination), added so the traveling
     * highlight box has somewhere to go after "exits" instead of jumping
     * straight back to "you" — see `InternalsPage.astro`'s header comment,
     * "UPDATE 2026-08-23 (destination hop)". Bubble 5 says "its own fixed
     * exit" rather than the spec's "fixed country": since 2026-09-01 the
     * figure draws one exit per node, and two of those exits share a
     * country. */
    diagramBubble1:
      "Your client opens the request, with a Bearer token or without one",
    diagramBubble2: "Cloudflare passes it through to the origin",
    diagramBubble3: "Here the key gets computed: your IP, or the token's hash",
    diagramBubble4: "The same key always picks the same node",
    diagramBubble5: "That node leaves through its own fixed exit",
    diagramBubble6: "The request goes out to the server that answers it",
    /** Legend for the connector line, which is painted in one colour per
     * transport: the strip draws five hops and said nothing about how any of
     * them travels — the one thing a visitor asking "can anyone read my
     * token?" needs from a picture of the path. A legend, not a label per
     * joint: five labels riding on the wire were tried first and collided
     * with an icon at every hop below 481px (the gap between two adjacent
     * stage icons is ~30px there, a legible label ~27px), so the author
     * asked for colour plus one horizontal legend instead. Colour is never
     * the only carrier — these three words are real text, and the `wire*`
     * section below states it all in prose. `https`/`WireGuard` are
     * protocol and product names, identical in both languages.
     *
     * KEEP-IN-SYNC (nginx → instance transport): today that hop is plain
     * HTTP on the loopback address, so it is "local" here and "nothing
     * leaves this machine" in `wireBody[0]`. When TLS between nginx and the
     * instances lands (planned alongside the next gitlab-mcp-server
     * release), update BOTH strings in BOTH languages, and the `--local`
     * swatch colour in `InternalsPage.astro` if the hop becomes TLS. */
    diagramLegendTls: "https",
    diagramLegendLocal: "local",
    diagramLegendWg: "WireGuard",
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
      "That key feeds a consistent-hash balancer, which is why it keeps choosing the same one of the three running instances for you — never a different one from one call to the next. If that instance does not answer, nginx retries the same request on another one and leaves the failed one out for a short while; a restarted instance rejoins on its own, and updates are rolled out one instance at a time, so the other two keep serving — see “When something fails” below.",
    diagramTimelineStep5:
      "That instance always leaves through its own exit node — one of three, two in Spain and one in the United Kingdom, fixed per instance unless the watcher described under “When something fails” has to move it — so your calls keep appearing to come from the same address instead of alternating.",
    diagramTimelineStep6:
      "That connection reaches the actual destination: a Library Genesis mirror if you called libgen, or gitlab.com if you called gitlab — fixed by this deployment, not a host the caller picks.",

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
    /**
     * The transport section. It exists because the figure's legend labels
     * each hop, and a label like `https` is a claim: this is where that
     * claim is stated in full, INCLUDING the two points where TLS terminates
     * by design. Saying "encrypted end to end" and stopping there would be
     * the comfortable version and also the false one — a CDN and a reverse
     * proxy both decrypt by definition, and this page's whole job is to say
     * what actually happens. Every sentence here was checked against the
     * running config, not assumed: the loopback upstreams and the
     * http→https redirect in the vhost, TLSv1.3 on every origin hit in the
     * access log, the WireGuard sidecars and their capability set in the
     * compose file, and the absence of `$http_authorization` (and of the
     * affinity hash) from every `log_format` on the box.
     *
     * KEEP-IN-SYNC (nginx → instance transport): see `diagramLegendLocal`.
     * The "nothing leaves this machine" sentence in `wireBody[0]` describes
     * plain HTTP on loopback and changes the day that hop gets TLS.
     */
    wireEyebrow: "On the wire: what is encrypted, and where it is not",
    wireBody: [
      "Every hop that crosses a network is encrypted. Your client reaches Cloudflare over HTTPS; Cloudflare reaches this server over HTTPS too — plain HTTP gets a redirect and the domain is on the HSTS preload list; and the call that finally leaves for its destination is HTTPS as well, negotiated by the instance itself and only forwarded, still sealed, through the WireGuard tunnel that gives it its exit. Between nginx and the instances nothing leaves this machine, though it is worth being exact about what that means: nginx dials 127.0.0.1 and the kernel hands the connection straight to the container, with no user-space proxy in between. That segment is not loopback, so the honest claim is not that there is no network but that nobody is on it — the six containers on that private bridge are the six WireGuard sidecars, one per instance; each instance lives inside its sidecar's network namespace with every Linux capability dropped and a read-only filesystem, and only the sidecar holds the one capability a tunnel needs.",
      "So nobody sitting between the hops can read your token. Two points do see it, and by design: Cloudflare's edge, which decrypts and re-encrypts everything it proxies, as any CDN does; and this server, where nginx needs the token to compute the affinity hash and the instance needs it to make the call you asked for. Neither one writes it down — no access log on this machine records the `Authorization` header, and the hash derived from it is not logged either: it lives just long enough to pick an instance.",
      "The last hop is HTTPS to a host this deployment declares — gitlab.com, the one authorization server OAuth allows — never to one a caller supplies.",
    ],

    egressEyebrow: "Egress: which exit a request leaves from",
    /**
     * Three nodes, named by what they are rather than by where: two are
     * IONOS VPS (one in the United Kingdom, one in Spain) and the third is a
     * home connection elsewhere in Spain with a dynamic address. The town is
     * deliberately not named. "Never through the address of the network this
     * server sits on" replaces the old "never through the home network's
     * own address", which stopped being unambiguous the day one of the exits
     * became a home connection too.
     */
    egressBody: [
      "Every outbound call, from any instance, leaves through a WireGuard tunnel to one of three exit nodes — a VPS run by IONOS in the United Kingdom, another in Spain, and a home connection elsewhere in Spain whose dynamic address is kept current by DDNS — never through the address of the network this server sits on.",
      "The assignment is fixed per instance and identical for both servers: each has one instance on each of the three exit nodes, so two of its three instances leave through Spain and one through the United Kingdom. Whichever it is, what the destination sees is that exit's address, never this network's.",
    ],

    /**
     * What happens when any of the above stops working. One section, after
     * "Egress" and before "A personal service", rather than a paragraph
     * inside "Three instances" and another inside "Egress": both failures
     * end in the same consequence for the client (the ring hands your arc to
     * the next point), and that is worth saying once, in one place. Every
     * number was read from the scripts and the nginx config that implement
     * it — proxy_mcp.conf's retry policy, the upstreams' max_fails, the
     * sidecar's healthcheck, egress-health.sh's thresholds, mcp_roll.sh's
     * drain timeout — and the egress ladder was exercised end to end on the
     * live system the day it shipped. No ports, as the spec requires.
     */
    failuresEyebrow: "When something fails",
    failuresBody: [
      "An instance can crash or hang. An update takes one out on purpose, but that is not a failure nginx ever sees: the instance is drained first, as the next paragraph describes. A request whose connection to a crashed instance never opened is retried on another one — up to three attempts in all, and transparently: the client sees one answer, not a failure. A request that had already been delivered is not retried, and that is deliberate: a tool call can have side effects — a write to GitLab, say — and repeating one blindly is worse than reporting that it failed. A hung instance is that case: it accepts the call and never answers, so the call times out rather than being replayed. Three failures in a row, refused or timed out, set the instance aside for ten seconds; after that it is tried again, and a success keeps it in.",
      "Underneath, Docker restarts an instance whose process dies, and a check that runs every two minutes recreates any container that has disappeared altogether. Updates take the same path, one instance at a time: it is marked down in nginx, its open connections get up to forty-five seconds to finish, it is recreated on the new version, it has to answer its own health check, and only then does it return — and none of that starts unless another instance of the same server is verifiably serving at that moment. Whoever was pinned to it is handed to another instance for those couple of minutes, and comes back afterwards.",
      "An exit can fail too, and that is the failure this deployment is built around. Each instance's tunnel measures its own way out once a minute — a connection through the tunnel to the open internet and back, not a greeting to the far end, because a node can answer the handshake and still route nothing. Three failed readings in a row, and a watcher that reads them every minute takes that instance out of rotation: roughly three to four minutes after the cut, while the other two instances of that server carry on. It returns once it has been out for at least three minutes and has read as healthy on two checks a minute apart. Only when both instances that share an exit node have been out for twenty minutes — or sooner, if a second node fails and a server would be left with one instance — does the watcher move one of them to another node, leaving the other out as the sensor that says when the node is back; twenty minutes of that sensor working and the moved one goes home. If all six tunnels fail at once, nothing moves: that is this machine or the internet, not three nodes at once — and traffic is never sent out through the home connection instead.",
      "What that means for you follows from the affinity section. Your key on the ring does not change when an instance is out: only the arc that instance owned is handed on, to the next point on the ring, so you land on one of the other two — the same one for as long as the outage lasts, not a different one per request — and everyone else stays where they were. Being handed on may change the country your calls appear to come from, since the substitute exits through its own; that comes back with your instance. Being moved is the reverse: after the couple of minutes the move itself takes, you are back on your instance, and its exit is that of its new node for as long as it is away from home. An instance that was only taken out of rotation still holds whatever it had for you when it returns; one that was recreated — for a move or an update — starts empty: for gitlab that is the one verification the affinity section already prices in, for libgen a cold read cache, which refills on use.",
    ],
    /**
     * The two ladders drawn inside "When something fails" — `FailureLadder.astro`
     * on the page, `FailureLadder.md.ts` in the twin — each placed right after
     * the paragraph it condenses. `at` is the moment a rung applies, kept to a
     * word or two because it is a column; `state` is the word the reader
     * scans for; `note` is one line of how. Same numbers as the prose, from
     * the same scripts and config (see `failuresEyebrow`'s comment): change
     * one, change both. The exit ladder forks at rung 4: "Back" is what
     * happens if the exit recovers, "Moved" what happens if it does not, and
     * the note on each says so.
     */
    failureLadderInstance: {
      title: "An instance fails",
      steps: [
        {
          at: "0 s",
          state: "No answer",
          note: "Its connection is refused because the process is gone. A hung instance is the harder case: it accepts the call, lets it time out, and that call is not retried either.",
        },
        {
          at: "same call",
          state: "Retried",
          note: "The same request goes to another instance, up to three attempts in all; one already delivered is never replayed.",
        },
        {
          at: "3 failures",
          state: "Set aside",
          note: "Ten seconds out, then tried again.",
        },
        {
          at: "2 min",
          state: "Restarted",
          note: "Docker restarts a dead process at once; a check every two minutes notices a container that vanished and recreates it.",
        },
        {
          at: "next call",
          state: "Back",
          note: "One success keeps it in, and whoever was pinned to it returns with it.",
        },
      ],
    },
    /**
     * `at` reads two ways, on purpose: rungs 2 and 3 count from the cut
     * ("about", because a reading takes up to a minute to come round and the
     * watcher another), and a leading `+` counts from the rung before — the
     * three minutes and the twenty both start when the instance was taken
     * out, and rung 6's twenty when the sensor came back. Words, not `≈` or
     * an en dash: "2–3 min" is read aloud as "2 3 min".
     */
    failureLadderEgress: {
      title: "An exit fails",
      steps: [
        {
          at: "0 min",
          state: "Cut",
          note: "The node stops routing; it may still answer the tunnel's handshake.",
        },
        {
          at: "about 3 min",
          state: "Unhealthy",
          note: "Three failed readings in a row, one a minute, through the tunnel to the open internet.",
        },
        {
          at: "about 4 min",
          state: "Out of rotation",
          note: "The watcher, reading every minute, marks the instance down in nginx; the other two carry on.",
        },
        {
          at: "+3 min",
          state: "Back",
          note: "If the exit recovers: out for at least three minutes, and healthy again on two checks a minute apart.",
        },
        {
          at: "+20 min",
          state: "Moved",
          note: "If it does not: with both instances of that node out for twenty minutes, or sooner if a second node fails, one moves to another node and the other stays out as the sensor.",
        },
        {
          at: "+20 min",
          state: "Home",
          note: "The sensor returns first, the same way as above; twenty minutes of it healthy and the moved one goes back.",
        },
      ],
    },

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
    lede: "Cómo llega de verdad una petición a estos servidores: tu cliente, Cloudflare, nginx, una de las tres instancias, su salida WireGuard y el destino pedido.",

    pathEyebrow: "El camino de una petición",
    /** Ver `en.pathBody`: dos frases; los seis saltos los cuenta la línea temporal. */
    pathBody: [
      "Una llamada a cualquiera de los dos servidores cruza los mismos seis pasos antes de volver — la figura los dibuja, y la lista numerada de debajo recorre cada uno. Lo único que elige quien llama es el servidor: apuntar el cliente a /libgen o a /gitlab pasa antes de que la petición exista en el cable, y a partir de ahí el recorrido es el mismo.",
    ],

    instancesEyebrow: "Tres instancias, un solo nginx",
    instancesBody: [
      "Detrás de ese nginx hay tres instancias de cada servidor, balanceadas en vez de correr como un único proceso.",
      "Cada instancia tiene su propia caché, así que un acierto en una no lo es en las otras: el reparto entre tres es el precio de poder repartir carga entre ellas.",
    ],

    affinityEyebrow:
      "Afinidad: por qué la segunda petición cae en el mismo nodo",
    affinityIntro:
      "nginx no rota en round-robin entre esas tres instancias: elige una por hash consistente, así que el mismo cliente sigue cayendo en el mismo nodo en vez de en uno distinto cada vez.",
    affinityLibgen:
      "libgen hace el hash sobre la IP del cliente (`hash $binary_remote_addr consistent`) — no hay token en el que apoyarse, y la ganancia es la caché de lectura: las llamadas repetidas del mismo visitante siguen cayendo en la instancia que ya las tiene calientes.",
    affinityGitlab:
      "gitlab hace el hash sobre la credencial `Authorization: Bearer` del cliente, con la IP como respaldo cuando una petición no lleva ninguna. El motivo es estructural, no de caché: gitlab levanta un servidor aislado por cliente, y su pool de conexiones se indexa por `(token, URL)` — cada entrada comprueba scopes y edición contra GitLab la primera vez que se usa. Con OAuth pesa aún más: cada instancia cachea además la identidad de un token ya verificado durante quince minutos, así que rebotar entre nodos obligaría a re-verificar ese token contra gitlab.com —una llamada de red a un tercero— en cada salto. Un token de acceso OAuth se hashea igual que un PAT, porque llega en la misma cabecera, con un matiz: gitlab.com caduca los tokens de acceso a las dos horas, y un token renovado es una cadena distinta. Así que la afinidad aguanta lo que dure un token, no para siempre, y mudarse cuesta una verificación.",
    affinityCodeIntro: [
      "La directiva que convierte una credencial en una decisión de enrutado es esta. Lee la cabecera `Authorization`, y al token que va dentro le pasan dos cosas: nginx lo combina con una sal secreta y lo hashea en `$mcp_affinity`, que es el valor sobre el que de verdad decide el balanceo por hash consistente.",
      "Ese hash es necesario, no decorativo — es la única forma que tiene nginx de devolver a un cliente a la instancia que ya tiene su pool, sin comparar tokens entre sí directamente.",
      "Lo que NO pasa: el token en sí no se escribe en ningún sitio, y el hash tampoco. `$mcp_affinity_salt` y `$mcp_affinity` son variables de nginx corrientes, con el ámbito de la petición que las calculó — nada de esto llega a una línea de log, y nada sobrevive a la petición.",
      "Aun así: desconfía por defecto de cualquier servidor remoto al que le entregues un token — este incluido. Precisamente por eso se enseña la directiva entera en vez de solo afirmarlo.",
    ],
    /** Ver `en.affinityCodeComment`: la única línea traducida del snippet. */
    affinityCodeComment: "# el valor real no se publica",
    /** Ver `en.affinityConsequence`: «la misma dirección», no «el mismo país». */
    affinityConsequence:
      "El efecto práctico: como cada instancia tiene además un nodo de salida fijo (siguiente sección), caer en el mismo nodo significa que tus llamadas siguen pareciendo venir de la misma dirección — estable, no alternando de una petición a la siguiente.",
    /** Ver `en.diagramCaption`: leyenda breve de la figura del camino de la petición. */
    diagramCaption:
      "Los mismos seis pasos que cruza toda petición, y por qué el mismo cliente cae siempre en el mismo nodo.",
    /** Ver `en.diagramStageClient` etc.: etiquetas de la tira. */
    diagramStageClient: "tú",
    diagramStageNodes: "nodos",
    diagramStageEgress: "salidas",
    diagramStageDestination: "destino",
    /** Ver `en.diagramBubble1..6`: los seis globos, texto literal de la
     * especificación aprobada (`.superpowers/sdd/internals-diagram-spec.md`),
     * más el globo 6 (la petición saliendo hacia su destino); el 5 dice «su
     * salida fija» y no «su país fijo» porque dos de las tres salidas
     * comparten país. */
    diagramBubble1: "Tu cliente abre la petición, con un token Bearer o sin él",
    diagramBubble2: "Cloudflare la pasa al origen",
    diagramBubble3: "Aquí se calcula la clave: tu IP, o el hash del token",
    diagramBubble4: "La misma clave elige siempre el mismo nodo",
    diagramBubble5: "Ese nodo sale por su salida fija",
    diagramBubble6: "Esa petición sale hacia el servidor que la responde",
    /** Ver `en.diagramLegendTls` y el KEEP-IN-SYNC de TLS que lleva encima. */
    diagramLegendTls: "https",
    diagramLegendLocal: "local",
    diagramLegendWg: "WireGuard",
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
      "Esa clave alimenta un balanceador por hash consistente, por eso elige siempre la misma de las tres instancias en marcha para ti — nunca una distinta de una llamada a la siguiente. Si esa instancia no responde, nginx reintenta la misma petición en otra y deja fuera a la que falló durante un rato; una instancia reiniciada vuelve sola, y las actualizaciones se hacen de una en una, así que las otras dos siguen sirviendo — ver «Cuando algo falla», más abajo.",
    diagramTimelineStep5:
      "Esa instancia sale siempre por su propio nodo de salida — uno de tres, dos en España y uno en Reino Unido, fijo por instancia salvo que el vigilante descrito en «Cuando algo falla» tenga que moverla —, así que tus llamadas siguen pareciendo venir de la misma dirección en vez de alternar.",
    diagramTimelineStep6:
      "Esa conexión llega al destino real: un mirror de Library Genesis si llamaste a libgen, o gitlab.com si llamaste a gitlab — fijo en este despliegue, no un host que elija quien llama.",

    /** Ver `en.storageEyebrow`. */
    storageEyebrow: "Qué guarda el inspector, y cómo comprobarlo",
    /** Ver `en.mdDirectiveNote`. */
    mdDirectiveNote:
      "La propia directiva de nginx está citada entera en la página: {url}",
    storageBody: [
      "Nada. El token que pegas —o, cuando el botón de acceso esté activo, el que consigue él— vive en la memoria del componente de la página y en ningún sitio más: sin localStorage, sin sessionStorage, sin cookies, sin parámetros en la URL y sin logs. Al recargar desaparece, al navegar a cualquier sitio desaparece —este sitio no lleva enrutador de cliente, así que cada enlace es un documento nuevo— y al cerrar la pestaña desaparece.",
      "Eso es una afirmación sobre una ausencia, que es justo la clase que nunca deberías creerte por las buenas. Así puedes verlo tú mismo, con el navegador que ya tienes abierto.",
      "En Chrome o Edge, pulsa F12 y ve a Aplicación → Almacenamiento. Pega un token en el inspector, llama a algo y vuelve a mirar: Local Storage, Session Storage y Cookies de este sitio siguen vacíos. En Firefox ese panel se llama Almacenamiento; en Safari es Desarrollo → Mostrar inspector web → Almacenamiento.",
      "Después mira a dónde va. En la pestaña Red, lanza una llamada y abre la petición a /gitlab: la cabecera Authorization está en esa petición y en ninguna otra. El único otro sitio donde podría aparecer el token es el intercambio de acceso con gitlab.com, y solo si usaste ese botón, que ahora mismo está desactivado — así que hoy hay exactamente un destino. La frontera la impone el propio navegador, porque la Content-Security-Policy de esta página nombra esos dos destinos y ningún otro. Todo lo de este párrafo se ve en ese panel, sin fiarte de nadie.",
    ],
    /** Ver `en.wireEyebrow` y su KEEP-IN-SYNC de TLS. */
    wireEyebrow: "Por el cable: qué va cifrado y dónde deja de estarlo",
    wireBody: [
      "Todo salto que cruza una red va cifrado. Tu cliente llega a Cloudflare por HTTPS; Cloudflare llega a este servidor también por HTTPS —el HTTP a secas se responde con una redirección y el dominio está en la lista de precarga de HSTS—, y la llamada que sale por fin hacia su destino es HTTPS igualmente, negociada por la propia instancia y solo reenviada, aún sellada, por el túnel WireGuard que le da su salida. Entre nginx y las instancias no sale nada de esta máquina, aunque conviene ser exacto con qué significa eso: nginx marca 127.0.0.1 y el núcleo entrega la conexión directamente al contenedor, sin ningún proxy en espacio de usuario entre medias. Ese tramo no es loopback, así que lo honesto no es decir que no hay red, sino que no hay nadie en ella — los seis contenedores de ese bridge privado son los seis sidecars WireGuard, uno por instancia; cada instancia vive dentro del espacio de red de su sidecar con todas las capacidades de Linux retiradas y el sistema de ficheros en solo lectura, y solo el sidecar conserva la única capacidad que un túnel necesita.",
      "Así que nadie que esté entre medias puede leer tu token. Sí lo ven dos puntos, y a propósito: el borde de Cloudflare, que descifra y vuelve a cifrar todo lo que reenvía, como cualquier CDN; y este servidor, donde nginx necesita el token para calcular el hash de afinidad y la instancia lo necesita para hacer la llamada que le has pedido. Ninguno de los dos lo apunta: ningún log de acceso de esta máquina registra la cabecera `Authorization`, y el hash que sale de ella tampoco se registra — vive lo justo para elegir instancia.",
      "El último salto es HTTPS contra un host que declara este despliegue — gitlab.com, el único servidor de autorización que OAuth admite —, nunca contra uno que aporte quien llama.",
    ],

    egressEyebrow: "Salida: por dónde sale una petición",
    /** Ver `en.egressBody`: tres nodos, sin nombrar el municipio. */
    egressBody: [
      "Toda llamada saliente, desde cualquier instancia, sale por un túnel WireGuard hacia uno de tres nodos de salida —un VPS de IONOS en Reino Unido, otro en España y una conexión doméstica en otro punto de España cuya IP dinámica se mantiene al día por DDNS— nunca por la dirección de la red en la que está este servidor.",
      "La asignación es fija por instancia e idéntica en los dos servidores: cada uno tiene una instancia en cada uno de los tres nodos de salida, así que dos de sus tres instancias salen por España y una por Reino Unido. Sea cual sea, lo que ve el destino es la dirección de esa salida, nunca la de esta red.",
    ],

    /** Ver `en.failuresEyebrow`: una sola sección, tras «Salida». */
    failuresEyebrow: "Cuando algo falla",
    failuresBody: [
      "Una instancia puede caerse o colgarse. Una actualización la retira a propósito, pero eso no es un fallo que nginx llegue a ver: la instancia se drena antes, como describe el párrafo siguiente. Una petición cuya conexión con una instancia caída nunca llegó a abrirse se reintenta en otra — hasta tres intentos en total, y de forma transparente: el cliente ve una respuesta, no un fallo. Una petición que ya se había entregado no se reintenta, y es a propósito: una llamada a una herramienta puede tener efectos — una escritura en GitLab, por ejemplo — y repetirla a ciegas es peor que informar de que falló. Una instancia colgada es justo ese caso: acepta la llamada y no contesta, así que la llamada agota su tiempo en vez de repetirse. Tres fallos seguidos, rechazados o agotados, apartan la instancia diez segundos; pasados, se vuelve a probar, y un acierto la mantiene dentro.",
      "Por debajo, Docker reinicia una instancia cuyo proceso muere, y una comprobación cada dos minutos recrea cualquier contenedor que haya desaparecido del todo. Las actualizaciones siguen el mismo camino, de una instancia en una: se marca fuera en nginx, sus conexiones abiertas tienen hasta cuarenta y cinco segundos para terminar, se recrea con la versión nueva, tiene que contestar a su propia comprobación de salud y solo entonces vuelve — y nada de eso empieza si otra instancia del mismo servidor no está sirviendo, comprobado, en ese momento. Quien estuviera fijado a ella pasa a otra instancia durante ese par de minutos, y después vuelve.",
      "Una salida también puede fallar, y ese es el fallo alrededor del que está montado este despliegue. El túnel de cada instancia mide su propia salida una vez por minuto — una conexión por el túnel hasta internet abierto y vuelta, no un saludo al otro extremo, porque un nodo puede contestar al handshake y no encaminar nada. Tres lecturas fallidas seguidas, y un vigilante que las lee cada minuto saca esa instancia de rotación: unos tres o cuatro minutos después del corte, mientras las otras dos instancias de ese servidor siguen. Vuelve cuando lleva al menos tres minutos fuera y se ha leído sana en dos comprobaciones con un minuto entre ellas. Solo cuando las dos instancias que comparten un nodo de salida llevan veinte minutos fuera — o antes, si cae un segundo nodo y un servidor se quedaría con una sola instancia — el vigilante mueve una de ellas a otro nodo, y deja la otra fuera como sensor que dice cuándo ha vuelto el nodo; veinte minutos de ese sensor funcionando y la movida regresa a casa. Si fallan los seis túneles a la vez, no se mueve nada: eso es esta máquina o internet, no tres nodos a la vez — y el tráfico nunca sale por la conexión de casa en su lugar.",
      "Lo que eso significa para ti se sigue de la sección de afinidad. Tu clave en el anillo no cambia cuando una instancia está fuera: solo el arco que era de esa instancia se cede al siguiente punto del anillo, así que caes en una de las otras dos — la misma mientras dure la avería, no una distinta por petición — y los demás se quedan donde estaban. Que te cedan puede cambiar el país del que parecen venir tus llamadas, porque la sustituta sale por el suyo; vuelve con tu instancia. Que la muevan es lo contrario: pasado el par de minutos que tarda la mudanza, estás de nuevo en tu instancia, y su salida es la del nodo nuevo mientras esté fuera de casa. Una instancia que solo salió de rotación conserva lo que tenía tuyo cuando vuelve; una recreada — por una mudanza o una actualización — empieza vacía: en gitlab es la verificación que la sección de afinidad ya da por descontada, en libgen una caché de lectura fría, que se vuelve a llenar con el uso.",
    ],
    /** Ver `en.failureLadderInstance`: las dos escaleras de «Cuando algo falla». */
    failureLadderInstance: {
      title: "Cae una instancia",
      steps: [
        {
          at: "0 s",
          state: "No contesta",
          note: "Su conexión se rechaza porque el proceso ya no está. Una instancia colgada es el caso difícil: acepta la llamada, la deja agotar su tiempo, y esa llamada tampoco se reintenta.",
        },
        {
          at: "esa llamada",
          state: "Reintento",
          note: "La misma petición va a otra instancia, hasta tres intentos en total; una ya entregada no se repite nunca.",
        },
        {
          at: "3 fallos",
          state: "Apartada",
          note: "Diez segundos fuera, y se vuelve a probar.",
        },
        {
          at: "2 min",
          state: "Reiniciada",
          note: "Docker reinicia al momento un proceso muerto; una comprobación cada dos minutos detecta un contenedor desaparecido y lo recrea.",
        },
        {
          at: "otra llamada",
          state: "Vuelve",
          note: "Un acierto la mantiene dentro, y quien estaba fijado a ella vuelve con ella.",
        },
      ],
    },
    /** Ver `en.failureLadderEgress`: «unos» cuenta desde el corte, `+` desde el peldaño anterior. */
    failureLadderEgress: {
      title: "Cae una salida",
      steps: [
        {
          at: "0 min",
          state: "Corte",
          note: "El nodo deja de encaminar; puede seguir contestando al handshake del túnel.",
        },
        {
          at: "unos 3 min",
          state: "Enferma",
          note: "Tres lecturas fallidas seguidas, una por minuto, por el túnel hasta internet abierto.",
        },
        {
          at: "unos 4 min",
          state: "Fuera de rotación",
          note: "El vigilante, que lee cada minuto, la marca fuera en nginx; las otras dos siguen.",
        },
        {
          at: "+3 min",
          state: "Vuelve",
          note: "Si la salida se recupera: al menos tres minutos fuera, y sana de nuevo en dos comprobaciones con un minuto entre ellas.",
        },
        {
          at: "+20 min",
          state: "Se muda",
          note: "Si no: con las dos instancias de ese nodo veinte minutos fuera, o antes si cae un segundo nodo, una se muda a otro nodo y la otra se queda fuera como sensor.",
        },
        {
          at: "+20 min",
          state: "A casa",
          note: "El sensor vuelve primero, igual que arriba; veinte minutos sano y la movida regresa.",
        },
      ],
    },

    personalEyebrow: "Un servicio personal",
    personalBody: [
      "Nada de esto cambia lo que son estos servidores: un proyecto personal, mantenido por una persona, sin SLA y sin garantía de que ninguno de los dos endpoints siga en pie — o igual — de un día para otro.",
    ],
    /** Ver `en.policiesLink`: enlace a `/policies/` con las declaraciones completas. */
    policiesLink: "Políticas completas: privacidad, logs y postura legal",
  },
} as const;
