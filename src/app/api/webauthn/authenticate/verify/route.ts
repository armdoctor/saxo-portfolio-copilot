import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getWebAuthnConfig } from "@/lib/webauthn/config";
import { verifyAuthenticationResponse } from "@simplewebauthn/server";
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

  // Find the credential being used
  const credential = await prisma.webAuthnCredential.findUnique({
    where: { credentialId: body.id },
  });
  if (!credential || credential.userId !== userId) {
    return NextResponse.json({ error: "Credential not found" }, { status: 400 });
  }

  let verification;
  try {
    verification = await verifyAuthenticationResponse({
      response: body,
      expectedChallenge: pending.challenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
      credential: {
        id: credential.credentialId,
        publicKey: credential.publicKey,
        counter: Number(credential.counter),
        transports: credential.transports as never,
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Verification failed";
    return NextResponse.json({ error: msg }, { status: 400 });
  }

  if (!verification.verified) {
    return NextResponse.json({ error: "Verification failed" }, { status: 400 });
  }

  // Update counter and clear challenge
  await prisma.$transaction([
    prisma.webAuthnCredential.update({
      where: { credentialId: credential.credentialId },
      data: { counter: verification.authenticationInfo.newCounter },
    }),
    prisma.webAuthnChallenge.delete({ where: { userId } }),
  ]);

  return NextResponse.json({ verified: true });
}
