#!/bin/sh
# Removes Garabato's browser token from this computer: the "Garabato"
# security device from every Firefox profile and from Chromium's NSS
# database, the module and its configuration. The browser's key stays valid
# until it is disconnected in Garabato → Certificados.
set -eu

MODULE_NAME='Garabato'
LIB_DIR="${XDG_DATA_HOME:-$HOME/.local/share}/garabato"
CONFIG_DIR="${XDG_CONFIG_HOME:-$HOME/.config}/garabato"

unregister() {
  modutil -dbdir "sql:$1" -delete "$MODULE_NAME" -force >/dev/null 2>&1 || true
}

if command -v modutil >/dev/null 2>&1; then
  for root in "$HOME/.mozilla/firefox" "${XDG_CONFIG_HOME:-$HOME/.config}/mozilla/firefox"; do
    [ -d "$root" ] || continue
    for profile in "$root"/*/; do
      [ -f "${profile}cert9.db" ] && unregister "${profile%/}"
    done
  done
  [ -f "$HOME/.pki/nssdb/cert9.db" ] && unregister "$HOME/.pki/nssdb"
fi

rm -f "$LIB_DIR/libgarabato_pkcs11.so" "$CONFIG_DIR/token.json" "$LIB_DIR/uninstall.sh"
rmdir "$LIB_DIR" "$CONFIG_DIR" 2>/dev/null || true

printf '%s\n' "Garabato se ha quitado de tus navegadores." \
  "Para invalidar también su clave, desconecta este navegador en Garabato → Certificados."
