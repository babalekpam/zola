// Copyright (c) 2026 Argilette Lab. SPDX-License-Identifier: MIT
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import type { Request, Response } from "express";

export function createSupabaseServerClient(req: Request, res: Response) {
  return createServerClient(
    process.env.VITE_SUPABASE_URL!,
    process.env.VITE_SUPABASE_ANON_KEY!,
    {
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
