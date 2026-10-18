---
title: Entrar desde el navegador
description: Usa los certificados que guardas en Garabato para entrar en webs desde Firefox o Chromium, sin instalarlos en el navegador.
order: 3
---

Muchas webs piden tu certificado digital para entrar: la Agencia Tributaria, Cl@ve, la matrícula de la universidad y otros servicios públicos. Lo piden durante la conexión TLS, así que normalmente el navegador necesita el certificado instalado. El **token del navegador** de Garabato hace que el navegador use en su lugar los certificados que guardas en Garabato.

El navegador carga un módulo pequeño y lo ve como un dispositivo de seguridad llamado **Garabato**, como un lector de tarjetas. Cuando una web pide tu certificado, el navegador pide la contraseña del dispositivo: escribes el código de tu app de autenticación y Garabato firma. **La clave privada nunca sale de Garabato**, y en el navegador no se instala nada de tu certificado.

## Qué necesitas

- **La verificación en dos pasos activada** en tu perfil (`/me`). Su código de 6 dígitos es la contraseña del dispositivo; consulta [Usuarios e inicio de sesión](../authentication/).
- **La contraseña del certificado recordada** en Garabato. El token solo ofrece certificados vigentes, con clave RSA y con la contraseña recordada.
- **Un equipo que llegue a tu Garabato**, en la misma red o por una VPN. Garabato tiene que estar en marcha cada vez que entras en una web: el navegador le pide cada firma nueva.
- Un sistema y un navegador compatibles:

| Sistema | Navegadores | Notas |
| --- | --- | --- |
| Linux x86_64 o ARM64 | Firefox, Zen, LibreWolf, Floorp, Waterfox, Chromium, Chrome, Brave | Necesita las herramientas de NSS: `nss` en Arch, `libnss3-tools` en Debian y Ubuntu, `nss-tools` en Fedora. Los navegadores de Flatpak y Snap no pueden cargar el módulo. |
| Windows x86_64 | Firefox, Zen, LibreWolf, Floorp, Waterfox | Chrome, Edge y Brave en Windows no son compatibles: usan el almacén de certificados de Windows, no PKCS#11. Windows sobre ARM no es compatible. |

## Conecta un navegador

1. Abre **Certificados** (`/certificates`) y elige **Conectar navegador**. Ponle un nombre que reconozcas, como *Firefox portátil*.
2. El diálogo muestra un comando, para Linux o para Windows (elige el sistema en el que estás; cámbialo si lo vas a ejecutar en otro equipo). El comando lleva un código de un solo uso que vale 10 minutos.
3. Pégalo en una terminal de ese equipo, con tu usuario, sin `sudo` ni permisos de administrador:

```bash
# Linux
curl -fsSL 'https://firma.example.com/api/v1/certificateToken/installScript?code=7KQ4XMPA' | sh
```

```powershell
# Windows (PowerShell)
irm 'https://firma.example.com/api/v1/certificateToken/installScript?code=7KQ4XMPA&os=windows' | iex
```

El script descarga el módulo de tu Garabato y lo comprueba, canjea el código, escribe la configuración (la clave del navegador no se muestra nunca) y registra **Garabato** en todos los perfiles de los navegadores de arriba. Si un navegador está abierto, espera a que lo cierres. Enumera cada navegador y perfil en el que lo registró y deja un desinstalador junto al módulo.

4. El diálogo de Garabato pasa a **Navegador conectado** en cuanto el script termina.

## Entra en una web

Abre la web y elige entrar con certificado. El navegador:

1. pide la contraseña del dispositivo **Garabato**: escribe el código actual de tu app de autenticación;
2. ofrece los certificados del token: elige uno;
3. completa la conexión, con la firma hecha por Garabato.

Durante **15 minutos** después de un código, el navegador firma sin volver a pedirlo. Cuando se cierra esa ventana, el siguiente acceso que necesite una firma pide un código nuevo. Cada firma aparece en **Trazas** (`/traces`) como **Acceso con certificado**, con el certificado y el nombre del navegador que lo usó.

Los navegadores reutilizan una conexión TLS abierta sin volver a firmar, así que una traza significa "una conexión nueva autenticada con el certificado", no "una página visitada".

Si el mismo certificado también está instalado en el navegador, el navegador puede elegir esa copia y Garabato no interviene: no te pide el código y no aparece ninguna traza. Quítalo del navegador para asegurarte de que cada acceso pasa por Garabato.

## Desconecta o desinstala

- **Desconecta** un navegador desde **Navegadores conectados**, en la página de certificados. Su clave deja de funcionar al momento; una conexión que la web ya autenticó puede seguir viva hasta que termine la sesión de la propia web.
- **Desinstala** el módulo del equipo con el script que dejó el instalador:

```bash
sh ~/.local/share/garabato/uninstall.sh
```

```powershell
powershell -ExecutionPolicy Bypass -File "$env:LOCALAPPDATA\Garabato\uninstall.ps1"
```

Ejecutar un comando nuevo en un equipo sustituye la instalación anterior.

## Cómo se protege

- El equipo solo guarda la dirección de Garabato y la clave del navegador (en `~/.config/garabato/token.json`, legible solo por ti, o en `%APPDATA%\Garabato\token.json`). Esa clave puede listar tus certificados, que son información pública, pero **no puede firmar sin tu código**, nunca abre una sesión en Garabato, caduca al año y se puede revocar en cualquier momento.
- Un código desbloquea un navegador durante 15 minutos y vale una sola vez. Tras 5 códigos incorrectos en 15 minutos, el desbloqueo se rechaza durante 15 minutos.
- El certificado y su contraseña siguen cifrados en Garabato, y solo se abren para hacer cada firma.

## Para quien administra la instalación

- La imagen del backend compila el módulo para Linux x86_64 y ARM64 y para Windows x86_64, y lo sirve ella misma, así que un Garabato en una red privada no necesita internet para entregarlo.
- Los comandos de instalación usan `CORS_ORIGIN` como dirección de Garabato, así que esa URL tiene que ser accesible desde los equipos que se conectan.
- Si el certificado HTTPS de Garabato viene de una autoridad privada (la interna de Caddy, la CA de una empresa), instala esa autoridad en el almacén del sistema de cada equipo: `trust anchor` o `update-ca-certificates` en Linux, **Entidades de certificación raíz de confianza** en Windows. Si no, el módulo no puede conectar con Garabato.
- El módulo de Windows no está firmado, así que algún antivirus puede avisar al descargarlo.

## Si algo falla

El módulo escribe su log en `~/.local/state/garabato/pkcs11.log` en Linux y en `%LOCALAPPDATA%\Garabato\pkcs11.log` en Windows. Nunca guarda el código ni la clave.

| Síntoma | Causa probable |
| --- | --- |
| El navegador nunca pide el código | El módulo no está registrado en ese navegador (míralo en *Ajustes → Privacidad y seguridad → Dispositivos de seguridad*), o el navegador usa una copia del certificado instalada en él. |
| El dispositivo Garabato no muestra certificados | No se llega a Garabato (el log muestra el error), su autoridad HTTPS no es de confianza (`UnknownIssuer`), o ningún certificado tiene la contraseña recordada. |
| El comando dice que ha caducado | Ya se ejecutó o pasaron 10 minutos. Genera otro desde el diálogo. |
| La descarga falla con un 404 | Ese Garabato no incluye el módulo para el sistema o la arquitectura del equipo. |
