// Copyright (c) 2026 Argilette Lab. SPDX-License-Identifier: MIT
import { useState } from "react";
import { useLocation } from "wouter";
import { toast } from "sonner";
import { Github, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useImportProject } from "@/hooks/use-projects";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

export function ImportDialog({ open, onOpenChange }: Props) {
  const [url, setUrl] = useState("");
  const [, setLocation] = useLocation();
  const importProject = useImportProject();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const repoUrl = url.trim();
    if (!repoUrl) return;
    try {
      const { project, fileCount } = await importProject.mutateAsync(repoUrl);
      toast.success(`Imported ${fileCount} files into "${project.name}"`);
      setUrl("");
      onOpenChange(false);
      setLocation(`/projects/${project.id}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Import failed");
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Github className="h-5 w-5" /> Import from GitHub
          </DialogTitle>
          <DialogDescription>
            Paste a public GitHub repository URL. We'll pull in its files and
            create a new project you can keep building on.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <Input
            autoFocus
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://github.com/owner/repo"
            disabled={importProject.isPending}
          />
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={importProject.isPending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={importProject.isPending || !url.trim()}>
              {importProject.isPending && (
                <Loader2 className="h-4 w-4 animate-spin" />
              )}
              {importProject.isPending ? "Importing…" : "Import repository"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
