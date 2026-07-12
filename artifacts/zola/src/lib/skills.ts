// Copyright (c) 2026 Argilette Lab. SPDX-License-Identifier: MIT

/**
 * Agent Skills live in the project at `.skills/<slug>/SKILL.md` with a small
 * frontmatter header (name, description). The API server injects them into
 * Loop's prompt; this module is the client-side view of the same convention.
 */

export interface SkillEntry {
  slug: string;
  path: string;
  name: string;
  description: string;
  body: string;
}

const SKILL_PATH_RE = /^\.skills\/([^/]+)\/SKILL\.md$/i;

function parseFrontmatter(raw: string): { meta: Record<string, string>; body: string } {
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
  if (!match) return { meta: {}, body: raw };
  const meta: Record<string, string> = {};
  for (const line of match[1].split(/\r?\n/)) {
    const idx = line.indexOf(":");
    if (idx === -1) continue;
    meta[line.slice(0, idx).trim().toLowerCase()] = line.slice(idx + 1).trim();
  }
  return { meta, body: raw.slice(match[0].length) };
}

export function listSkills(files: Record<string, string>): SkillEntry[] {
  const skills: SkillEntry[] = [];
  for (const [path, content] of Object.entries(files)) {
    const m = path.match(SKILL_PATH_RE);
    if (!m || typeof content !== "string") continue;
    const { meta, body } = parseFrontmatter(content);
    skills.push({
      slug: m[1],
      path,
      name: meta.name || m[1],
      description: meta.description || "",
      body: body.trim(),
    });
  }
  return skills.sort((a, b) => a.name.localeCompare(b.name));
}

export function slugifySkillName(name: string): string {
  return (
    name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 48) || "skill"
  );
}

export function skillPath(slug: string): string {
  return `.skills/${slug}/SKILL.md`;
}

export function renderSkillFile(name: string, description: string, instructions: string): string {
  return `---\nname: ${name.trim()}\ndescription: ${description.trim()}\n---\n\n${instructions.trim()}\n`;
}
