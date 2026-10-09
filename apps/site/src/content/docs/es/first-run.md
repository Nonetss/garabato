---
title: Tu primera firma
description: Importa un certificado, suelta un PDF, coloca la firma y descarga el documento firmado.
order: 2
---

Este recorrido lleva una instalación recién hecha hasta su primer PDF firmado. Necesitas un certificado digital en un fichero PKCS#12 (`.p12` o `.pfx`) y su contraseña.

## 1. Importa un certificado

Abre **Certificados** (`/certificates`) y elige **Importar certificado**. Suelta el fichero `.p12` o `.pfx` (como mucho 100 KiB), escribe su contraseña y, si quieres, ponle un nombre; por defecto toma el nombre común del titular.

El certificado se comprueba con esa contraseña y se guarda cifrado. La contraseña no se conserva salvo que marques **Recordar contraseña**: entonces también se guarda cifrada y al firmar ya no te la pide. La lista muestra de cada certificado el titular, el NIF, el emisor y cuánto le queda de validez.

## 2. Suelta un PDF

El inicio (`/`) es una zona para soltar archivos: suelta un PDF (como mucho 20 MiB y sin contraseña) y se abre en el visor, listo para firmar. El archivo entra en tu biblioteca como versión 1. También puedes subirlo a una carpeta desde **Documentos** (`/documents`).

## 3. Coloca la firma y firma

En el visor, elige el certificado con el que vas a firmar y el tipo de firma:

- **Visible**: arrastra sobre la página un rectángulo donde irá el sello. Sella solo **Esta página** o **Todas** las páginas en la misma posición.
- **Invisible**: la firma va dentro del archivo, sin sello en la página.

Añade si quieres un **Motivo** y un **Lugar**, escribe la contraseña del certificado si no está recordada y firma.

La firma es PAdES básica (`ETSI.CAdES.detached`, SHA-256) e incluye la cadena del emisor, para que los validadores puedan construir la ruta de certificación. Si el despliegue define una autoridad de sellado de tiempo (`TSA_URL`), lleva además un sello que demuestra cuándo se firmó (B-T), y el historial y el registro de firmas lo muestran.

## 4. Descarga y sigue el rastro

Cada firma crea una **nueva versión** del documento; las anteriores siguen disponibles en **Versiones** y todas se pueden descargar. El visor indica quién firmó y con qué certificado, y **Firmas** (`/signatures`) guarda el registro de todas las firmas, filtrable por certificado, nombre del documento y fechas.

Si vuelves a firmar con otro certificado, la nueva firma se añade sobre las anteriores, en otra versión.

## Organiza la biblioteca

**Documentos** reúne todos los PDF con su miniatura. Ordénalos en carpetas anidadas (cada una con su icono), ponles etiquetas de color, fija los que usas a menudo y busca o filtra en toda la biblioteca. Selecciona varios documentos para moverlos o etiquetarlos a la vez, o arrástralos a una carpeta.
