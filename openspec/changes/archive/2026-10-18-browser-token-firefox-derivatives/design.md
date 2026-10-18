## Context

See proposal.md. The scripts are POSIX `sh`, read nothing from the terminal, and must keep paths with spaces whole (Zen names profiles "<random>.Default (release)").

## Decisions

- **A fixed list of roots** (`Firefox|~/.mozilla/firefox`, `Zen|~/.zen`, … in `GECKO_ROOTS`) rather than searching the whole home folder: predictable, fast, and each root carries the browser's name for the message. A new derivative is one line.
- **Folders plus `profiles.ini`**: every `*/` with a `cert9.db` inside a root, plus the absolute `Path=` entries (`IsRelative=0`) of its `profiles.ini`; `sort -u` removes duplicates. Profiles are passed as `<browser>|<path>` lines and read with `IFS='|' read -r`, so spaces survive.
- **Process names** for the wait: `zen`, `zen-bin`, `librewolf`, `floorp`, `waterfox`, `waterfox-bin` added to Firefox's and Chromium's.

## Risks / Trade-offs

- [A derivative not in the list is still missed] → the script lists every browser and profile it registered, so a missing one is visible at once; adding it is one line in both scripts.
