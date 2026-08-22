/**
 * Policies page strings: the "Privacy & data" section and the visible
 * freshness line that sits right after it.
 */
export const policies = {
  en: {
    privacyEyebrow: "Privacy & data",
    privacyBody: [
      "This service is run by José Manuel Requena Plens (jmrp.io), who is also the author of both servers. The site sets no cookies and runs no analytics scripts: the Content-Security-Policy forbids talking to any third party, and the browser enforces it.",
      "The web server keeps standard access logs — IP address, user agent, request path — for abuse prevention, rotated out after at most a year. Usage metrics record only the JSON-RPC method and tool name, never the arguments: what you search for is not part of any metric.",
      "Credentials you send travel as headers to the server you chose, are used for that request and are not persisted. Details, in the notice on each server's card.",
    ],
    // Visible freshness inside <main>: the footer carries the same date, but
    // readability prunes it and extractors saw the page as undated.
    updatedIn: "This page was last updated on",
  },
  es: {
    privacyEyebrow: "Privacidad y datos",
    privacyBody: [
      "Este servicio lo opera José Manuel Requena Plens (jmrp.io), autor también de los dos servidores. El sitio no usa cookies ni scripts de analítica: la Content-Security-Policy prohíbe hablar con terceros, y la aplica el navegador.",
      "El servidor web guarda logs de acceso estándar — dirección IP, user agent, ruta — para prevenir abusos, rotados como mucho al año. Las métricas de uso registran solo el método JSON-RPC y el nombre de la herramienta, nunca los argumentos: lo que buscas no forma parte de ninguna métrica.",
      "Las credenciales que envías viajan como cabeceras al servidor que elijas, se usan para esa petición y no se persisten. El detalle, en el aviso de la ficha de cada servidor.",
    ],
    updatedIn: "Esta página se actualizó por última vez el",
  },
} as const;
