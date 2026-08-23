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
    lede: "How a request actually reaches these servers: from your browser, through Cloudflare, nginx, one of three running instances and an egress proxy, to the destination it asked for.",
    /** Link from `/internals/` back to the home page. */

    pathEyebrow: "The path of a request",
    pathBody: [
      "A call to either server crosses the same five hops before it comes back: your client to Cloudflare, Cloudflare to nginx on the home server that fronts both MCPs, nginx to one of three running instances of the server you called, that instance out through an egress proxy, and the egress proxy to the actual destination — a Library Genesis mirror for libgen, or the GitLab instance you pointed gitlab at.",
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
      "gitlab hashes on the client's `PRIVATE-TOKEN` instead, falling back to the IP address when a request carries none. The reason is structural, not a cache: gitlab spins up an isolated server per client, and its connection pool is indexed by `(token, URL)` — each entry checks scopes and edition against that user's own GitLab API the first time it is used. Bouncing between nodes on every request would repeat that check for nothing, tripling work three instances were meant to share.",
    affinityCodeIntro: [
      "The directive that turns a token into a routing decision looks like this. Two things happen to the token in it: nginx hashes it together with a secret salt into `$mcp_affinity`, which is the value the consistent-hash balancer actually keys on.",
      "That hash is necessary, not decorative — it is the only way nginx can send a client back to the instance that already holds its pool, without ever comparing tokens to each other directly.",
      "What does not happen: the token itself is never written anywhere, and neither is the hash. `$mcp_affinity_salt` and `$mcp_affinity` are ordinary nginx variables, scoped to the single request that computed them — nothing here reaches a log line, and nothing outlives the request.",
      "Even so: default to distrusting any remote server you hand a token to — this one included. That is exactly why the directive is shown in full instead of just asserted.",
    ],
    /** The one translated line inside the otherwise-untranslated snippet. */
    affinityCodeComment: "# the real value is never published",
    affinityConsequence:
      "The practical effect: because egress is also fixed per instance (next section), landing on the same node means your calls keep appearing to come from the same country — stable, not alternating request to request.",

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
    lede: "Cómo llega de verdad una petición a estos servidores: desde tu navegador, pasando por Cloudflare, nginx, una de las tres instancias en marcha y un proxy de salida, hasta el destino que pedías.",

    pathEyebrow: "El camino de una petición",
    pathBody: [
      "Una llamada a cualquiera de los dos servidores cruza los mismos cinco saltos antes de volver: tu cliente hasta Cloudflare, Cloudflare hasta el nginx del servidor de casa que da la cara por los dos MCP, nginx hasta una de las tres instancias en marcha del servidor que llamaste, esa instancia hacia fuera por un proxy de salida, y el proxy de salida hasta el destino real — un mirror de Library Genesis para libgen, o la instancia de GitLab a la que apuntaste gitlab.",
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
      "gitlab hace el hash sobre el `PRIVATE-TOKEN` del cliente, con la IP como respaldo cuando una petición no lleva ninguno. El motivo es estructural, no de caché: gitlab levanta un servidor aislado por cliente, y su pool de conexiones se indexa por `(token, URL)` — cada entrada comprueba scopes y edición contra la API de GitLab de ese usuario la primera vez que se usa. Rebotar entre nodos en cada petición repetiría esa comprobación para nada, triplicando un trabajo que tres instancias debían repartirse.",
    affinityCodeIntro: [
      "La directiva que convierte un token en una decisión de enrutado es esta. Al token le pasan dos cosas: nginx lo combina con una sal secreta y lo hashea en `$mcp_affinity`, que es el valor sobre el que de verdad decide el balanceo por hash consistente.",
      "Ese hash es necesario, no decorativo — es la única forma que tiene nginx de devolver a un cliente a la instancia que ya tiene su pool, sin comparar tokens entre sí directamente.",
      "Lo que NO pasa: el token en sí no se escribe en ningún sitio, y el hash tampoco. `$mcp_affinity_salt` y `$mcp_affinity` son variables de nginx corrientes, con el ámbito de la petición que las calculó — nada de esto llega a una línea de log, y nada sobrevive a la petición.",
      "Aun así: desconfía por defecto de cualquier servidor remoto al que le entregues un token — este incluido. Precisamente por eso se enseña la directiva entera en vez de solo afirmarlo.",
    ],
    /** Ver `en.affinityCodeComment`: la única línea traducida del snippet. */
    affinityCodeComment: "# el valor real no se publica",
    affinityConsequence:
      "El efecto práctico: como el egreso también es fijo por instancia (siguiente sección), caer en el mismo nodo significa que tus llamadas siguen pareciendo venir del mismo país — estable, no alternando de una petición a la siguiente.",

    egressEyebrow: "Egreso: de qué país sale una petición",
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
