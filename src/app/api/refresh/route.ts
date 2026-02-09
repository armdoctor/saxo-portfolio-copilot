import { auth } from "@/auth";
import { buildSnapshot } from "@/lib/portfolio/snapshot";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function POST() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await buildSnapshot(session.user.id);
    return NextResponse.json(result);
  } catch (error) {
    console.error("[Refresh] Portfolio refresh failed:", error);

    const message =
      error instanceof Error ? error.message : "Refresh failed";

    // If Saxo returned 401 or session expired, mark connection as stale
    if (
      message.includes("401") ||
      message.includes("expired") ||
      message.includes("reconnect")
    ) {
      try {
        const connection = await prisma.saxoConnection.findUnique({
          where: { userId: session.user.id },
          include: { token: true },
        });
        if (connection?.token) {
          await prisma.saxoToken.update({
            where: { id: connection.token.id },
            data: {
              accessTokenExpiresAt: new Date(0),
              refreshTokenExpiresAt: new Date(0),
            },
          });
        }
      } catch {
        // Best-effort — don't mask the original error
      }

      return NextResponse.json(
        {
          error:
            "Your Saxo session has expired. Please reconnect your account in Settings.",
          reconnect: true,
        },
        { status: 401 }
      );
    }

    if (message.includes("rate limit")) {
      return NextResponse.json(
        { error: "Saxo API rate limited. Please wait a moment and try again." },
        { status: 429 }
      );
    }

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
