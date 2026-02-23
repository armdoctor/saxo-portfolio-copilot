import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getWebAuthnConfig } from "@/lib/webauthn/config";
import { verifyRegistrationResponse } from "@simplewebauthn/server";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user.id;
  const { rpID, origin } = getWebAuthnConfig();

  const pending = await prisma.webAuthnChallenge.findUnique({ where: { userId } });
  if (!pending || pending.expiresAt < new Date()) {
    return NextResponse.json({ error: "Challenge expired — please try again" }, { status: 400 });
  }

  const body = await req.json();

  let verification;
  try {
    verification = await verifyRegistrationResponse({
      response: body,
      expectedChallenge: pending.challenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Verification failed";
    return NextResponse.json({ error: msg }, { status: 400 });
  }

  if (!verification.verified || !verification.registrationInfo) {
    return NextResponse.json({ error: "Verification failed" }, { status: 400 });
  }

  const { credential } = verification.registrationInfo;

  await prisma.$transaction([
    prisma.webAuthnCredential.create({
      data: {
        userId,
        credentialId: credential.id,
        publicKey: Buffer.from(credential.publicKey),
        counter: credential.counter,
        transports: (credential.transports ?? []) as string[],
      },
    }),
    prisma.webAuthnChallenge.delete({ where: { userId } }),
  ]);

  return NextResponse.json({ verified: true });
}
