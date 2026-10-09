---
title: Your first signature
description: Import a certificate, drop a PDF, place the signature and download the signed document.
order: 2
---

This walkthrough takes a fresh installation to its first signed PDF. You need a digital certificate as a PKCS#12 file (`.p12` or `.pfx`) and its password. The interface is in Spanish, so the labels below are quoted as they appear.

## 1. Import a certificate

Open **Certificados** (`/certificates`) and choose **Importar certificado**. Drop the `.p12` or `.pfx` file (at most 100 KiB), type its password and, optionally, give it a name; by default it takes the holder's common name.

The certificate is checked with that password and stored encrypted. The password itself is not kept unless you tick **Recordar contraseña**, in which case it is stored encrypted too and signing no longer asks for it. The list shows each certificate's holder, tax id, issuer and how long it remains valid.

## 2. Drop a PDF

The home page (`/`) is a drop zone: drop a PDF on it (at most 20 MiB, not password-protected) and it opens in the viewer, ready to sign. The file is added to your library as version 1. You can also upload into a folder from **Documentos** (`/documents`).

## 3. Place the signature and sign

In the viewer, pick the certificate you will sign with, then choose the kind of signature:

- **Visible**: drag a rectangle on the page where the stamp should go. Stamp **Esta página** only, or **Todas** the pages at the same position.
- **Invisible**: the signature is embedded in the file with no stamp on the page.

Add an optional **Motivo** (reason) and **Lugar** (place), enter the certificate password if it is not remembered, and sign.

The signature is a PAdES baseline signature (`ETSI.CAdES.detached`, SHA-256) that embeds the issuer chain, so validators can build the certificate path. If the deployment sets a time-stamping authority (`TSA_URL`), it also carries a timestamp that proves when it was signed (B-T), and the history and the traces show it.

## 4. Download and keep track

Every signature creates a **new version** of the document; earlier versions stay available under **Versiones** and each one can be downloaded. The viewer lists who signed with which certificate, and **Trazas** (`/traces`) keeps every signature next to every other action on documents and certificates (imports, uploads, merges, page edits, downloads, renames, moves and deletions), filterable by type, certificate, name and dates.

Sign again with another certificate and the new signature is added on top of the previous ones, in a new version.

## Organize the library

**Documentos** (`/documents`) holds every PDF with its thumbnail. Put them in nested folders (each with its own icon), add colored tags, pin the ones you use often, and search or filter across the whole library. Select several documents to move or tag them at once, or drag them onto a folder.
