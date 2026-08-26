import { auth } from "@/auth";
import { NextResponse } from "next/server";

export default auth((req) => {
  const { pathname } = req.nextUrl;

  // Allow test bypass when running in E2E test mode
  if (process.env.PLAYWRIGHT_TEST === '1') {
    return NextResponse.next();
  }

  // Public routes that don't require authentication
  const isPublicRoute =
    pathname.startsWith("/sign-in") ||
    pathname.startsWith("/api/auth");

  if (!req.auth && !isPublicRoute) {
    return NextResponse.redirect(new URL("/sign-in", req.url));
  }

  // Redirect authenticated users away from sign-in
  if (req.auth && pathname.startsWith("/sign-in")) {
    return NextResponse.redirect(new URL("/", req.url));
  }

  return NextResponse.next();
});

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
