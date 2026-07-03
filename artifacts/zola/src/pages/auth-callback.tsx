// Copyright (c) 2026 Argilette Lab. SPDX-License-Identifier: MIT
import { useEffect } from "react";
import { useLocation } from "wouter";
import { createSupabaseBrowserClient } from "@/lib/supabase";

export default function AuthCallbackPage() {
  const [, setLocation] = useLocation();

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) {
        setLocation("/projects");
      } else {
        setLocation("/login");
      }
    });
  }, [setLocation]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-background">
      <p className="text-muted-foreground animate-pulse">Completing sign-in…</p>
    </main>
  );
}
