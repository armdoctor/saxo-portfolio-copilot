import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getWebAuthnConfig } from "@/lib/webauthn/config";
import { generateAuthenticationOptions } from "@simplewebauthn/server";
import { NextResponse } from "next/server";

export async function POST() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user.id;
  const { rpID } = getWebAuthnConfig();

  const credentials = await prisma.webAuthnCredential.findMany({
    where: { userId },
    select: { credentialId: true, transports: true },
  });

  if (credentials.length === 0) {
    return NextResponse.json({ error: "No credentials registered" }, { status: 400 });
  }

  const options = await generateAuthenticationOptions({
    rpID,
    userVerification: "required",
    allowCredentials: credentials.map((c) => ({
      id: c.credentialId,
      transports: c.transports as never,
    })),
  });

  await prisma.webAuthnChallenge.upsert({
    where: { userId },
    create: {
      userId,
      challenge: options.challenge,
      expiresAt: new Date(Date.now() + 5 * 60 * 1000),
    },
    update: {
      challenge: options.challenge,
      expiresAt: new Date(Date.now() + 5 * 60 * 1000),
    },
  });

  return NextResponse.json(options);
}
