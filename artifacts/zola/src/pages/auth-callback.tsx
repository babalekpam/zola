// Copyright (c) 2026 Argilette Lab. SPDX-License-Identifier: MIT
import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { createSupabaseBrowserClient } from "@/lib/supabase";

export default function AuthCallbackPage() {
  const [, setLocation] = useLocation();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");
    const errorParam = params.get("error_description") ?? params.get("error");

    if (errorParam) {
      setError(errorParam);
      return;
    }

    if (code) {
      supabase.auth.exchangeCodeForSession(code).then(({ data, error }) => {
        if (error) {
          setError(error.message);
        } else if (data.session) {
          setLocation("/projects");
        } else {
          setLocation("/login");
        }
      });
    } else {
      supabase.auth.getSession().then(({ data }) => {
        if (data.session) {
          setLocation("/projects");
        } else {
          setLocation("/login");
        }
      });
    }
  }, [setLocation]);

  if (error) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center bg-background px-4 text-center">
        <p className="text-destructive font-medium mb-2">Sign-in failed</p>
        <p className="text-sm text-muted-foreground mb-6 max-w-sm">{error}</p>
        <a href="/login" className="text-sm underline text-foreground">Back to sign in</a>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-background">
      <p className="text-muted-foreground animate-pulse">Completing sign-in…</p>
    </main>
  );
}
