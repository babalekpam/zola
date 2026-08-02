// Copyright (c) 2026 Argilette Lab. SPDX-License-Identifier: MIT
import { useEffect, type ReactNode } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import type { User } from "@supabase/supabase-js";

/**
 * Gate for the signed-in dashboard pages.
 *
 * The wait on `loading` matters: the Supabase session is restored from storage
 * asynchronously, so deciding "no user" too early bounces every hard refresh to
 * /login. Redirecting from an effect (rather than during render) keeps the
 * router happy about state updates.
 */
export function RequireAuth({ children }: { children: (user: User) => ReactNode }) {
  const { user, loading } = useAuth();
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (!loading && !user) setLocation("/login");
  }, [loading, user, setLocation]);

  if (loading || !user) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </main>
    );
  }

  return <>{children(user)}</>;
}
