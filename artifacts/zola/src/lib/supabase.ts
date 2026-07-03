// Copyright (c) 2026 Argilette Lab. SPDX-License-Identifier: MIT
import { createBrowserClient } from "@supabase/ssr";

export function createSupabaseBrowserClient() {
  const url = import.meta.env.VITE_SUPABASE_URL;
  const key = import.meta.env.VITE_SUPABASE_ANON_KEY;
  if (!url || !key) {
    throw new Error("VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are not configured. Set them in Secrets.");
  }
  return createBrowserClient(url, key);
}

export function isSupabaseConfigured(): boolean {
  return !!(import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY);
}
