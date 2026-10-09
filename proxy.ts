import { getIronSession, nextProxyCookies } from "iron-session";
import { NextResponse, type NextRequest } from "next/server";
import type { AuthSession } from "@/lib/session";
import { sessionOptions } from "@/lib/session-options";

const PUBLIC_PREFIXES = ["/login", "/setup", "/api/auth", "/api/setup", "/api/bot"];

function isPublic(pathname: string): boolean {
  if (pathname.startsWith("/_next") || pathname === "/favicon.ico" || pathname === "/icon.svg") {
    return true;
  }
  return PUBLIC_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (isPublic(pathname)) {
    return NextResponse.next();
  }

  const response = NextResponse.next();
  let authenticated = false;
  try {
    const session = await getIronSession<AuthSession>(
      nextProxyCookies(request, response),
      sessionOptions("session"),
    );
    authenticated = Boolean(session.authenticated && session.username);
  } catch {
    authenticated = false;
  }

  if (authenticated) {
    response.headers.set("Cache-Control", "no-store");
    return response;
  }

  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401, headers: { "cache-control": "no-store" } });
  }

  const login = new URL("/login", request.url);
  return NextResponse.redirect(login);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.svg).*)"],
};
