import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function DELETE() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await prisma.webAuthnCredential.deleteMany({
    where: { userId: session.user.id },
  });

  return NextResponse.json({ ok: true });
}
