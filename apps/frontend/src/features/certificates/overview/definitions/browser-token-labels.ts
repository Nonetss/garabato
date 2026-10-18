export const browserTokenLabels = {
  connect: "Conectar navegador",
  connectTitle: "Conectar un navegador",
  connectDescription:
    "Firefox o Chromium en Linux podrán usar tus certificados para entrar en sedes como la Agencia Tributaria o Cl@ve, sin instalarlos. El navegador te pedirá el código de tu app de verificación en dos pasos.",
  name: "Nombre del navegador",
  namePlaceholder: "Firefox portátil",
  create: "Crear conexión",
  twoFactorTitle: "Activa la verificación en dos pasos",
  twoFactorDescription:
    "El navegador te pedirá el código de tu app de verificación en dos pasos cada vez que use un certificado. Actívala en tu perfil y vuelve aquí.",
  twoFactorAction: "Ir a mi perfil",
  commandTitle: "Ejecuta este comando",
  commandDescription:
    "Pégalo en una terminal del equipo donde usas el navegador, con tu usuario y sin permisos de administrador. Descarga el módulo, lo instala y lo registra en tus navegadores.",
  system: "Sistema operativo",
  linux: "Linux",
  windows: "Windows",
  copyCommand: "Copiar comando",
  code: "Código",
  expiresIn: (remaining: string) => `Caduca en ${remaining}`,
  waiting: "Esperando a que se ejecute el comando…",
  requirements: {
    linux:
      "En una terminal de Linux (x86_64 o ARM64). Necesita las herramientas de NSS: nss en Arch, libnss3-tools en Debian/Ubuntu, nss-tools en Fedora. Funciona con Firefox, Zen, LibreWolf, Floorp, Waterfox y Chromium. Si el navegador está abierto, el script esperará a que lo cierres.",
    windows:
      "En PowerShell, en Windows x86_64. Funciona con Firefox, Zen, LibreWolf, Floorp y Waterfox; Chrome, Edge y Brave en Windows no son compatibles. Si el navegador está abierto, el script esperará a que lo cierres. Algún antivirus puede avisar al descargar el módulo, porque no está firmado.",
  },
  connectedTitle: "Navegador conectado",
  connectedDescription: (name: string) =>
    `«${name}» ya puede usar tus certificados.`,
  usage:
    "Al entrar en una sede con certificado, escribe el código de tu app de verificación en dos pasos cuando el navegador pida la contraseña de «Garabato». Durante 15 minutos no te lo volverá a pedir. Solo se ofrecen los certificados vigentes con la contraseña recordada.",
  expiredTitle: "El comando ha caducado",
  expiredDescription:
    "Han pasado 10 minutos sin ejecutarlo. Genera otro para conectar este navegador.",
  regenerate: "Generar otro comando",
  close: "Hecho",
  section: "Navegadores conectados",
  neverUsed: "Sin usar todavía",
  lastUsed: (relative: string) => `Último uso ${relative}`,
  expires: (date: string) => `Caduca el ${date}`,
  disconnect: "Desconectar",
  disconnectTitle: "Desconectar el navegador",
  disconnectDescription: (name: string) =>
    `«${name}» dejará de poder usar tus certificados. Para volver a conectarlo tendrás que crear una conexión nueva.`,
}
