// Copyright (c) 2026 Argilette Lab. SPDX-License-Identifier: MIT
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";

type CookieToSet = { name: string; value: string; options?: CookieOptions };

export async function createSupabaseServerClient() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(toSet: CookieToSet[]) {
          try {
            toSet.forEach(({ name, value, options }: CookieToSet) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // setAll from a Server Component is a no-op; middleware refreshes.
          }
        },
      },
    },
  );
}