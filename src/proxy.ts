import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * First line of defence for /admin: refreshes the Supabase session cookie and sends
 * visitors without a valid session to the login page. This is NOT the only check —
 * every admin page, server action and API route re-verifies the session and the
 * admin role on the server.
 */
export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  const isLogin = pathname === "/admin/login";
  let response = NextResponse.next({ request });
  response.headers.set("X-Robots-Tag", "noindex, nofollow");

  // Not configured: the admin pages render their own setup instructions.
  if (!url || !anonKey) return response;

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (list) => {
        for (const { name, value } of list) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        response.headers.set("X-Robots-Tag", "noindex, nofollow");
        for (const { name, value, options } of list) response.cookies.set(name, value, options);
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user && !isLogin) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/admin/login";
    loginUrl.search = "";
    loginUrl.searchParams.set("next", pathname);
    const redirect = NextResponse.redirect(loginUrl);
    redirect.headers.set("X-Robots-Tag", "noindex, nofollow");
    return redirect;
  }

  return response;
}

export const config = {
  // Admin pages only. API routes and server actions check the session themselves.
  matcher: ["/admin/:path*"],
};
