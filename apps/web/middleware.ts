import { auth } from "./auth";
import type { NextRequest } from "next/server";

export default function middleware(req: NextRequest) {
  return (auth as any)(req, (authReq: any) => {
    const { nextUrl } = authReq;
    const isLoggedIn = !!authReq.auth;
    const role = authReq.auth?.user?.role;
    
    const isApiAuthRoute = nextUrl.pathname.startsWith("/api/auth");
    const isAdminRoute = nextUrl.pathname.startsWith("/admin");
    const isParentRoute = nextUrl.pathname.startsWith("/parent");

    if (isApiAuthRoute) return;

    if (isAdminRoute && nextUrl.pathname !== "/admin/login") {
      if (!isLoggedIn || role !== "admin") {
        return Response.redirect(new URL("/admin/login", nextUrl));
      }
    }

    if (isParentRoute && nextUrl.pathname !== "/parent/login") {
      if (!isLoggedIn || role !== "parent") {
        return Response.redirect(new URL("/parent/login", nextUrl));
      }
    }
  });
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
