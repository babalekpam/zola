// Copyright (c) 2026 Argilette Lab. SPDX-License-Identifier: MIT
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { UserPlus, Copy, Check, Loader2, X, Link2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  useProjectInvites,
  useProjectMembers,
  useCreateInvite,
  useRevokeInvite,
  useRemoveMember,
} from "@/hooks/use-collaboration";
import type { Project } from "@/lib/types";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  projects: Project[] | undefined;
  currentUserId: string;
}

function inviteLink(token: string): string {
  return `${window.location.origin}${import.meta.env.BASE_URL}invite/${token}`;
}

export function InviteDialog({
  open,
  onOpenChange,
  projects,
  currentUserId,
}: Props) {
  const owned = (projects ?? []).filter((p) => p.owner_id === currentUserId);
  const [projectId, setProjectId] = useState<string>("");

  useEffect(() => {
    if (open && !projectId && owned.length > 0) setProjectId(owned[0].id);
  }, [open, owned, projectId]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5" /> Invite teammates
          </DialogTitle>
          <DialogDescription>
            Generate a link that lets someone collaborate on a project with you.
          </DialogDescription>
        </DialogHeader>

        {owned.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            Create a project first, then you can invite people to it.
          </p>
        ) : (
          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">
                Project
              </label>
              <select
                value={projectId}
                onChange={(e) => setProjectId(e.target.value)}
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
              >
                {owned.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
            {projectId && <InvitePanel key={projectId} projectId={projectId} />}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function InvitePanel({ projectId }: { projectId: string }) {
  const [email, setEmail] = useState("");
  const [copied, setCopied] = useState<string | null>(null);
  const invites = useProjectInvites(projectId);
  const members = useProjectMembers(projectId);
  const createInvite = useCreateInvite(projectId);
  const revokeInvite = useRevokeInvite(projectId);
  const removeMember = useRemoveMember(projectId);

  async function generate(e: React.FormEvent) {
    e.preventDefault();
    try {
      const invite = await createInvite.mutateAsync(email.trim());
      setEmail("");
      await navigator.clipboard.writeText(inviteLink(invite.token));
      toast.success("Invite link created and copied");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not create invite");
    }
  }

  async function copy(token: string) {
    await navigator.clipboard.writeText(inviteLink(token));
    setCopied(token);
    setTimeout(() => setCopied(null), 1500);
  }

  return (
    <div className="space-y-4">
      <form onSubmit={generate} className="flex gap-2">
        <Input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Email (optional)"
          disabled={createInvite.isPending}
        />
        <Button type="submit" disabled={createInvite.isPending}>
          {createInvite.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Link2 className="h-4 w-4" />
          )}
          Create link
        </Button>
      </form>

      <div className="space-y-2">
        <h4 className="text-xs font-medium text-muted-foreground">Members</h4>
        {members.isLoading ? (
          <p className="text-xs text-muted-foreground">Loading…</p>
        ) : (
          <ul className="space-y-1">
            {(members.data ?? []).map((m) => (
              <li
                key={m.user_id}
                className="flex items-center justify-between rounded-md border border-border bg-card px-3 py-2 text-sm"
              >
                <span className="truncate">{m.email ?? m.user_id}</span>
                <span className="flex items-center gap-2">
                  <span className="text-[11px] text-muted-foreground capitalize">
                    {m.role}
                  </span>
                  {!m.owner && (
                    <button
                      type="button"
                      onClick={() => removeMember.mutate(m.user_id)}
                      className="rounded p-0.5 text-muted-foreground hover:text-destructive"
                      aria-label="Remove member"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {(invites.data ?? []).length > 0 && (
        <div className="space-y-2">
          <h4 className="text-xs font-medium text-muted-foreground">
            Pending invites
          </h4>
          <ul className="space-y-1">
            {(invites.data ?? []).map((inv) => (
              <li
                key={inv.id}
                className="flex items-center justify-between rounded-md border border-border bg-card px-3 py-2 text-sm"
              >
                <span className="truncate text-muted-foreground">
                  {inv.email ?? "Anyone with the link"}
                </span>
                <span className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => copy(inv.token)}
                    className="rounded p-1 text-muted-foreground hover:text-foreground"
                    aria-label="Copy invite link"
                  >
                    {copied === inv.token ? (
                      <Check className="h-3.5 w-3.5 text-primary" />
                    ) : (
                      <Copy className="h-3.5 w-3.5" />
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => revokeInvite.mutate(inv.id)}
                    className="rounded p-1 text-muted-foreground hover:text-destructive"
                    aria-label="Revoke invite"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
