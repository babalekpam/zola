// Copyright (c) 2026 Argilette Lab. SPDX-License-Identifier: MIT
import { Router } from "express";
import { createSupabaseServerClient } from "../lib/supabase";
import { getGitHubToken } from "../lib/github";

const router = Router();

const GH = "https://api.github.com";

async function gh<T>(
  token: string,
  method: string,
  path: string,
  body?: unknown,
): Promise<{ status: number; data: T }> {
  const res = await fetch(`${GH}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "User-Agent": "zola-platform",
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = (await res.json().catch(() => ({}))) as T;
  return { status: res.status, data };
}

/**
 * Push the project's current files to GitHub as a single commit — Replit's
 * "export to GitHub". Uses the Git data API (tree → commit → ref) so no git
 * binary is needed. Auth: a PAT supplied per-request, falling back to the
 * platform's GitHub connector token. Tokens are never stored.
 */
router.post("/projects/:id/github/push", async (req, res) => {
  const { id } = req.params;
  const supabase = createSupabaseServerClient(req, res);
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) { res.status(401).json({ error: "Unauthorized" }); return; }

  const { repo, token: bodyToken, message } = req.body as {
    repo?: string;
    token?: string;
    message?: string;
  };
  if (!repo || !/^[\w.-]+\/[\w.-]+$/.test(repo)) {
    res.status(400).json({ error: "repo must look like owner/name" });
    return;
  }
  const token = (bodyToken ?? "").trim() || (await getGitHubToken());
  if (!token) {
    res.status(400).json({
      error:
        "No GitHub token available. Paste a personal access token (repo scope) or connect GitHub.",
    });
    return;
  }

  // RLS gates project access; files fail closed for strangers.
  const { data: project, error: projErr } = await supabase
    .from("projects")
    .select("id, name")
    .eq("id", id)
    .single();
  if (projErr || !project) { res.status(404).json({ error: "Project not found" }); return; }

  const { data: files, error: filesErr } = await supabase
    .from("project_files")
    .select("path, content")
    .eq("project_id", id);
  if (filesErr || !files?.length) {
    res.status(filesErr ? 500 : 400).json({ error: filesErr?.message ?? "Project has no files" });
    return;
  }

  try {
    // 1. Repo lookup; auto-create a private repo when it doesn't exist yet.
    let repoInfo = await gh<{ default_branch?: string; message?: string }>(
      token, "GET", `/repos/${repo}`,
    );
    if (repoInfo.status === 404) {
      const [owner, name] = repo.split("/");
      const created = await gh<{ default_branch?: string; message?: string }>(
        token, "POST", "/user/repos",
        { name, private: true, description: `Exported from Zola` },
      );
      if (created.status >= 300) {
        res.status(400).json({
          error: `Repo ${repo} not found and could not be created under ${owner}: ${created.data.message ?? created.status}`,
        });
        return;
      }
      repoInfo = created;
    } else if (repoInfo.status >= 300) {
      res.status(400).json({
        error: `GitHub: ${repoInfo.data.message ?? `status ${repoInfo.status}`}`,
      });
      return;
    }
    const branch = repoInfo.data.default_branch ?? "main";

    // 2. Current head (absent on a brand-new empty repo).
    const ref = await gh<{ object?: { sha: string } }>(
      token, "GET", `/repos/${repo}/git/ref/${encodeURIComponent(`heads/${branch}`)}`,
    );
    const parentSha = ref.status === 200 ? ref.data.object?.sha ?? null : null;

    // 3. Full-snapshot tree (no base_tree: deletions in Zola delete on GitHub).
    const tree = await gh<{ sha?: string; message?: string }>(
      token, "POST", `/repos/${repo}/git/trees`,
      {
        tree: files.map((f) => ({
          path: f.path,
          mode: "100644",
          type: "blob",
          content: f.content,
        })),
      },
    );
    if (!tree.data.sha) {
      res.status(400).json({ error: `GitHub tree: ${tree.data.message ?? tree.status}` });
      return;
    }

    // 4. Commit + move the branch.
    const commit = await gh<{ sha?: string; message?: string }>(
      token, "POST", `/repos/${repo}/git/commits`,
      {
        message: (message ?? "").trim() || `Update from Zola: ${project.name}`,
        tree: tree.data.sha,
        parents: parentSha ? [parentSha] : [],
      },
    );
    if (!commit.data.sha) {
      res.status(400).json({ error: `GitHub commit: ${commit.data.message ?? commit.status}` });
      return;
    }

    const refUpdate = parentSha
      ? await gh<{ message?: string; object?: unknown }>(
          token, "PATCH", `/repos/${repo}/git/refs/${encodeURIComponent(`heads/${branch}`)}`,
          { sha: commit.data.sha, force: false },
        )
      : await gh<{ message?: string; object?: unknown }>(
          token, "POST", `/repos/${repo}/git/refs`,
          { ref: `refs/heads/${branch}`, sha: commit.data.sha },
        );
    if (refUpdate.status >= 300) {
      res.status(400).json({
        error: `GitHub ref update: ${refUpdate.data.message ?? refUpdate.status}`,
      });
      return;
    }

    await supabase.from("projects").update({ github_repo: repo }).eq("id", id);

    res.json({
      repo,
      branch,
      commit: commit.data.sha,
      url: `https://github.com/${repo}/commit/${commit.data.sha}`,
      fileCount: files.length,
    });
  } catch (err) {
    res.status(502).json({
      error: `GitHub request failed: ${err instanceof Error ? err.message : String(err)}`,
    });
  }
});

export default router;
