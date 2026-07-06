// Copyright (c) 2026 Argilette Lab. SPDX-License-Identifier: MIT
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import type { Request, Response } from "express";

// The Supabase credentials are stored under NEXT_PUBLIC_* secrets (leftover
// from the original Next.js project). Read VITE_* first, then fall back so the
// server works regardless of which name is configured.
export const SUPABASE_URL =
  process.env.VITE_SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
export const SUPABASE_ANON_KEY =
  process.env.VITE_SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export function createSupabaseServerClient(req: Request, res: Response) {
  // Web clients authenticate via cookies (SSR). Native/mobile clients cannot
  // send Supabase cookies, so they attach `Authorization: Bearer <access_token>`
  // instead. When that header is present we forward it as a global header so
  // both `auth.getUser()` and RLS-protected PostgREST queries use the token.
  // Web is unaffected: with no Authorization header, the cookie flow is used.
  const authHeader = req.headers.authorization;
  return createServerClient(
    SUPABASE_URL!,
    SUPABASE_ANON_KEY!,
    {
      ...(authHeader
        ? { global: { headers: { Authorization: authHeader } } }
        : {}),
      cookies: {
        getAll() {
          // Parse cookies from the request
          const cookieHeader = req.headers.cookie ?? "";
          const cookies: { name: string; value: string }[] = [];
          for (const part of cookieHeader.split(";")) {
            const idx = part.indexOf("=");
            if (idx === -1) continue;
            const name = part.slice(0, idx).trim();
            const value = part.slice(idx + 1).trim();
            cookies.push({ name, value });
          }
          return cookies;
        },
        setAll(toSet: { name: string; value: string; options?: CookieOptions }[]) {
          for (const { name, value, options } of toSet) {
            res.cookie(name, value, options as Record<string, unknown>);
          }
        },
      },
    },
  );
}
