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

## Enlaces para recibir y enviar PDF

Intercambiar documentos con gente que no tiene cuenta, mediante una URL.

Base común (la misma que en "Pedir una firma por enlace"):

- Enlace con token único y caducidad. Se puede revocar antes de que caduque.
- Protección opcional con contraseña (guardada como hash) o con un código por email. La contraseña se pasa a la otra persona por otro canal.
- Límite de intentos con la contraseña, para que no se pueda adivinar a fuerza de probar.
- Registro de accesos: cuándo, desde qué IP y con qué user agent se abrió, se subió o se descargó.
- Desde la app se ven los enlaces activos, su estado y su historial.

### Pedir que me suban un PDF

- Creo una solicitud de subida: nombre o motivo, destinatario opcional (email), caducidad, número máximo de archivos y carpeta de destino.
- La otra persona abre el enlace y sube el PDF sin crear cuenta. Se comprueba que es un PDF de verdad y que no pasa del tamaño máximo.
- El documento aparece en mi cuenta como cualquier otro, marcado como recibido por enlace y con quién lo subió.
- Aviso cuando llega. Puede ser de un solo uso (se cierra al subir) o admitir varias subidas hasta que caduque.
- Se puede encadenar con la firma: me suben el PDF, lo firmo y se lo devuelvo por un enlace de envío.

### Mandar un PDF con un enlace

- Elijo un documento y genero un enlace de descarga, con contraseña opcional, caducidad y un número máximo de descargas.
- Lo que se manda es una copia fija del PDF en ese momento (el documento firmado, por ejemplo), aunque luego cambie en la app.
- La otra persona ve el PDF en el navegador o lo descarga. Opcionalmente ve también el resultado de validar las firmas.
- Aviso cuando se descarga por primera vez.
- Opcional: cifrar el propio PDF con la contraseña (cifrado estándar de PDF), para que siga protegido después de descargarlo. Ojo: cifrar un PDF ya firmado invalida sus firmas, así que solo vale para PDF sin firmar o hay que cifrar antes de firmar.

Notas:

- Las páginas públicas (sin sesión) conviene servirlas desde rutas separadas del resto de la app, con su propio límite de peticiones.
- Los archivos subidos por desconocidos se guardan aparte hasta que se validan.

## Verificación por QR y trazabilidad

Que cualquiera que tenga un documento de Garabato (en papel o en PDF) pueda comprobar con el móvil que es auténtico, que no se ha tocado y por qué manos ha pasado.

- Al firmar (o al exportar) se puede estampar un código QR en el PDF, junto a la firma visible o en el pie de página, con un texto corto tipo "Verificable en garabato…/v/<código>".
- El QR lleva a una página pública de verificación con un identificador opaco, no el id interno del documento.
- La página muestra lo mínimo para verificar sin exponer el contenido: nombre del documento (opcional), hash SHA-256 de la versión, fecha, número de firmas y quién firmó con qué certificado (titular, emisor), y el resultado de validar las firmas.
- Comprobar un archivo: la persona sube o arrastra el PDF que tiene y la página dice si coincide byte a byte con la versión registrada, si es una versión anterior o posterior del mismo documento, o si no coincide. Mejor calcular el hash en el navegador, para que el PDF no salga del dispositivo.
- Papel: si solo tiene la copia impresa, ve los datos de la versión y, si el dueño lo permite, puede descargar el original para compararlo.
- Trazabilidad: línea de tiempo de la versión con su origen (subida, unión, edición de páginas, cada firma) y el hash antes y después de cada paso, sacada de las versiones y del registro de firmas que ya existen.
- El dueño decide qué se publica: solo "es auténtico", los datos de las firmas, la línea de tiempo o la descarga. Puede revocar el enlace del QR, y entonces la página dice que ya no está disponible.
- Registro de consultas: cuándo y desde dónde se verificó, visible para el dueño.

Notas:

- El QR tiene que ir dentro de la actualización incremental que hace la firma, o antes de firmar. Añadirlo después a un PDF firmado invalida las firmas (igual que el cifrado).
- Problema del huevo y la gallina: el hash de la versión con el QR no se conoce hasta que el QR está dentro. Por eso el QR apunta a un identificador del documento o de la solicitud, no al hash, y la página busca la versión.
- Las páginas públicas van en rutas separadas, con límite de peticiones, como en "Enlaces para recibir y enviar PDF".
- Encaja con un sello de tiempo (PAdES B-T) y, más adelante, con un sello de empresa del servidor, para que la verificación no dependa solo de que Garabato siga en pie.
