"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export default function SignupPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase.auth.signUp({ email, password });
    setLoading(false);
    if (error) {
      setError(error.message);
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
          <h1 className="text-2xl font-semibold">Create an account</h1>
          <p className="text-sm text-muted-foreground">Start vibe-coding in seconds.</p>
        </div>
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
          placeholder="Password (min 6 chars)"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={6}
        />
        {error ? (
          <p className="text-sm text-destructive">{error}</p>
        ) : null}
        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground transition-opacity disabled:opacity-50"
        >
          {loading ? "Creating…" : "Create account"}
        </button>
        <p className="text-center text-sm text-muted-foreground">
          Already have an account?{" "}
          <Link className="text-foreground underline" href="/login">
            Sign in
          </Link>
        </p>
      </form>
    </main>
  );
}
