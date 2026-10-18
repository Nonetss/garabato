## 1. Scripts

- [x] 1.1 Scan Firefox, Zen, LibreWolf, Floorp and Waterfox roots and their `profiles.ini` in `install.sh` and `uninstall.sh`, wait for those browsers, name browser and profile in the output; verify `sh -n`
- [x] 1.2 Extend `tests/install/run.sh` with a Zen profile whose name has spaces and a profile `profiles.ini` keeps elsewhere; verify all checks pass, including uninstall

## 2. Wrap-up

- [x] 2.1 Ask the user to run a new command with Zen closed, then sign in to a site with the certificate removed from Zen, and check that `/traces` shows "Acceso con certificado" — 2026-10-18: the user confirms it works with Firefox-based browsers (Zen) and Chromium-based ones (Brave): the TOTP is asked and Garabato signs
- [x] 2.2 Run `openspec validate browser-token-firefox-derivatives --strict`; verify it passes
