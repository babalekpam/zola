// Copyright (c) 2026 Argilette Lab. SPDX-License-Identifier: MIT
import { useState } from "react";
import { BookOpen, Pencil, Plus, Trash2 } from "lucide-react";
import {
  listSkills,
  renderSkillFile,
  skillPath,
  slugifySkillName,
} from "@/lib/skills";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

interface Props {
  files: Record<string, string>;
  onWriteFile: (path: string, content: string) => void;
  onDeleteFile: (path: string) => void;
  onOpenFile: (path: string) => void;
}

/**
 * Agent Skills manager: create reusable instruction packs Loop follows
 * automatically when a request matches the skill's purpose. Stored as
 * `.skills/<slug>/SKILL.md` project files, injected server-side into the
 * agent's prompt.
 */
export function SkillsPane({ files, onWriteFile, onDeleteFile, onOpenFile }: Props) {
  const skills = listSkills(files);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [instructions, setInstructions] = useState("");

  function resetForm() {
    setCreating(false);
    setName("");
    setDescription("");
    setInstructions("");
  }

  function createSkill() {
    if (!name.trim() || !instructions.trim()) {
      toast.error("Give the skill a name and instructions");
      return;
    }
    let slug = slugifySkillName(name);
    if (files[skillPath(slug)] !== undefined) {
      let n = 2;
      while (files[skillPath(`${slug}-${n}`)] !== undefined) n += 1;
      slug = `${slug}-${n}`;
    }
    const path = skillPath(slug);
    onWriteFile(path, renderSkillFile(name, description, instructions));
    toast.success(`Skill "${name.trim()}" created`);
    resetForm();
    onOpenFile(path);
  }

  return (
    <div className="h-full overflow-y-auto p-4">
      <div className="mx-auto max-w-2xl">
        <div className="mb-1 flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-sm font-semibold">
            <BookOpen className="h-4 w-4" /> Agent Skills
          </h2>
          {!creating && (
            <Button size="sm" onClick={() => setCreating(true)}>
              <Plus className="mr-1 h-3.5 w-3.5" /> New skill
            </Button>
          )}
        </div>
        <p className="mb-4 text-xs text-muted-foreground">
          Skills are reusable instructions Loop follows automatically when they match your
          request — brand voice, coding conventions, domain knowledge, anything you'd
          otherwise repeat in chat. They're saved in your project under{" "}
          <code className="rounded bg-muted px-1">.skills/</code>.
        </p>

        {creating && (
          <div className="mb-4 space-y-2 rounded-lg border border-border bg-card p-3">
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Skill name — e.g. Brand voice"
              className="h-8 text-xs"
              autoFocus
            />
            <Input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="When should Loop use it? — e.g. Whenever writing user-facing copy"
              className="h-8 text-xs"
            />
            <Textarea
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              placeholder={"Instructions Loop should follow…\ne.g. Write in a warm, plain-spoken tone. Avoid jargon. Always use 'members', never 'users'."}
              rows={6}
              className="text-xs"
            />
            <div className="flex justify-end gap-2">
              <Button size="sm" variant="ghost" onClick={resetForm}>
                Cancel
              </Button>
              <Button size="sm" onClick={createSkill}>
                Create skill
              </Button>
            </div>
          </div>
        )}

        {skills.length === 0 && !creating ? (
          <div className="rounded-lg border border-dashed border-border p-6 text-center text-xs text-muted-foreground">
            No skills yet. Create one to teach Loop something it should always remember for
            this project.
          </div>
        ) : (
          <ul className="space-y-2">
            {skills.map((skill) => (
              <li
                key={skill.path}
                className="rounded-lg border border-border bg-card p-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="truncate text-xs font-medium">{skill.name}</div>
                    {skill.description && (
                      <div className="mt-0.5 line-clamp-2 text-[11px] text-muted-foreground">
                        {skill.description}
                      </div>
                    )}
                    <div className="mt-1 truncate text-[10px] text-muted-foreground/70">
                      {skill.path}
                    </div>
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 w-7 p-0"
                      title="Edit in editor"
                      onClick={() => onOpenFile(skill.path)}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                      title="Delete skill"
                      onClick={() => {
                        onDeleteFile(skill.path);
                        toast.success(`Skill "${skill.name}" deleted`);
                      }}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
