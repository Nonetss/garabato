---
description: Commit all uncommitted changes following the project's commit standard
---

Commit all outstanding changes in the repository, following the exact conventions already established in this project's git history.

**Hard rule — commit only, never revert:** Your only job is to stage and commit. NEVER undo, discard, restore, checkout, reset, revert, stash-drop, or otherwise roll back any change — not working-tree edits, not staged files, not hook auto-fixes, not formatting that appeared while committing. If something unexpected shows up mid-commit (hook rewrite, conflict, leftover dirty files), leave it untouched, report it, and stop. Do not "clean up" by reverting. You may only add and commit.

**Hard rule — no AI attribution, ever:** Never credit an AI tool or agent in git history. No `Co-Authored-By:` trailer naming Claude, Anthropic, OpenAI, ChatGPT, Codex, Cursor, GitHub Copilot, Gemini, OpenCode or any other AI tool, model or agent. No "Generated with …", "Created by …", "Assisted by …" or similar footer, emoji badge or link — not in the subject, body, trailers, PR title or PR description. Commits are authored by the user alone.

**Hard rule — no macro commits:** Do not dump unrelated changes into a single commit. Split the working tree into several logical commits grouped by concern (feature area, package, fix vs refactor vs chore, etc.). One commit per coherent unit of work. If the diff spans unrelated areas, you must split — never "chore: misc updates" or similar catch-alls.

**Migrations — commit yes, generate no:** AGENTS.md forbids generating, running, pushing or *editing* migrations — that stays the user's job. But **staging and committing migrations that already exist in the working tree is allowed and expected.** Do not stop to ask whether a migration was intentional. If `packages/db/src/migrations/<timestamp>_<name>/` (or related schema changes in `packages/db/src/schema/`) are present, include them in the appropriate logical commit — usually together with the schema/code they belong to. Never run `db:generate`, `db:push` or `db:migrate`; just commit what's already there.

Steps:

1. Run `git status` and `git diff` (staged and unstaged) to see everything that needs to be committed. Never use destructive flags like `-uall`.
2. Run `git log --pretty=format:"%s" -20` to confirm the current message style before writing anything.
3. **Group the changes into logical commits** — this is mandatory when changes touch unrelated concerns. Examples of good splits: `apps/frontend` vs `packages/api` vs `compose.yml`; a feature vs its tests vs docker/CI wiring; schema change vs application code. A single commit is fine only when every file belongs to the same logical change. Do not mix unrelated features/fixes into one commit.
4. Stage files explicitly by name (never `git add -A` or `git add .`) and skip anything that looks like a secret or credential file, warning me if you find one.
5. Write each commit message in Conventional Commits style, matching this repo's exact pattern: `type(scope): short imperative summary`, e.g. `feat(frontend): add 404 page`, `fix(api): use proper HTTP methods on destructive oRPC routes`, `refactor(api): reorganize features by domain instead of technical layers`, `chore(deps): update Astro and Astro.js dependencies`.
   - Common types used here: `feat`, `fix`, `refactor`, `chore`, `docs`.
   - Scope is the affected area/package (e.g. `api`, `frontend`, `auth`, `docker`, `openspec`, `deps`, `config`), and multiple comma-separated scopes are used when a change spans areas (e.g. `chore(frontend,docs,openspec): ...`).
   - Summary is lowercase, imperative mood, no trailing period.
   - Focus the message on *why* the change was made, not a restatement of the diff.
   - Do not add a `Co-Authored-By` line or any other footer unless I explicitly ask for it.
6. Never amend existing commits, never force anything, and never skip hooks. Never run destructive or undo commands (`git reset`, `git checkout --`, `git restore`, `git revert`, `git clean`, `git stash drop`, etc.) for any reason during this flow — even if a hook failed or rewrote files.
7. After committing, run `git status` to confirm the working tree is clean (or report what's left if something couldn't be committed) and show me the commit(s) created. If anything remains dirty, report it; do not try to undo it.
