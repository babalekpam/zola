// Copyright (c) 2026 Argilette Lab. SPDX-License-Identifier: MIT
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

interface Props {
  userId: string;
  email: string;
}

export function AccountForms({ email }: Props) {
  const router = useRouter();
  const [newPassword, setNewPassword] = useState("");
  const [updating, setUpdating] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function updatePassword(e: React.FormEvent) {
    e.preventDefault();
    if (newPassword.length < 6) {
      toast.error("Password must be at least 6 characters.");
      return;
    }
    setUpdating(true);
    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setUpdating(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setNewPassword("");
    toast.success("Password updated.");
  }

  async function signOut() {
    const supabase = createSupabaseBrowserClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  async function deleteAccount() {
    if (
      !confirm(
        "Delete your account permanently? This removes all your projects, files, and chat history. This cannot be undone.",
      )
    ) {
      return;
    }
    setDeleting(true);
    const res = await fetch("/api/account", { method: "DELETE" });
    setDeleting(false);
    if (!res.ok) {
      const json = await res.json().catch(() => ({}));
      toast.error(json.error ?? "Could not delete account.");
      return;
    }
    toast.success("Account deleted.");
    router.push("/");
    router.refresh();
  }

  return (
    <div className="mt-8 space-y-6">
      <section className="rounded-xl border border-border bg-card p-6">
        <h2 className="text-base font-semibold">Email</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {email}{" "}
          <span className="ml-1 text-xs">
            (To change your email, contact{" "}
            <a className="underline" href="mailto:support@argilette.com">
              support@argilette.com
            </a>
            )
          </span>
        </p>
      </section>

      <section className="rounded-xl border border-border bg-card p-6">
        <h2 className="text-base font-semibold">Change password</h2>
        <form onSubmit={updatePassword} className="mt-3 space-y-3">
          <input
            type="password"
            placeholder="New password (min 6 chars)"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            className="w-full rounded-md border border-border bg-input px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
            minLength={6}
            required
          />
          <Button type="submit" disabled={updating}>
            {updating ? "Updating…" : "Update password"}
          </Button>
        </form>
      </section>

      <section className="rounded-xl border border-border bg-card p-6">
        <h2 className="text-base font-semibold">Session</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Sign out of this device.
        </p>
        <Button onClick={() => void signOut()} variant="outline" className="mt-3">
          Sign out
        </Button>
      </section>

      <section className="rounded-xl border border-destructive/40 bg-destructive/5 p-6">
        <h2 className="text-base font-semibold text-destructive">Danger zone</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Permanently delete your account and all associated data.
        </p>
        <Button
          variant="destructive"
          onClick={() => void deleteAccount()}
          disabled={deleting}
          className="mt-3"
        >
          {deleting ? "Deleting…" : "Delete my account"}
        </Button>
      </section>
    </div>
  );
}
