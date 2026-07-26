// Copyright (c) 2026 Argilette Lab. SPDX-License-Identifier: MIT
import { useState } from "react";
import { Link, useLocation } from "wouter";
import { ArrowLeft, Sparkles } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { apiFetch } from "@/hooks/use-projects";

export default function AccountPage() {
  const { user, loading: authLoading, signOut } = useAuth();
  const [, setLocation] = useLocation();
  const [deleting, setDeleting] = useState(false);

  // Wait for the session to load from storage before deciding the user is
  // signed out, otherwise every hard refresh bounces to /login.
  if (authLoading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </main>
    );
  }
  if (!user) { setLocation("/login"); return null; }

  async function deleteAccount() {
    if (!window.confirm("Delete your account? This cannot be undone. All projects will be removed.")) return;
    setDeleting(true);
    try {
      await apiFetch("/api/account", { method: "DELETE" });
      setLocation("/");
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setDeleting(false);
    }
  }

  return (
    <main className="mx-auto min-h-screen max-w-2xl px-6 py-12">
      <header className="mb-8 flex items-center justify-between">
        <Link href="/projects" className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Projects
        </Link>
        <Link href="/" className="flex items-center gap-2 text-base font-semibold">
          <Sparkles className="h-4 w-4 text-primary" /> Loop
        </Link>
      </header>

      <h1 className="text-2xl font-semibold">Account</h1>

      <div className="mt-6 rounded-xl border border-border bg-card p-6 space-y-4">
        <div>
          <p className="text-sm text-muted-foreground">Email</p>
          <p className="font-medium">{user.email}</p>
        </div>
        <div>
          <p className="text-sm text-muted-foreground">User ID</p>
          <p className="font-mono text-xs text-muted-foreground">{user.id}</p>
        </div>
        <div>
          <p className="text-sm text-muted-foreground">Account created</p>
          <p className="text-sm">{new Date(user.created_at).toLocaleDateString()}</p>
        </div>
      </div>

      <div className="mt-6 flex gap-3">
        <button
          type="button"
          onClick={signOut}
          className="rounded-md border border-border px-4 py-2 text-sm hover:bg-accent"
        >
          Sign out
        </button>
        <button
          type="button"
          onClick={deleteAccount}
          disabled={deleting}
          className="rounded-md border border-destructive/50 bg-destructive/10 px-4 py-2 text-sm text-destructive hover:bg-destructive/20 disabled:opacity-50"
        >
          {deleting ? "Deleting…" : "Delete account"}
        </button>
      </div>
    </main>
  );
}
