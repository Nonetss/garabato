---
description: Implement the requested feature in an isolated git worktree on its own branch
argument-hint: <feature description>
---

Implement the feature described below in an isolated git worktree, so the main checkout (where the user may have dev servers running and uncommitted work) is never touched.

**Feature request:** $ARGUMENTS

If the feature request is empty, ask the user what to build before doing anything else.

**Hard rule — the main checkout is read-only:** Every edit, install and command for this task runs inside the worktree. Never modify, stage, stash, checkout or reset anything in the main checkout. All the rules in `AGENTS.md` still apply inside the worktree (load the `stack` skill, search before creating, no migrations, no killing processes, no runtime probing, no AI attribution).

Steps:

1. **Name it.** Derive a short kebab-case slug from the request (e.g. `collection-sharing`, max ~40 chars) and a branch name `<type>/<slug>` using the Conventional Commits type that fits (`feat`, `fix`, `refactor`, `chore`, `docs`). Announce both.

2. **Pre-checks in the main checkout (read-only).**
   - `git rev-parse --show-toplevel` → the repo root; `git branch --show-current` → the base branch.
   - `git status --short`: if there are uncommitted changes, warn the user that they will **not** be in the worktree (it branches from the last commit) and ask whether to continue.
   - `git worktree list` and `git branch --list "<branch>"`: if the branch or `.claude/worktrees/<slug>` already exists, ask whether to reuse it (enter it) or pick a new slug. Never delete or overwrite an existing worktree or branch.

3. **Create the worktree** from the current local `HEAD`:
   ```bash
   git worktree add .claude/worktrees/<slug> -b <branch> HEAD
   ```
   `.claude/worktrees/` is already gitignored. Then switch the session into it with the `EnterWorktree` tool (`path: ".claude/worktrees/<slug>"`). If that tool is unavailable, keep using absolute paths under the worktree for every file operation and command.

4. **Bootstrap the worktree.**
   - Copy the main checkout's root `.env` (the repo's only env file), if it exists, to the worktree root. Copy only; never edit the original and never commit the copy.
   - Run `bun install` in the worktree root.
   - Do not start dev servers or Docker from the worktree — the ports are already taken by the user's running stack.

5. **Implement the feature** inside the worktree following `AGENTS.md` and the `stack` skill. If the request is large or ambiguous, ask before starting, as usual. If it would need a migration, stop and tell the user.

6. **Validate** from the worktree root: `bun run check-types`, `bunx biome check` on the touched files and `bun run test` if `packages/api` changed. Fix what fails.

7. **Do not commit** unless the user asked for it in this request; if they did, follow `/commit`'s rules inside the worktree. Never merge, push, remove the worktree or delete the branch on your own.

8. **Report** to the user:
   - Worktree path and branch.
   - What changed and the validation results.
   - Next steps they can run themselves:
     ```bash
     git -C .claude/worktrees/<slug> diff          # review
     git merge <branch>                            # from the main checkout, once committed
     git worktree remove .claude/worktrees/<slug>  # cleanup
     git branch -d <branch>
     ```
   - Remind them the session is still inside the worktree; they can ask you to leave it (`ExitWorktree` with `keep`) or continue iterating there.
