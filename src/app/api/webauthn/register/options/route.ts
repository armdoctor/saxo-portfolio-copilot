import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getWebAuthnConfig } from "@/lib/webauthn/config";
import { generateRegistrationOptions } from "@simplewebauthn/server";
import { NextResponse } from "next/server";

export async function POST() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { rpID, rpName } = getWebAuthnConfig();
  const userId = session.user.id;
  const userEmail = session.user.email ?? userId;

  // Exclude credentials already registered on this device
  const existingCredentials = await prisma.webAuthnCredential.findMany({
    where: { userId },
    select: { credentialId: true, transports: true },
  });

  const options = await generateRegistrationOptions({
    rpName,
    rpID,
    userName: userEmail,
    userID: Buffer.from(userId),
    attestationType: "none",
    excludeCredentials: existingCredentials.map((c) => ({
      id: c.credentialId,
      transports: c.transports as never,
    })),
    authenticatorSelection: {
      authenticatorAttachment: "platform", // built-in biometrics only
      userVerification: "required",
      residentKey: "preferred",
    },
  });

  // Store challenge (5-minute TTL)
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
