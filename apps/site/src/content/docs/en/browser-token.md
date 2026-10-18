---
title: Sign in from the browser
description: Use the certificates kept in Garabato to sign in to websites from Firefox or Chromium, without installing them in the browser.
order: 3
---

Many sites ask for your digital certificate when you sign in: the tax agency, Cl@ve, university enrolment and other public services. They ask for it during the TLS connection, so the browser normally needs the certificate installed. Garabato's **browser token** lets the browser use the certificates you keep in Garabato instead.

The browser loads a small module and sees it as a security device called **Garabato**, like a smart card reader. When a site asks for your certificate, the browser asks for the device's password: you type the code from your authenticator app, and Garabato signs. **The private key never leaves Garabato**, and nothing of your certificate is installed in the browser.

## What you need

- **Two-step verification turned on** in your profile (`/me`). Its 6-digit code is the device's password; see [Users and sign-in](../authentication/).
- **The certificate's password remembered** in Garabato. The token offers only certificates that are valid, have an RSA key and have their password remembered.
- **A computer that can reach your Garabato**, on the same network or through a VPN. Garabato has to be running whenever you sign in to a site: the browser asks it for every new signature.
- A supported system and browser:

| System | Browsers | Notes |
| --- | --- | --- |
| Linux x86_64 or ARM64 | Firefox, Zen, LibreWolf, Floorp, Waterfox, Chromium, Chrome, Brave | Needs NSS's tools: `nss` on Arch, `libnss3-tools` on Debian and Ubuntu, `nss-tools` on Fedora. Flatpak and Snap browsers cannot load the module. |
| Windows x86_64 | Firefox, Zen, LibreWolf, Floorp, Waterfox | Chrome, Edge and Brave on Windows are not supported: they use the Windows certificate store, not PKCS#11. Windows on ARM is not supported. |

## Connect a browser

1. Open **Certificados** (`/certificates`) and choose **Conectar navegador**. Give it a name you will recognize, such as *Firefox portátil*.
2. The dialog shows one command, for Linux or for Windows (it picks the system you are on; switch it if you will run it on another computer). The command carries a one-time code that is valid for 10 minutes.
3. Paste it in a terminal of that computer, as your user, without `sudo` or administrator rights:

```bash
# Linux
curl -fsSL 'https://sign.example.com/api/v1/certificateToken/installScript?code=7KQ4XMPA' | sh
```

```powershell
# Windows (PowerShell)
irm 'https://sign.example.com/api/v1/certificateToken/installScript?code=7KQ4XMPA&os=windows' | iex
```

The script downloads the module from your Garabato and checks it, redeems the code, writes the configuration (the browser's key is never shown) and registers **Garabato** in every profile of the browsers above. If a browser is open, it waits for you to close it. It lists every browser and profile it registered and leaves an uninstall script next to the module.

4. The dialog in Garabato changes to **Navegador conectado** as soon as the script has run.

## Sign in to a site

Open the site and choose to sign in with a certificate. The browser:

1. asks for the password of the **Garabato** device: type the current code from your authenticator app;
2. offers the certificates of the token: choose one;
3. completes the connection, with the signature made by Garabato.

For **15 minutes** after a code, the browser signs without asking again. Once that window closes, the next sign-in that needs a signature asks for a new code. Each signature appears in **Trazas** (`/traces`) as **Acceso con certificado**, with the certificate and the name of the browser that used it.

Browsers reuse an open TLS connection without signing again, so a trace means "a new connection authenticated with the certificate", not "a page visited".

If the same certificate is also installed in the browser, the browser may pick that copy and Garabato is not involved: no code is asked and no trace appears. Remove it from the browser to be sure every sign-in goes through Garabato.

## Disconnect or uninstall

- **Disconnect** a browser from **Navegadores conectados** on the certificates page. Its key stops working at once; a connection the site already authenticated may last until the site's own session ends.
- **Uninstall** the module from the computer with the script the installer left:

```bash
sh ~/.local/share/garabato/uninstall.sh
```

```powershell
powershell -ExecutionPolicy Bypass -File "$env:LOCALAPPDATA\Garabato\uninstall.ps1"
```

Running a new command on a computer replaces the earlier installation.

## How it is protected

- The computer keeps only Garabato's address and the browser's key (in `~/.config/garabato/token.json`, readable by you alone, or `%APPDATA%\Garabato\token.json`). That key can list your certificates, which are public information, but **cannot sign without your code**, never opens a Garabato session, expires after a year and can be revoked at any time.
- A code unlocks one browser for 15 minutes and works once. After 5 wrong codes within 15 minutes, unlocking is refused for 15 minutes.
- The certificate and its password stay encrypted in Garabato, and are opened only to make each signature.

## For operators

- The backend image builds the module for Linux x86_64 and ARM64 and Windows x86_64 and serves it itself, so a Garabato on a private network needs no internet access to hand it out.
- The install commands use `CORS_ORIGIN` as Garabato's address, so that URL has to be reachable from the computers that connect.
- If Garabato's HTTPS certificate comes from a private authority (Caddy's internal one, a company CA), install that authority in each computer's system store: `trust anchor` or `update-ca-certificates` on Linux, **Trusted Root Certification Authorities** on Windows. Otherwise the module cannot reach Garabato.
- The Windows module is not code-signed, so some antivirus software may warn when it is downloaded.

## Troubleshooting

The module logs to `~/.local/state/garabato/pkcs11.log` on Linux and `%LOCALAPPDATA%\Garabato\pkcs11.log` on Windows. It never writes the code or the key.

| Symptom | Likely cause |
| --- | --- |
| The browser never asks for the code | The module is not registered in that browser (check *Settings → Privacy & Security → Security Devices*), or the browser uses a copy of the certificate installed in it. |
| The Garabato device shows no certificates | Garabato cannot be reached (the log shows the error), its HTTPS authority is not trusted (`UnknownIssuer`), or no certificate has its password remembered. |
| The command says it expired | It was already run or 10 minutes passed. Generate another one from the dialog. |
| The download fails with 404 | That Garabato does not ship the module for the computer's system or architecture. |
