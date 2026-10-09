export const languages = { en: "English", es: "Español" } as const
export type Lang = keyof typeof languages
export const defaultLang: Lang = "en"

export const INSTALL_COMMAND =
  "curl -fsSL https://raw.githubusercontent.com/Nonetss/garabato/main/scripts/bootstrap.sh | bash"

export type TourStopId =
  | "sign"
  | "versions"
  | "library"
  | "certificates"
  | "signatures"

const en = {
  meta: {
    title: "Garabato: sign PDFs with your own digital certificates",
    description:
      "Sign PDFs with your own PKCS#12 certificates: place the visible signature, sign and download. Certificates and documents are stored encrypted. Self-hosted with Docker Compose.",
  },
  nav: {
    tour: "Tour",
    architecture: "Architecture",
    install: "Install",
    docs: "Docs",
    github: "GitHub",
    skip: "Skip to content",
    theme: "Switch between light and dark theme",
    language: "Language",
    menu: "Menu",
  },
  copy: {
    idle: "Copy",
    done: "Copied",
    label: "Copy the install command",
    code: "Copy the code",
  },
  hero: {
    title: "Sign your PDFs with your own certificate.",
    lede: "Garabato is a self-hosted app for signing PDFs with your PKCS#12 digital certificates. Drop a file, place the visible signature, sign and download. Certificates and documents are stored encrypted, and every signature becomes a new version.",
    installLabel: "Install on a server",
    installHint:
      "Run it in an empty directory. It asks a few questions, generates every secret and starts the stack with Docker Compose.",
    docs: "Read the docs",
    github: "Source on GitHub",
  },
  frame: {
    caption:
      "Screenshots of the running app, with made-up demo data. Click one to enlarge it.",
    open: "Enlarge screenshot",
    viewer: "Screenshot viewer",
    close: "Close",
    previous: "Previous screenshot",
    next: "Next screenshot",
  },
  tour: {
    heading: "What you get",
    stops: {
      sign: {
        title: "Place the signature and sign.",
        body: "Pick a certificate, choose a visible or invisible signature, drag a rectangle on the page and add an optional reason and place. The signature is PAdES (ETSI.CAdES.detached), with the certificate chain embedded so validators can check it.",
        alt: "The viewer in signing mode: a rectangle drawn on the page and the signing panel with the certificate, reason and place",
      },
      versions: {
        title: "Every signature is a new version.",
        body: "Signing never overwrites a document. The viewer shows the visible stamps, the version history, each one downloadable, and who signed with which certificate.",
        alt: "A contract signed twice: two visible stamps on the last page, three versions and two signature records",
      },
      library: {
        title: "A library that stays tidy.",
        body: "PDF thumbnails in nested folders with their own icon, colored tags and pinned documents. Search and filter across the whole library, select several at once and move them by dragging.",
        alt: "The document library: folders with their own icons, PDF thumbnails, pinned documents and colored tags",
      },
      certificates: {
        title: "Your certificates, kept encrypted.",
        body: "Import a PKCS#12 file once and sign with it from then on. The file and its password are sealed with their own key, and the list shows the holder, tax id, issuer and how long each one is still valid.",
        alt: "The certificates page: three certificates with holder, tax id, issuer and validity bar",
      },
      signatures: {
        title: "A log of every signature.",
        body: "Every signature with its document, certificate, version, placement and hashes, filterable by certificate, document name and dates.",
        alt: "The signature log: one row per signature with document, certificate, date, version and placement",
      },
    } satisfies Record<
      TourStopId,
      { title: string; body: string; alt: string }
    >,
    dashboardAlt:
      "The home page: a drop zone for a PDF and the list of certificates the user signs with",
    rest: {
      heading: "And the rest of the app",
      items: [
        {
          term: "Search everywhere",
          text: "⌘K or Ctrl+K jumps to any page, document or folder of the library.",
        },
        {
          term: "Light, dark and mobile",
          text: "Light, dark or system theme, a layout that works on a phone, and an installable PWA.",
        },
        {
          term: "Sign-in your way",
          text: "Email and password, plus any OIDC provider (Keycloak, Authentik, Google…) turned on with three variables.",
        },
        {
          term: "Admin panel",
          text: "Users, sessions, organizations and teams, API keys and an activity log, for the admin role only.",
        },
        {
          term: "A typed API",
          text: "Every procedure is also plain HTTP under /api/v1, documented at /scalar for admins. Call it from scripts with an API key.",
        },
        {
          term: "Your storage",
          text: "Documents go to the bundled MinIO or to any S3-compatible store you already run.",
        },
      ],
    },
  },
  arch: {
    heading: "How it fits together",
    lede: "Three app images plus PostgreSQL and object storage, run with Docker Compose. Browsers only talk to the Caddy gateway, which sends the API to the backend and everything else to the frontend. The backend owns the database and the document store.",
    diagramTitle: "Topology",
    diagramDesc:
      "The browser reaches the Caddy gateway on port 80. The gateway sends /rpc, /api, /scalar and /openapi.json to the Hono backend on port 3000 and every other path to the Astro frontend on port 4321. The backend reads and writes PostgreSQL, stores the encrypted PDFs in MinIO or another S3-compatible store, and can ship its logs to Loki.",
    legendHttp: "Connection, labelled with its protocol or route",
    legendOptional: "Optional: logs shipped only when LOKI_URL is set",
    published: "published",
    pathsLabel: "Request paths",
    pagePath: "Opening a page",
    signPath: "Signing a document",
    nodes: {
      browser: "Browser",
      gateway: "Gateway",
      frontend: "Frontend",
      backend: "Backend",
      postgres: "PostgreSQL",
      storage: "Object storage",
      loki: "Loki",
    },
    roles: {
      frontend: "Astro SSR · React",
      backend: "Hono · oRPC · signing",
      postgres: "users · metadata",
      storage: "encrypted PDFs",
      loki: "activity log",
    },
    routing: {
      heading: "Gateway routing",
      route: "Request",
      target: "Goes to",
      rows: [
        {
          route: "/rpc/*  /api/*  /scalar*  /openapi.json",
          target: "backend:3000",
        },
        { route: "/health", target: "ok" },
        { route: "any other path", target: "frontend:4321" },
      ],
      note: "Only the gateway's port 80 is published, as FRONTEND_PORT (4444 by default). The bundled MinIO's console listens on the host's loopback only, and the rest of the services are reachable only inside the Compose network.",
    },
    principles: [
      {
        term: "Everything sensitive is encrypted at rest.",
        text: "Each certificate and document gets its own random data key, wrapped by the master key in CERTIFICATE_ENCRYPTION_KEY. PKCS#12 files, their passwords and every PDF version are sealed with AES-256-GCM, bound to the record and slot they belong to.",
      },
      {
        term: "Signatures a validator can check.",
        text: "Garabato signs PAdES baseline (ETSI.CAdES.detached) with the signing-certificate-v2 attribute and embeds the issuer chain, so a validator can build the path to the certificate authority.",
      },
      {
        term: "Nothing is overwritten.",
        text: "A signature produces a new version of the document and a record in the signature log. Earlier versions stay downloadable, and another user's documents and certificates answer as not found.",
      },
    ],
    docsLink: "Read the architecture docs",
  },
  install: {
    heading: "Up in one command.",
    lede: "On a Linux host with Docker, curl and openssl, from an empty directory:",
    stepsLabel: "What the script does",
    steps: [
      "Asks for the port, the public URL and the first admin, and whether documents go to the bundled MinIO or to an external S3-compatible store.",
      "Generates every secret with openssl, including the master key that encrypts certificates and documents.",
      "Writes .env and downloads compose.prod.yml into the current directory.",
      "Starts the stack with the images from ghcr.io. The backend migrates the database and creates the admin on startup.",
    ],
    warning:
      "Back up the generated .env, above all CERTIFICATE_ENCRYPTION_KEY, together with the database and the documents. Losing it makes every stored certificate and document unrecoverable.",
    manual: "Prefer to set it up by hand?",
    manualLink: "Deploy with Docker Compose",
  },
  footer: {
    tagline: "Sign PDFs with your own certificates.",
    releases: "Releases",
    issues: "Issues",
  },
  docs: {
    title: "Documentation",
    onThisPage: "On this page",
    pages: "Pages",
    edit: "Edit this page on GitHub",
    previous: "Previous",
    next: "Next",
  },
}

export type Dictionary = typeof en

const es: Dictionary = {
  meta: {
    title: "Garabato: firma PDFs con tus propios certificados digitales",
    description:
      "Firma PDFs con tus propios certificados PKCS#12: coloca la firma visible, firma y descarga. Los certificados y los documentos se guardan cifrados. Autoalojado con Docker Compose.",
  },
  nav: {
    tour: "Recorrido",
    architecture: "Arquitectura",
    install: "Instalar",
    docs: "Documentación",
    github: "GitHub",
    skip: "Saltar al contenido",
    theme: "Cambiar entre tema claro y oscuro",
    language: "Idioma",
    menu: "Menú",
  },
  copy: {
    idle: "Copiar",
    done: "Copiado",
    label: "Copiar el comando de instalación",
    code: "Copiar el código",
  },
  hero: {
    title: "Firma tus PDFs con tu propio certificado.",
    lede: "Garabato es una aplicación autoalojada para firmar PDFs con tus certificados digitales PKCS#12. Suelta un archivo, coloca la firma visible, firma y descarga. Los certificados y los documentos se guardan cifrados, y cada firma crea una versión nueva.",
    installLabel: "Instalar en un servidor",
    installHint:
      "Ejecútalo en un directorio vacío. Hace unas pocas preguntas, genera todos los secretos y arranca el stack con Docker Compose.",
    docs: "Leer la documentación",
    github: "Código en GitHub",
  },
  frame: {
    caption:
      "Capturas de la aplicación en marcha, con datos de demostración inventados. Pulsa una para ampliarla.",
    open: "Ampliar captura",
    viewer: "Visor de capturas",
    close: "Cerrar",
    previous: "Captura anterior",
    next: "Captura siguiente",
  },
  tour: {
    heading: "Qué incluye",
    stops: {
      sign: {
        title: "Coloca la firma y firma.",
        body: "Elige un certificado, decide si la firma es visible o invisible, dibuja un rectángulo en la página y añade, si quieres, un motivo y un lugar. La firma es PAdES (ETSI.CAdES.detached) y lleva incrustada la cadena del certificado para que los validadores puedan comprobarla.",
        alt: "El visor en modo firma: un rectángulo dibujado en la página y el panel de firma con el certificado, el motivo y el lugar",
      },
      versions: {
        title: "Cada firma es una versión nueva.",
        body: "Firmar nunca sobrescribe un documento. El visor muestra los sellos visibles, el historial de versiones, todas descargables, y quién firmó con qué certificado.",
        alt: "Un contrato firmado dos veces: dos sellos visibles en la última página, tres versiones y dos registros de firma",
      },
      library: {
        title: "Una biblioteca que se mantiene ordenada.",
        body: "Miniaturas de los PDFs en carpetas anidadas con su propio icono, etiquetas de colores y documentos fijados. Busca y filtra en toda la biblioteca, selecciona varios a la vez y muévelos arrastrando.",
        alt: "La biblioteca de documentos: carpetas con sus iconos, miniaturas de PDFs, documentos fijados y etiquetas de colores",
      },
      certificates: {
        title: "Tus certificados, guardados cifrados.",
        body: "Importa un archivo PKCS#12 una vez y firma con él desde entonces. El archivo y su contraseña se sellan con su propia clave, y la lista muestra el titular, el NIF, el emisor y cuánto le queda de validez a cada uno.",
        alt: "La página de certificados: tres certificados con titular, NIF, emisor y barra de validez",
      },
      signatures: {
        title: "Un registro de cada firma.",
        body: "Todas las firmas con su documento, certificado, versión, posición y hashes, filtrables por certificado, nombre del documento y fechas.",
        alt: "El registro de firmas: una fila por firma con documento, certificado, fecha, versión y posición",
      },
    },
    dashboardAlt:
      "La página de inicio: una zona para soltar un PDF y la lista de certificados con los que firma el usuario",
    rest: {
      heading: "Y el resto de la aplicación",
      items: [
        {
          term: "Búsqueda en todas partes",
          text: "⌘K o Ctrl+K te lleva a cualquier página, documento o carpeta de la biblioteca.",
        },
        {
          term: "Claro, oscuro y móvil",
          text: "Tema claro, oscuro o del sistema, una interfaz que funciona en el móvil y una PWA instalable.",
        },
        {
          term: "Inicia sesión como prefieras",
          text: "Email y contraseña, y además cualquier proveedor OIDC (Keycloak, Authentik, Google…), que se activa con tres variables.",
        },
        {
          term: "Panel de administración",
          text: "Usuarios, sesiones, organizaciones y equipos, API keys y un registro de actividad, solo para el rol admin.",
        },
        {
          term: "Una API tipada",
          text: "Cada procedimiento es también HTTP normal bajo /api/v1, documentado en /scalar para los administradores. Llámala desde scripts con una API key.",
        },
        {
          term: "Tu almacenamiento",
          text: "Los documentos van al MinIO incluido o a cualquier almacenamiento compatible con S3 que ya tengas.",
        },
      ],
    },
  },
  arch: {
    heading: "Cómo está montado",
    lede: "Tres imágenes de la aplicación más PostgreSQL y un almacenamiento de objetos, levantados con Docker Compose. El navegador solo habla con el gateway Caddy, que manda la API al backend y todo lo demás al frontend. El backend es el dueño de la base de datos y del almacén de documentos.",
    diagramTitle: "Topología",
    diagramDesc:
      "El navegador llega al gateway Caddy por el puerto 80. El gateway manda /rpc, /api, /scalar y /openapi.json al backend Hono en el puerto 3000 y cualquier otra ruta al frontend Astro en el 4321. El backend lee y escribe en PostgreSQL, guarda los PDFs cifrados en MinIO o en otro almacenamiento compatible con S3 y puede enviar sus logs a Loki.",
    legendHttp: "Conexión, con su protocolo o ruta",
    legendOptional:
      "Opcional: los logs solo se envían si LOKI_URL está definida",
    published: "publicado",
    pathsLabel: "Recorrido de las peticiones",
    pagePath: "Abrir una página",
    signPath: "Firmar un documento",
    nodes: {
      browser: "Navegador",
      gateway: "Gateway",
      frontend: "Frontend",
      backend: "Backend",
      postgres: "PostgreSQL",
      storage: "Almacenamiento",
      loki: "Loki",
    },
    roles: {
      frontend: "Astro SSR · React",
      backend: "Hono · oRPC · firma",
      postgres: "usuarios · metadatos",
      storage: "PDFs cifrados",
      loki: "registro de actividad",
    },
    routing: {
      heading: "Enrutado del gateway",
      route: "Petición",
      target: "Va a",
      rows: [
        {
          route: "/rpc/*  /api/*  /scalar*  /openapi.json",
          target: "backend:3000",
        },
        { route: "/health", target: "ok" },
        { route: "cualquier otra ruta", target: "frontend:4321" },
      ],
      note: "Solo se publica el puerto 80 del gateway, como FRONTEND_PORT (4444 por defecto). La consola del MinIO incluido escucha solo en el loopback del host, y el resto de servicios solo son accesibles dentro de la red de Compose.",
    },
    principles: [
      {
        term: "Todo lo sensible se cifra en reposo.",
        text: "Cada certificado y cada documento tiene su propia clave de datos aleatoria, envuelta por la clave maestra de CERTIFICATE_ENCRYPTION_KEY. Los archivos PKCS#12, sus contraseñas y cada versión de un PDF se sellan con AES-256-GCM, ligados al registro y al hueco al que pertenecen.",
      },
      {
        term: "Firmas que un validador puede comprobar.",
        text: "Garabato firma en PAdES baseline (ETSI.CAdES.detached) con el atributo signing-certificate-v2 e incrusta la cadena del emisor, para que un validador pueda llegar hasta la autoridad de certificación.",
      },
      {
        term: "No se sobrescribe nada.",
        text: "Una firma crea una versión nueva del documento y un registro en el historial de firmas. Las versiones anteriores siguen descargables, y los documentos y certificados de otro usuario responden como no encontrados.",
      },
    ],
    docsLink: "Leer la arquitectura en la documentación",
  },
  install: {
    heading: "En marcha con un solo comando.",
    lede: "En un host Linux con Docker, curl y openssl, desde un directorio vacío:",
    stepsLabel: "Qué hace el script",
    steps: [
      "Pregunta el puerto, la URL pública y el primer administrador, y si los documentos van al MinIO incluido o a un almacenamiento externo compatible con S3.",
      "Genera todos los secretos con openssl, incluida la clave maestra que cifra los certificados y los documentos.",
      "Escribe .env y descarga compose.prod.yml en el directorio actual.",
      "Arranca el stack con las imágenes de ghcr.io. El backend migra la base de datos y crea el administrador al arrancar.",
    ],
    warning:
      "Haz copia del .env generado, sobre todo de CERTIFICATE_ENCRYPTION_KEY, junto con la base de datos y los documentos. Si la pierdes, ningún certificado ni documento guardado se podrá recuperar.",
    manual: "¿Prefieres montarlo a mano?",
    manualLink: "Desplegar con Docker Compose",
  },
  footer: {
    tagline: "Firma PDFs con tus propios certificados.",
    releases: "Versiones",
    issues: "Incidencias",
  },
  docs: {
    title: "Documentación",
    onThisPage: "En esta página",
    pages: "Páginas",
    edit: "Editar esta página en GitHub",
    previous: "Anterior",
    next: "Siguiente",
  },
}

export const ui: Record<Lang, Dictionary> = { en, es }

export function t(lang: Lang): Dictionary {
  return ui[lang]
}
