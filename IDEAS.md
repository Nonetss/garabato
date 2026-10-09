# Ideas

Ideas sin decidir ni planificar. Cuando una se vaya a hacer, se abre un change de OpenSpec (`/opsx:propose`) y se quita de aquí.

## Firmas simples guardadas

Guardar mis propias firmas simples (rúbricas) y poder firmar documentos con ellas, igual que con un certificado.

- Crear una firma dibujándola, escribiéndola con una tipografía manuscrita o subiendo una imagen (PNG con fondo transparente).
- Varias por usuario, con nombre y una marcada por defecto, gestionadas como los certificados.
- En el documento, al elegir con qué firmar, aparecen junto a los certificados. Se coloca igual que la firma visible actual.
- Se estampa la imagen en el PDF como actualización incremental, para no invalidar firmas que ya tenga el documento.
- Queda en el registro de firmas como firma simple, diferenciada de las firmas con certificado.
- Nivel legal: firma electrónica simple. No lleva firma criptográfica, salvo que se acompañe de un sello del servidor.
- El lienzo de dibujo se puede reutilizar para la firma simple por enlace (abajo).

## Pedir una firma por enlace

Mandar una URL a otra persona para que firme un documento desde Garabato y que el documento firmado vuelva sin que tenga que crear cuenta.

Base común:

- Solicitud de firma: documento, firmante (email y, opcionalmente, NIF esperado) y caducidad.
- Enlace con token único, de un solo uso y con caducidad.
- Segundo factor (código por email o SMS), porque el enlace por sí solo lo puede usar cualquiera que lo tenga.
- Aviso al que pidió la firma cuando el documento está firmado.

### Firma simple con dibujo

- El firmante dibuja su firma (o la escribe) y acepta.
- Se guarda un registro de evidencias: quién (email, código verificado), qué (hash del documento), cuándo (sello de tiempo) y desde dónde (IP, user agent).
- El dibujo se estampa en el PDF como firma visible.
- Nivel legal: firma electrónica simple (eIDAS). Válida, pero con menos peso probatorio que una firma con certificado.

### Aceptación con certificado del navegador (autenticación TLS)

1. El firmante abre el enlace y el navegador le pide el certificado. El servidor comprueba que es válido, que no está revocado y que el NIF es el esperado.
2. Ve el documento y pulsa "Acepto / Firmo".
3. El servidor guarda la evidencia: quién (datos del certificado), qué (hash del documento), cuándo (sello de tiempo) y desde dónde.
4. El servidor firma el PDF con su propio certificado (sello electrónico de empresa) e incluye esa evidencia.

Notas:

- Nivel legal: firma electrónica simple o, como mucho, avanzada respaldada por la autenticación con certificado. No es una firma hecha con el certificado del usuario: en Adobe se verá la firma de la empresa, no la de la persona.
- El diálogo de certificado lo lanza el gateway (Caddy, `client_auth` con las CA aceptadas: FNMT, DNIe…), que pasa el certificado al backend. Mejor en un subdominio aparte para que no salte en toda la app.
- Hace falta un certificado de sello de empresa para firmar en nombre del servidor.
- Si en el futuro se quiere que el PDF lleve la firma del certificado del propio firmante, eso requiere firma en tres fases: su .p12 abierto en el navegador, AutoFirma o firma en la nube.

## Organizaciones y equipos para compartir certificados

Que los usuarios creen sus propias organizaciones y equipos y compartan certificados con ellos, con permisos sobre quién puede usarlos.

- Hoy las organizaciones y los equipos ya existen (plugin `organization()` de Better Auth con `teams`), pero solo los gestiona el admin desde el panel. Habría que abrir la gestión a los usuarios: crear una organización (queda como `owner`), invitar miembros, crear equipos y asignar gente.
- Compartir un certificado con:
  - Toda una organización: lo pueden usar todos sus miembros.
  - Un equipo concreto de una organización: solo los miembros de ese equipo.
  - Usuarios sueltos, quizá, dentro de una organización.
- El certificado sigue teniendo un dueño (el usuario que lo importó). Compartir no lo mueve, da acceso. El dueño puede dejar de compartirlo cuando quiera, y si lo borra deja de estar disponible para todos.
- Permisos separados por acción, como mínimo:
  - Usar: firmar documentos con él.
  - Ver: ver sus datos (titular, emisor, caducidad), sin poder firmar.
  - Gestionar: cambiar con quién se comparte, renombrarlo, borrarlo.
- Los roles de organización (`owner`, `admin`, `member`) decidirían quién puede compartir en nombre de la organización y quién gestiona equipos. Encajaría como permisos de aplicación en `packages/auth/src/permissions.ts`.
- Contraseña del certificado: si el dueño la recordó, los demás firman sin saberla. Si no, cada uno tendría que conocerla, o compartir exige recordarla. Hay que decidir cuál.
- En el selector de certificados del documento, los compartidos aparecen junto a los propios, indicando de quién son y por qué organización o equipo llegan.
- El registro de firmas guarda quién firmó de verdad (el usuario) además del certificado usado, para saber quién usó un certificado compartido.
- Aviso legal: compartir un certificado de persona física es dejar que otros firmen como esa persona. Tiene sentido sobre todo para certificados de representante o de sello de empresa. Se podría avisar al compartir uno personal, o limitar qué tipos se pueden compartir.
- Más adelante se podría compartir también documentos con el mismo modelo de organización y equipo.
