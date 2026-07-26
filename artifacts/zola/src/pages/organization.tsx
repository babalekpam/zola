// Copyright (c) 2026 Argilette Lab. SPDX-License-Identifier: MIT
import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { toast } from "sonner";
import {
  ArrowLeft,
  Building2,
  Loader2,
  Link2,
  Copy,
  Check,
  X,
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useActiveOrg } from "@/hooks/use-active-org";
import {
  useOrgMembers,
  useOrgInvites,
  useCreateOrgInvite,
  useRevokeOrgInvite,
  useChangeMemberRole,
  useRemoveOrgMember,
  useRenameOrganization,
} from "@/hooks/use-organizations";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

function inviteLink(token: string): string {
  return `${window.location.origin}${import.meta.env.BASE_URL}join/${token}`;
}

export default function OrganizationPage() {
  const { user, loading: authLoading } = useAuth();
  const [, setLocation] = useLocation();
  const { activeOrg, activeOrgId } = useActiveOrg();

  // Wait for the session to load from storage before deciding the user is
  // signed out, otherwise every hard refresh bounces to /login.
  if (authLoading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </main>
    );
  }
  if (!user) {
    setLocation("/login");
    return null;
  }

  const canManage = activeOrg?.role === "owner" || activeOrg?.role === "admin";

  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-2xl px-6 py-10">
        <button
          type="button"
          onClick={() => setLocation("/projects")}
          className="mb-6 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> Back to projects
        </button>

        <div className="mb-8 flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Building2 className="h-5 w-5" />
          </span>
          <div>
            <h1 className="text-xl font-semibold">{activeOrg?.name ?? "Workspace"}</h1>
            <p className="text-xs text-muted-foreground capitalize">
              You are {activeOrg?.role ?? "a member"}
              {activeOrg?.personal ? " · Personal workspace" : ""}
            </p>
          </div>
        </div>

        {!activeOrgId ? (
          <p className="text-sm text-muted-foreground">No workspace selected.</p>
        ) : (
          <div className="space-y-10">
            {canManage && (
              <RenameSection orgId={activeOrgId} name={activeOrg?.name ?? ""} />
            )}
            {canManage && <InviteSection orgId={activeOrgId} />}
            <MembersSection
              orgId={activeOrgId}
              canManage={!!canManage}
              currentUserId={user.id}
            />
          </div>
        )}
      </div>
    </main>
  );
}

function RenameSection({ orgId, name }: { orgId: string; name: string }) {
  const [value, setValue] = useState(name);
  const rename = useRenameOrganization();

  useEffect(() => setValue(name), [name]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!value.trim() || value.trim() === name) return;
    try {
      await rename.mutateAsync({ id: orgId, name: value.trim() });
      toast.success("Workspace renamed");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not rename");
    }
  }

  return (
    <section className="space-y-3">
      <h2 className="text-sm font-semibold">Workspace name</h2>
      <form onSubmit={submit} className="flex gap-2">
        <Input value={value} onChange={(e) => setValue(e.target.value)} />
        <Button
          type="submit"
          disabled={rename.isPending || !value.trim() || value.trim() === name}
        >
          {rename.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}
        </Button>
      </form>
    </section>
  );
}

function InviteSection({ orgId }: { orgId: string }) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("member");
  const [copied, setCopied] = useState<string | null>(null);
  const invites = useOrgInvites(orgId);
  const createInvite = useCreateOrgInvite(orgId);
  const revokeInvite = useRevokeOrgInvite(orgId);

  async function generate(e: React.FormEvent) {
    e.preventDefault();
    try {
      const invite = await createInvite.mutateAsync({
        email: email.trim() || undefined,
        role,
      });
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
    <section className="space-y-3">
      <h2 className="text-sm font-semibold">Invite teammates</h2>
      <form onSubmit={generate} className="flex flex-wrap gap-2">
        <Input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Email (optional)"
          className="flex-1 min-w-[180px]"
          disabled={createInvite.isPending}
        />
        <select
          value={role}
          onChange={(e) => setRole(e.target.value)}
          className="rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
        >
          <option value="member">Member</option>
          <option value="admin">Admin</option>
        </select>
        <Button type="submit" disabled={createInvite.isPending}>
          {createInvite.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Link2 className="h-4 w-4" />
          )}
          Create link
        </Button>
      </form>

      {(invites.data ?? []).length > 0 && (
        <ul className="space-y-1">
          {(invites.data ?? []).map((inv) => (
            <li
              key={inv.id}
              className="flex items-center justify-between rounded-md border border-border bg-card px-3 py-2 text-sm"
            >
              <span className="truncate text-muted-foreground">
                {inv.email ?? "Anyone with the link"}
                <span className="ml-2 text-[11px] capitalize">· {inv.role}</span>
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
      )}
    </section>
  );
}

function MembersSection({
  orgId,
  canManage,
  currentUserId,
}: {
  orgId: string;
  canManage: boolean;
  currentUserId: string;
}) {
  const members = useOrgMembers(orgId);
  const changeRole = useChangeMemberRole(orgId);
  const removeMember = useRemoveOrgMember(orgId);

  return (
    <section className="space-y-3">
      <h2 className="text-sm font-semibold">Members</h2>
      {members.isLoading ? (
        <p className="text-xs text-muted-foreground">Loading…</p>
      ) : (
        <ul className="space-y-1">
          {(members.data ?? []).map((m) => {
            const isSelf = m.user_id === currentUserId;
            return (
              <li
                key={m.user_id}
                className="flex items-center justify-between rounded-md border border-border bg-card px-3 py-2 text-sm"
              >
                <span className="truncate">
                  {m.email ?? m.user_id}
                  {isSelf && (
                    <span className="ml-2 text-[11px] text-muted-foreground">
                      (you)
                    </span>
                  )}
                </span>
                <span className="flex items-center gap-2">
                  {canManage && !isSelf ? (
                    <select
                      value={m.role}
                      onChange={(e) =>
                        changeRole.mutate({ userId: m.user_id, role: e.target.value })
                      }
                      className="rounded-md border border-border bg-background px-2 py-1 text-xs outline-none focus:ring-2 focus:ring-ring"
                    >
                      <option value="owner">Owner</option>
                      <option value="admin">Admin</option>
                      <option value="member">Member</option>
                    </select>
                  ) : (
                    <span className="text-[11px] text-muted-foreground capitalize">
                      {m.role}
                    </span>
                  )}
                  {canManage && !isSelf && (
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
            );
          })}
        </ul>
      )}
    </section>
  );
}
