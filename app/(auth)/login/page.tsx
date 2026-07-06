// Copyright (c) 2026 Argilette Lab. SPDX-License-Identifier: MIT
"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { Turnstile } from "@/components/auth/turnstile";
import { OAuthButtons } from "@/components/auth/oauth-buttons";

const TURNSTILE_REQUIRED = !!process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (TURNSTILE_REQUIRED && !captchaToken) {
      setError("Please complete the verification challenge.");
      return;
    }
    setLoading(true);
    setError(null);
    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
      options: captchaToken ? { captchaToken } : undefined,
    });
    setLoading(false);
    if (error) {
      setError(error.message);
      setCaptchaToken(null);
      return;
    }
    router.push("/projects");
    router.refresh();
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4">
      <form
        onSubmit={onSubmit}
        className="w-full max-w-sm space-y-4 rounded-xl border border-border bg-card p-8"
      >
        <div>
          <h1 className="text-2xl font-semibold">Welcome back</h1>
          <p className="text-sm text-muted-foreground">Sign in to keep building.</p>
        </div>
        <OAuthButtons />
        <input
          className="w-full rounded-md border border-border bg-input px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
          type="email"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <input
          className="w-full rounded-md border border-border bg-input px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        <Turnstile
          onVerify={setCaptchaToken}
          onExpire={() => setCaptchaToken(null)}
        />
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        <div className="flex items-center justify-between">
          <Link
            href="/forgot-password"
            className="text-xs text-muted-foreground hover:text-foreground"
          >
            Forgot password?
          </Link>
        </div>
        <button
          type="submit"
          disabled={loading || (TURNSTILE_REQUIRED && !captchaToken)}
          className="w-full rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground transition-opacity disabled:opacity-50"
        >
          {loading ? "Signing in…" : "Sign in"}
        </button>
        <p className="text-center text-sm text-muted-foreground">
          No account?{" "}
          <Link className="text-foreground underline" href="/signup">
            Create one
          </Link>
        </p>
      </form>
    </main>
  );
}
