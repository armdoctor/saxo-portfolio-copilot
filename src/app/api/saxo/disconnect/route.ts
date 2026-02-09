import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function DELETE() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Delete the connection (cascades to token and accounts)
    await prisma.saxoConnection.deleteMany({
      where: { userId: session.user.id },
    });

    console.log(
      `[Saxo] Disconnected account for user ${session.user.id}`
    );

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[Saxo] Disconnect error:", err);
    return NextResponse.json(
      { error: "Failed to disconnect" },
      { status: 500 }
    );
  }
}
