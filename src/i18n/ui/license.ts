/**
 * License page strings: what on this site may be reused and on what terms —
 * the text, the site's code, the two servers, the files written for
 * programs, what the servers return (not the author's to license), other
 * people's names and logos, and where to ask for anything else.
 *
 * Modelled on jmrp.io's /license/ page (its `license.mdx`), which this host
 * had nothing equivalent to: the only trace of a license on the site was the
 * MIT URL on the two servers' JSON-LD nodes. The portrait section from
 * jmrp.io is deliberately absent — this site renders no portrait.
 *
 * Every claim was checked on 2026-09-01: the site repository and both server
 * repositories are MIT (GitHub API, the LICENSE files, and the
 * `org.opencontainers.image.licenses` label on the images this host runs);
 * text-and-data mining is already declared not reserved by
 * `/.well-known/tdmrep.json` and robots.txt's `Content-Signal`; the server
 * cards are snapshots of what each binary publishes, not the site author's
 * prose. The CC BY 4.0 grant over the text is the one decision this page
 * makes rather than reports, and `LICENSE-CONTENT.md` in the repository root
 * carves it out of the MIT grant so the two cannot contradict each other.
 *
 * Bodies are printed as plain text, so every link lives in its own key
 * (`*Link`/`*Href`), the same split `policies.credentialNotice` uses.
 */
export const license = {
  en: {
    licenseMetaTitle:
      "License — reusing this site, its code and the servers · jmrp.io",
    /** Kicker above the h1 (`.section-title`), like `policiesEyebrow`. */
    licenseEyebrow: "License",
    /** The page's `<h1>`, jmrp.io's own heading for the same page. */
    licenseTitle: "What you may reuse and how",
    /** Meta description AND opening paragraph, like `policiesIntro`. */
    licenseIntro:
      "How to reuse what is here: text under CC BY 4.0, the site and both servers under MIT, data files with no conditions, and what is not mine to license.",
    licenseOpening: [
      "Not everything here carries the same terms. The text is yours to reuse with credit, the code of the site and of both servers is open, the files written for programs carry no condition at all, and what the servers return was never mine to license. This page says which is which.",
    ],

    licenseTextEyebrow: "Text",
    licenseTextBody: [
      "The text of this site — every page, its markdown twin, and the same sentences where llms.txt and llms-full.txt repeat them — is published under the Creative Commons Attribution 4.0 International license. Republish it, translate it, quote it at whatever length you need, in any medium, commercially or not, as long as you credit the author and indicate whether you changed anything.",
      'Credit it to "José Manuel Requena Plens" and, where the medium allows a link, point that link at the page the text came from. No permission is needed, and text and data mining is not reserved: robots.txt and the site\'s TDM reservation file already say so to machines.',
      "Two things the pages show fall outside that. The catalogue each server publishes about itself at /libgen/.well-known/mcp/server-card.json and /gitlab/.well-known/mcp/server-card.json — its tool descriptions, prompts and resources, which the server pages show — is text that lives in that server's repository and carries the code's license, below. And material quoted from elsewhere — tool output, command lines, other people's names and logos — belongs to whoever owns it, and this license does not reach it.",
    ],
    licenseTextLink: "CC BY 4.0",
    licenseTextHref: "https://creativecommons.org/licenses/by/4.0/",

    licenseSiteEyebrow: "The site",
    licenseSiteBody: [
      "The source of this site — the pages, the inspector and the other small interactive parts, the build that produces the indexes, the twins and the nginx snippets — is public and MIT-licensed. That license covers the code, not the text it renders, which the section above governs; the repository says so in a content-license file of its own, so the MIT grant cannot be read as reaching the prose.",
    ],
    licenseSiteLink: "Site source on GitHub",

    licenseServersEyebrow: "The servers",
    licenseServersBody: [
      "Both servers are open source under the MIT license, each in its own repository, and the images this host runs are built from those repositories and carry the same license. The catalogue each one publishes about itself — the descriptions of its tools, prompts and resources that the server pages show — is text from that repository, so it is MIT too.",
    ],

    licenseIndexesEyebrow: "Indexes",
    licenseIndexesBody: [
      "The files that exist to be read by programs — /servers.json, /servers/gitlab/actions.json, the connection cards this site publishes at /libgen/server-card and /gitlab/server-card (name, version, endpoint and a one-line description, not the catalogue of tools), and the documents under /.well-known/ (ai-catalog.json, api-catalog and the rest) — list endpoints, tool names, action ids, headers and URLs. Those are facts about the servers, not a work, and no condition attaches to them, one-line descriptions included: consume them, cache them, republish them as data, with or without saying where they came from.",
      "llms.txt, llms-full.txt and the markdown twin of each page are a different case: they carry the site's own prose — the same sentences the pages render — and keep the terms of the text.",
    ],

    licenseReturnedEyebrow: "What the servers return",
    licenseReturnedBody: [
      "What the servers return is not mine, and no license on this page reaches it. libgen relays catalogues and files that other people operate — open-access providers and shadow libraries, named one by one under the legal position — and gitlab relays data from your own account on gitlab.com. What you may do with any of it is between you, the source and the law that applies to you.",
    ],
    /** Link text = the h2 it lands on (`policies.legalEyebrow`), like `credentialNoticeLink`. */
    licenseReturnedLink: "Legal position",

    licenseMarksEyebrow: "Names and logos",
    licenseMarksBody: [
      "The names and logos of other people's products and services that appear on this site — the sources libgen queries, the platforms the servers talk to, the infrastructure behind them — belong to whoever owns them. Naming them describes what this deployment does and implies neither affiliation nor endorsement. The same goes the other way: crediting me under CC BY 4.0 does not mean I endorse what you made with the text.",
    ],

    licensePermissionEyebrow: "Permission",
    /** The mailto sits right after this sentence, as on jmrp.io. */
    licensePermissionLead:
      "For anything the CC BY 4.0 grant and the MIT license do not cover, write to me directly:",
    licenseContact: "mail@jmrp.io",
    licensePermissionTail:
      "For what the servers return there is nothing I can grant: ask the source.",
  },
  es: {
    licenseMetaTitle:
      "Licencia — reutilizar este sitio, código y servidores · jmrp.io",
    /** Ver `en.licenseEyebrow`: kicker encima del h1. */
    licenseEyebrow: "Licencia",
    /** Ver `en.licenseTitle`: el `<h1>`, el mismo que usa jmrp.io. */
    licenseTitle: "Qué puedes reutilizar y cómo",
    /** Ver `en.licenseIntro`: meta description y párrafo inicial. */
    licenseIntro:
      "Cómo reutilizar lo que hay aquí: textos bajo CC BY 4.0, el sitio y los dos servidores bajo MIT, ficheros de datos sin condiciones, y lo que no es mío.",
    licenseOpening: [
      "No todo lo que hay aquí se publica en las mismas condiciones. Los textos puedes reutilizarlos atribuyendo la autoría, el código del sitio y el de los dos servidores está abierto, los ficheros escritos para programas no llevan condición alguna, y lo que devuelven los servidores nunca fue mío para licenciarlo. Esta página dice qué es cada cosa.",
    ],

    licenseTextEyebrow: "Textos",
    licenseTextBody: [
      "Los textos de este sitio —cada página, su gemelo en markdown y las mismas frases donde llms.txt y llms-full.txt las repiten— se publican bajo la licencia Creative Commons Atribución 4.0 Internacional. Republícalos, tradúcelos, cítalos con la extensión que necesites, en cualquier medio, con fines comerciales o sin ellos, siempre que atribuyas la autoría e indiques si has cambiado algo.",
      "Atribuye la autoría a «José Manuel Requena Plens» y, donde el medio admita un enlace, enlaza a la página de la que salió el texto. No hace falta permiso, y la minería de textos y datos no está reservada: robots.txt y el fichero de reserva TDM del sitio ya se lo dicen a las máquinas.",
      "Dos cosas que muestran las páginas quedan fuera de eso. El catálogo que cada servidor publica sobre sí mismo en /libgen/.well-known/mcp/server-card.json y /gitlab/.well-known/mcp/server-card.json —sus descripciones de herramientas, prompts y recursos, que muestran las páginas de servidor— es texto que vive en el repositorio de ese servidor y lleva la licencia del código, más abajo. Y el material citado de otra parte —salidas de herramientas, líneas de comando, nombres y logotipos ajenos— pertenece a quien sea su dueño, y esta licencia no lo alcanza.",
    ],
    licenseTextLink: "CC BY 4.0",
    licenseTextHref: "https://creativecommons.org/licenses/by/4.0/deed.es",

    licenseSiteEyebrow: "El sitio",
    licenseSiteBody: [
      "El código de este sitio —las páginas, el inspector y las demás piezas interactivas pequeñas, la compilación que genera los índices, los gemelos y los fragmentos de nginx— es público y está bajo licencia MIT. Esa licencia cubre el código, no el texto que renderiza, que se rige por la sección anterior; el repositorio lo dice en un fichero propio de licencia de contenidos, para que la cesión MIT no pueda leerse como si alcanzara la prosa.",
    ],
    licenseSiteLink: "Código del sitio en GitHub",

    licenseServersEyebrow: "Los servidores",
    licenseServersBody: [
      "Los dos servidores son open source bajo licencia MIT, cada uno en su propio repositorio, y las imágenes que corren en este host se construyen desde esos repositorios y llevan la misma licencia. El catálogo que cada uno publica sobre sí mismo —las descripciones de sus herramientas, prompts y recursos que muestran las páginas de servidor— es texto de ese repositorio, así que también es MIT.",
    ],

    licenseIndexesEyebrow: "Índices",
    licenseIndexesBody: [
      "Los ficheros que existen para que los lean programas —/servers.json, /servers/gitlab/actions.json, las fichas de conexión que publica este sitio en /libgen/server-card y /gitlab/server-card (nombre, versión, endpoint y una descripción de una línea, no el catálogo de herramientas), y los documentos bajo /.well-known/ (ai-catalog.json, api-catalog y el resto)— listan endpoints, nombres de herramientas, identificadores de acciones, cabeceras y URLs. Son hechos sobre los servidores, no una obra, y no llevan condición alguna, descripciones de una línea incluidas: consúmelos, cachéalos, republícalos como datos, digas o no de dónde salieron.",
      "llms.txt, llms-full.txt y el gemelo en markdown de cada página son otro caso: llevan la prosa del propio sitio —las mismas frases que pintan las páginas— y conservan las condiciones de los textos.",
    ],

    licenseReturnedEyebrow: "Lo que devuelven los servidores",
    licenseReturnedBody: [
      "Lo que devuelven los servidores no es mío, y ninguna licencia de esta página lo alcanza. libgen retransmite catálogos y ficheros que gestionan otros —proveedores de acceso abierto y bibliotecas en la sombra, nombrados uno por uno en la postura legal— y gitlab retransmite datos de tu propia cuenta en gitlab.com. Lo que puedas hacer con cualquiera de ellos es cosa tuya, de la fuente y de la ley que te sea aplicable.",
    ],
    /** Ver `en.licenseReturnedLink`: literal el h2 destino (`policies.legalEyebrow`). */
    licenseReturnedLink: "Postura legal",

    licenseMarksEyebrow: "Nombres y logotipos",
    licenseMarksBody: [
      "Los nombres y logotipos de productos y servicios ajenos que aparecen en este sitio —las fuentes que consulta libgen, las plataformas con las que hablan los servidores, la infraestructura que hay detrás— pertenecen a quien sea su dueño. Nombrarlos describe lo que hace este despliegue y no implica vinculación ni respaldo. Y al revés igual: atribuirme la autoría bajo CC BY 4.0 no significa que yo respalde lo que hayas hecho con el texto.",
    ],

    licensePermissionEyebrow: "Permiso",
    /** Ver `en.licensePermissionLead`: el mailto va justo detrás. */
    licensePermissionLead:
      "Para cualquier cosa que la cesión CC BY 4.0 y la licencia MIT no cubran, escríbeme directamente:",
    licenseContact: "mail@jmrp.io",
    licensePermissionTail:
      "Sobre lo que devuelven los servidores no hay nada que yo pueda conceder: pregunta a la fuente.",
  },
} as const;
