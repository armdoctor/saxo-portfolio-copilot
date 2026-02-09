import { auth } from "@/auth";
import { generateCodeVerifier } from "@/lib/saxo/pkce";
import { buildAuthorizationUrl } from "@/lib/saxo/oauth";
import { prisma } from "@/lib/prisma";
import { randomBytes } from "crypto";
import { NextResponse } from "next/server";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const codeVerifier = generateCodeVerifier();
  const state = randomBytes(16).toString("hex");

  // Ensure SaxoConnection exists
  const connection = await prisma.saxoConnection.upsert({
    where: { userId: session.user.id },
    create: { userId: session.user.id },
    update: {},
  });

  // Store verifier temporarily in token record (will be filled properly on callback)
  await prisma.saxoToken.upsert({
    where: { connectionId: connection.id },
    create: {
      connectionId: connection.id,
      accessTokenEncrypted: "",
      refreshTokenEncrypted: "",
      iv: "",
      authTag: "",
      refreshIv: "",
      refreshAuthTag: "",
      accessTokenExpiresAt: new Date(0),
      refreshTokenExpiresAt: new Date(0),
      codeVerifier,
    },
    update: { codeVerifier },
  });

  const url = buildAuthorizationUrl(codeVerifier, state);
  return NextResponse.redirect(url);
}
