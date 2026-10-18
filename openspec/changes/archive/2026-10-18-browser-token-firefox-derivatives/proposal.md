## Why

The install script only looked for Firefox profiles. A user whose browser is Zen (a Firefox derivative that keeps its profiles in `~/.config/zen`) ran the command, the script registered "Garabato" in the unused Firefox profiles and in Chromium, did not wait for Zen to close, and Zen never loaded the module. The site then authenticated with the certificate installed in Zen, so it looked as if the token worked while Garabato signed nothing and recorded no trace.

## What Changes

- The install and uninstall scripts handle Firefox and the browsers built on it: Zen, LibreWolf, Floorp and Waterfox, in both their `~/.<name>` and `$XDG_CONFIG_HOME/<name>` folders, plus any profile their `profiles.ini` keeps elsewhere.
- The script waits for those browsers to close too, and names each browser and profile it registered (e.g. "Zen, perfil Default (release)").
- Flatpak installs of Zen and LibreWolf are reported as unsupported, like Firefox's.

## Capabilities

### New Capabilities
<!-- none -->

### Modified Capabilities
- `browser-certificate-token`: the install script requirement covers Firefox derivatives.

## Impact

- `native/pkcs11/install/install.sh`, `native/pkcs11/install/uninstall.sh`, `native/pkcs11/tests/install/run.sh`. No API, database or frontend change.
