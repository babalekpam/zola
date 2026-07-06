---
name: artifact re-registration after file-level tree swap
description: Restoring artifact directories via git/file copy does NOT re-register them; how to make listArtifacts see them again
---

# Re-registering artifacts after a raw file/tree swap

When you restore or move artifact directories by copying files (e.g. `git archive` a
backup branch into the working tree) instead of using `createArtifact`, the artifacts
are **not** registered: `listArtifacts()` returns `[]`, no per-artifact workflows exist,
and the preview pane shows nothing — even though every `artifacts/*/.replit-artifact/artifact.toml`
is present on disk.

**Fix:** call `runPostMergeSetup()` (from the post_merge_setup skill). Its workflow-
reconciliation step scans `artifacts/*/artifact.toml` and registers each artifact,
allocating preview paths and generating/starting the per-artifact workflows. After it
runs, `listArtifacts()` is populated and the workflows come up.

**Why:** artifact registration state is platform-side, not stored in the committed tree.
The committed `.replit` on a working artifact repl can legitimately have only
`runButton = "Project"` and NO `[[workflows.workflow]]` entries — registration is derived
at runtime from the toml files by reconciliation, not from `.replit`. `createArtifact`
refuses to reuse an existing directory, so it cannot be used to re-adopt restored dirs.

**How to apply:** after any file-level restore/move of artifact dirs, run
`runPostMergeSetup()`, then `listArtifacts()` to confirm, then remove any stale leftover
workflow (e.g. an old `Start application`) with `removeWorkflow`.

## Gotchas seen alongside this
- Background `pnpm install &` gets killed when the bash tool call returns before it
  finishes linking (node_modules ends up missing per-package bins). Run the final
  install in the **foreground**; resolution is cached/warm so linking completes within
  the tool timeout.
- `pnpm install --frozen-lockfile` run by hand in a non-TTY shell can fail with
  `ERR_PNPM_ABORTED_REMOVE_MODULES_DIR_NO_TTY`; set `CI=true`. The platform's own
  `runPostMergeSetup` handles this once node_modules is already consistent — a *first*
  post-merge failure right after a swap is usually just the still-incomplete install,
  not a script bug. Re-check after a clean foreground install before editing the script.
