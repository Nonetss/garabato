#!/bin/sh
# Connects this computer's Firefox and Chromium to the certificates kept in
# Garabato. Served by Garabato with its address and a one-time code filled
# in; run it as your user:  curl -fsSL '<url>' | sh
#
# It reads nothing from the terminal (its own text arrives on stdin), so it
# never prompts: it waits for running browsers to close instead.
set -eu
umask 077

GARABATO_URL='@@URL@@'
INSTALL_CODE='@@CODE@@'

MODULE_NAME='Garabato'
LIB_DIR="${XDG_DATA_HOME:-$HOME/.local/share}/garabato"
CONFIG_DIR="${XDG_CONFIG_HOME:-$HOME/.config}/garabato"
MODULE_PATH="$LIB_DIR/libgarabato_pkcs11.so"
CHROMIUM_DB="$HOME/.pki/nssdb"
CONFIG_HOME="${XDG_CONFIG_HOME:-$HOME/.config}"
# Firefox and the browsers built on it, which keep NSS databases per profile,
# as "<browser>|<profiles folder>".
GECKO_ROOTS="Firefox|$HOME/.mozilla/firefox
Firefox|$CONFIG_HOME/mozilla/firefox
Zen|$HOME/.zen
Zen|$CONFIG_HOME/zen
LibreWolf|$HOME/.librewolf
LibreWolf|$CONFIG_HOME/librewolf
Floorp|$HOME/.floorp
Floorp|$CONFIG_HOME/floorp
Waterfox|$HOME/.waterfox
Waterfox|$CONFIG_HOME/waterfox"
BROWSER_WAIT_SECONDS=300

say() { printf '%s\n' "$@"; }
fail() {
  printf 'Error: %s\n' "$*" >&2
  exit 1
}

[ "$(id -u)" != 0 ] || fail "ejecútalo con tu usuario, sin sudo."

case "$(uname -m)" in
  x86_64 | amd64) ARCH=x86_64 ;;
  aarch64 | arm64) ARCH=aarch64 ;;
  *) fail "esta arquitectura ($(uname -m)) no está soportada; solo x86_64 y ARM64." ;;
esac

missing=""
for tool in curl sha256sum sed modutil certutil; do
  command -v "$tool" >/dev/null 2>&1 || missing="$missing $tool"
done
if [ -n "$missing" ]; then
  say "Faltan programas:$missing"
  case "$missing" in
    *modutil* | *certutil*)
      say "modutil y certutil son las herramientas de NSS:" \
        "  Arch:          sudo pacman -S nss" \
        "  Debian/Ubuntu: sudo apt install libnss3-tools" \
        "  Fedora:        sudo dnf install nss-tools"
      ;;
  esac
  say "Instálalos y vuelve a ejecutar el mismo comando."
  exit 1
fi

# Every profile with an NSS database, as "<browser>|<profile folder>":
# the folders inside each root plus those profiles.ini keeps elsewhere.
gecko_profiles() {
  printf '%s\n' "$GECKO_ROOTS" | while IFS='|' read -r browser root; do
    [ -d "$root" ] || continue
    for profile in "$root"/*/; do
      [ -f "${profile}cert9.db" ] && printf '%s|%s\n' "$browser" "${profile%/}"
    done
    [ -f "$root/profiles.ini" ] || continue
    sed -n 's/^Path=//p' "$root/profiles.ini" | while IFS= read -r path; do
      case "$path" in
        /*) [ -f "$path/cert9.db" ] && printf '%s|%s\n' "$browser" "$path" ;;
      esac
    done
  done | sort -u
  return 0
}

has_chromium() {
  for name in chromium chromium-browser google-chrome google-chrome-stable chrome; do
    command -v "$name" >/dev/null 2>&1 && return 0
  done
  [ -d "$CHROMIUM_DB" ]
}

browsers_running() {
  for name in firefox firefox-bin firefox-esr zen zen-bin librewolf floorp \
    waterfox waterfox-bin chromium chromium-browse chrome; do
    pgrep -x -u "$(id -u)" "$name" >/dev/null 2>&1 && return 0
  done
  return 1
}

profiles="$(gecko_profiles)"
if [ -z "$profiles" ] && ! has_chromium; then
  fail "no encuentro ningún navegador compatible (Firefox, Zen, LibreWolf, Floorp, Waterfox o Chromium) en tu usuario. Abre el navegador una vez y vuelve a ejecutar el comando."
fi

if browsers_running; then
  say "Cierra tus navegadores (Firefox, Zen, Chromium…) para continuar; espero a que se cierren…"
  waited=0
  while browsers_running; do
    [ "$waited" -lt "$BROWSER_WAIT_SECONDS" ] || fail "los navegadores siguen abiertos. Ciérralos y vuelve a ejecutar el comando."
    sleep 2
    waited=$((waited + 2))
  done
fi

mkdir -p "$LIB_DIR" "$CONFIG_DIR"
download="$(mktemp "$LIB_DIR/.module.XXXXXX")"
trap 'rm -f "$download"' EXIT

say "Descargando el módulo ($ARCH)…"
curl -fsSL "$GARABATO_URL/api/v1/certificateToken/module?arch=$ARCH" -o "$download" \
  || fail "no se pudo descargar el módulo para $ARCH desde $GARABATO_URL."

# Only now, with the module in hand, is the one-time code spent.
response="$(curl -fsS -X POST -H 'content-type: application/json' \
  --data "{\"code\":\"$INSTALL_CODE\",\"arch\":\"$ARCH\"}" \
  "$GARABATO_URL/api/v1/certificateToken/redeem")" \
  || fail "el comando ha caducado o ya se usó. Genera otro en Garabato → Certificados → Conectar navegador."
key="$(printf '%s' "$response" | sed -n 's/.*"key":"\([^"]*\)".*/\1/p')"
expected="$(printf '%s' "$response" | sed -n 's/.*"moduleSha256":"\([0-9a-f]*\)".*/\1/p')"
[ -n "$key" ] && [ -n "$expected" ] || fail "Garabato ha dado una respuesta inesperada."

actual="$(sha256sum "$download" | cut -d ' ' -f 1)"
[ "$actual" = "$expected" ] \
  || fail "el módulo descargado no coincide con el de Garabato. Desconecta este navegador en Garabato y vuelve a intentarlo."
chmod 700 "$download"
mv -f "$download" "$MODULE_PATH"
trap - EXIT

printf '{\n  "url": "%s",\n  "key": "%s"\n}\n' "$GARABATO_URL" "$key" >"$CONFIG_DIR/token.json"
chmod 600 "$CONFIG_DIR/token.json"

register() {
  modutil -dbdir "sql:$1" -delete "$MODULE_NAME" -force >/dev/null 2>&1 || true
  modutil -dbdir "sql:$1" -add "$MODULE_NAME" -libfile "$MODULE_PATH" -force >/dev/null 2>&1
}

say "Registrando «$MODULE_NAME» en tus navegadores…"
registered=0
# A here-document keeps the loop in this shell (a pipe would lose the count)
# and paths with spaces whole.
# Profile folders are "<random>.<name>"; the name is what the user knows.
while IFS='|' read -r browser profile; do
  [ -n "$profile" ] || continue
  label="$browser, perfil $(basename "$profile" | sed 's/^[^.]*\.//')"
  if register "$profile"; then
    say "  ✓ $label"
    registered=$((registered + 1))
  else
    say "  ✗ $label: no se pudo registrar"
  fi
done <<PROFILES
$profiles
PROFILES
if has_chromium; then
  if [ ! -f "$CHROMIUM_DB/cert9.db" ]; then
    mkdir -p "$CHROMIUM_DB"
    certutil -N -d "sql:$CHROMIUM_DB" --empty-password
  fi
  if register "$CHROMIUM_DB"; then
    say "  ✓ Chromium y Chrome"
    registered=$((registered + 1))
  else
    say "  ✗ Chromium y Chrome: no se pudo registrar"
  fi
fi

for sandboxed in "$HOME/.var/app/org.mozilla.firefox" "$HOME/snap/firefox" \
  "$HOME/.var/app/app.zen_browser.zen" "$HOME/.var/app/io.gitlab.librewolf-community" \
  "$HOME/.var/app/org.chromium.Chromium" "$HOME/snap/chromium"; do
  [ -d "$sandboxed" ] && say "  ! $(basename "$sandboxed") (Flatpak o Snap) no puede usar el módulo; usa el navegador de tu distribución."
done

cat >"$LIB_DIR/uninstall.sh" <<'UNINSTALL'
@@UNINSTALL@@
UNINSTALL
chmod 700 "$LIB_DIR/uninstall.sh"

[ "$registered" -gt 0 ] || fail "no se pudo registrar el módulo en ningún navegador."

say "" \
  "Listo. Abre el navegador y entra en la sede con certificado." \
  "Cuando pida la contraseña de «$MODULE_NAME», escribe el código de tu app de verificación en dos pasos." \
  "Para desinstalarlo: sh $LIB_DIR/uninstall.sh"
