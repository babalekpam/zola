---
name: Protected Replit files & full-tree replacement
description: Which files/dirs cannot be touched directly, and how to swap a whole codebase in-place.
---

# Protected Replit files & full-tree replacement

When replacing an entire working tree in-place (e.g. switching the Repl to a
different codebase from git), these are hard constraints:

- `.replit`, `replit.nix`, `.replitignore` are **tool-managed**. Direct `rm`,
  `write`, or `cp` over them is BLOCKED with "Direct edits ... are not allowed".
  Route changes through the owning skill instead:
  - run command / port mapping / service config → **workflows** skill
    (`configureWorkflow`)
  - language modules / packages → **package-management** skill
  - deployment build/run → **deployment** skill
  When copying in a new tree, EXCLUDE `.replit`/`replit.nix` from the copy.

- `.cache/` (esp. `.cache/replit/modules/replit`) is protected — a blanket
  `find . -maxdepth 1 -exec rm -rf {} +` aborts on it. Always preserve
  `.git`, `.local`, `.agents`, `.cache` (and `attached_assets` to avoid losing
  user uploads).

**Why:** these files back the running environment, the agent/task system, and
crucial module data; deleting them corrupts the Repl irreversibly.

**How to apply — safe in-place swap:**
1. `git archive <commit> -o /tmp/x.tar` (read-only) and extract to a temp dir.
2. Remove only the KNOWN files of the old stack explicitly (not a blanket find),
   never the protected set above.
3. Copy the new tree in, **skipping** `.replit`/`replit.nix`/`.replitignore`.
4. Removing `artifacts/<slug>` dirs auto-deregisters those artifacts and their
   workflows.
5. Install deps; if an interrupted `npm install` corrupts a package
   (ENOTEMPTY on cleanup), `rm -rf node_modules/<pkg>` then reinstall.
6. Wire the app via a webview workflow bound to a supported port (3000 etc.).

**Preview note:** from inside an isolated task-agent env the public
`$REPLIT_DEV_DOMAIN` routes to the MAIN repl, not the task container, so curling
it times out (HTTP 000). Verify locally (`curl localhost:<port>`) instead;
preview wiring finalizes on merge. Next.js dev needs no Vite-style allowedHosts.
