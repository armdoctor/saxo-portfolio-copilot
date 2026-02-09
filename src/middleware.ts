import NextAuth from "next-auth";
import { authConfig } from "./auth.config";

const { auth } = NextAuth(authConfig);
export default auth;

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
