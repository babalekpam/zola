import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

type CookieToSet = { name: string; value: string; options?: CookieOptions };

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  if (
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  ) {
    return response;
  }

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(toSet: CookieToSet[]) {
          toSet.forEach(({ name, value }: CookieToSet) =>
            request.cookies.set(name, value),
          );
          response = NextResponse.next({ request });
          toSet.forEach(({ name, value, options }: CookieToSet) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  const { data } = await supabase.auth.getUser();
  const url = request.nextUrl.clone();
  const isAuthPath =
    url.pathname.startsWith("/login") || url.pathname.startsWith("/signup");
  const isProtected = url.pathname.startsWith("/projects");

  if (!data.user && isProtected) {
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }
  if (data.user && isAuthPath) {
    url.pathname = "/projects";
    return NextResponse.redirect(url);
  }

  return response;
}
