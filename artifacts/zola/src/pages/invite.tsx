// Copyright (c) 2026 Argilette Lab. SPDX-License-Identifier: MIT
import { useEffect } from "react";
import { useParams, useLocation } from "wouter";
import { Loader2, Users } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";
import { useInvitePreview, useAcceptInvite } from "@/hooks/use-collaboration";

export default function InvitePage() {
  const { token } = useParams<{ token: string }>();
  const [, setLocation] = useLocation();
  const { user, loading: authLoading } = useAuth();
  const preview = useInvitePreview(token);
  const accept = useAcceptInvite();

  // Remember the invite so we can resume after login/signup.
  useEffect(() => {
    if (token && !authLoading && !user) {
      localStorage.setItem("loop_pending_invite", token);
    }
  }, [token, authLoading, user]);

  async function onAccept() {
    if (!token) return;
    try {
      const { project_id } = await accept.mutateAsync(token);
      localStorage.removeItem("loop_pending_invite");
      toast.success("You've joined the project");
      setLocation(`/projects/${project_id}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not accept invite");
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm space-y-4 rounded-xl border border-border bg-card p-8 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Users className="h-6 w-6" />
        </div>

        {preview.isLoading || authLoading ? (
          <div className="flex justify-center py-4 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : preview.isError || !preview.data ? (
          <>
            <h1 className="text-xl font-semibold">Invite not found</h1>
            <p className="text-sm text-muted-foreground">
              This invite link is invalid or has been revoked.
            </p>
            <button
              onClick={() => setLocation("/")}
              className="text-sm text-primary underline"
            >
              Go home
            </button>
          </>
        ) : preview.data.status !== "pending" ? (
          <>
            <h1 className="text-xl font-semibold">Invite expired</h1>
            <p className="text-sm text-muted-foreground">
              This invite is no longer valid. Ask the owner for a new link.
            </p>
          </>
        ) : (
          <>
            <h1 className="text-xl font-semibold">
              Join {preview.data.project_name}
            </h1>
            <p className="text-sm text-muted-foreground">
              You've been invited to collaborate as an editor.
            </p>
            {user ? (
              <button
                onClick={onAccept}
                disabled={accept.isPending}
                className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-opacity disabled:opacity-50"
              >
                {accept.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                Accept invite
              </button>
            ) : (
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground">
                  Sign in or create an account to accept.
                </p>
                <button
                  onClick={() => setLocation("/login")}
                  className="inline-flex w-full items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
                >
                  Sign in
                </button>
                <button
                  onClick={() => setLocation("/signup")}
                  className="inline-flex w-full items-center justify-center rounded-md border border-border px-4 py-2 text-sm"
                >
                  Create account
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </main>
  );
}
