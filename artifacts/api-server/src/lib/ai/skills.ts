// Copyright (c) 2026 Argilette Lab. SPDX-License-Identifier: MIT

/**
 * Agent Skills: user-authored instruction packs stored in the project at
 * `.skills/<name>/SKILL.md`. Each file starts with a small frontmatter block:
 *
 *   ---
 *   name: Brand voice
 *   description: How to write copy for this product
 *   ---
 *   <instructions the agent should follow>
 *
 * The chat route injects every skill into the model's context so the agent
 * applies them when relevant — the Loop equivalent of Replit's agent skills.
 */

export interface AgentSkill {
  path: string;
  name: string;
  description: string;
  body: string;
}

const SKILL_PATH_RE = /^\.skills\/([^/]+)\/SKILL\.md$/i;
const MAX_SKILLS = 12;
const MAX_SKILL_CHARS = 6_000;

export function isSkillFile(path: string): boolean {
  return SKILL_PATH_RE.test(path);
}

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

export function extractSkills(files: Record<string, string>): AgentSkill[] {
  const skills: AgentSkill[] = [];
  for (const [path, content] of Object.entries(files)) {
    const m = path.match(SKILL_PATH_RE);
    if (!m || typeof content !== "string") continue;
    const { meta, body } = parseFrontmatter(content);
    skills.push({
      path,
      name: meta.name || m[1],
      description: meta.description || "",
      body: body.trim().slice(0, MAX_SKILL_CHARS),
    });
    if (skills.length >= MAX_SKILLS) break;
  }
  return skills;
}

const MAX_SECTION_CHARS = 40_000;

/** Prompt section listing every skill; empty string when the project has none. */
export function buildSkillsSection(files: Record<string, string>): string {
  const skills = extractSkills(files);
  if (skills.length === 0) return "";
  const rendered = skills
    .map(
      (s) =>
        `### Skill: ${s.name} (file: ${s.path})\n` +
        (s.description ? `When to use: ${s.description}\n` : "") +
        `${s.body}`,
    )
    .join("\n\n");
  const section =
    `\n\nAgent Skills — the user has defined these reusable instruction packs for this project. ` +
    `When a request matches a skill's purpose, follow its instructions. ` +
    `If skills conflict with the user's current request, the request wins. ` +
    `To change a skill, edit its existing file path shown above — do not create a new one.\n\n${rendered}`;
  return section.length > MAX_SECTION_CHARS ? section.slice(0, MAX_SECTION_CHARS) : section;
}
