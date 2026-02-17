import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { prisma } from "@/lib/prisma";
import { authConfig } from "./auth.config";

export const { handlers, signIn, signOut, auth } = NextAuth({
  ...authConfig,
  providers: [Google],
  callbacks: {
    ...authConfig.callbacks,
    async signIn({ user }) {
      if (!user.email) return false;
      try {
        await prisma.user.upsert({
          where: { email: user.email },
          update: {},
          create: { email: user.email },
        });
      } catch (err) {
        console.error("[Auth] signIn upsert failed:", err);
        return false;
      }
      return true;
    },
    async jwt({ token }) {
      if (token.email && !token.id) {
        try {
          const dbUser = await prisma.user.findUnique({
            where: { email: token.email },
          });
          if (dbUser) token.id = dbUser.id;
        } catch (err) {
          console.error("[Auth] jwt lookup failed:", err);
        }
      }
      return token;
    },
  },
});
