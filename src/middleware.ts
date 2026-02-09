export { auth as middleware } from "@/auth";

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/settings/:path*",
    "/chat/:path*",
    "/api/saxo/:path*",
    "/api/refresh/:path*",
    "/api/chat/:path*",
  ],
};
