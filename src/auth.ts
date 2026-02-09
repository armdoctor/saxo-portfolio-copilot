import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { prisma } from "@/lib/prisma";
import { validateEnv } from "@/lib/config";
import { authConfig } from "./auth.config";

validateEnv();

export const { handlers, signIn, signOut, auth } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const email = credentials?.email as string;
        const password = credentials?.password as string;

        if (
          email === process.env.APP_USER_EMAIL &&
          password === process.env.APP_USER_PASSWORD
        ) {
          // Auto-seed user in DB on first login
          let dbUser = await prisma.user.findUnique({ where: { email } });
          if (!dbUser) {
            dbUser = await prisma.user.create({ data: { email } });
          }
          return { id: dbUser.id, email: dbUser.email, name: "Admin" };
        }
        return null;
      },
    }),
  ],
});
