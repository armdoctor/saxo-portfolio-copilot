import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { exchangeCodeForTokens, storeTokens } from "@/lib/saxo/oauth";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const code = request.nextUrl.searchParams.get("code");
  const error = request.nextUrl.searchParams.get("error");

  if (error || !code) {
    const errorMsg = error || "missing_code";
    return NextResponse.redirect(
      new URL(`/settings/saxo?error=${errorMsg}`, request.url)
    );
  }

  try {
    // Retrieve stored code_verifier
    const connection = await prisma.saxoConnection.findUnique({
      where: { userId: session.user.id },
      include: { token: true },
    });

    if (!connection?.token?.codeVerifier) {
      return NextResponse.redirect(
        new URL("/settings/saxo?error=missing_verifier", request.url)
      );
    }

    const codeVerifier = connection.token.codeVerifier;

    // Exchange authorization code for tokens
    const tokens = await exchangeCodeForTokens(code, codeVerifier);

    // Encrypt and store tokens
    await storeTokens(connection.id, tokens, codeVerifier);

    console.log(
      `[Saxo OAuth] Successfully connected for user ${session.user.id}`
    );

    return NextResponse.redirect(
      new URL("/settings/saxo?success=connected", request.url)
    );
  } catch (err) {
    console.error("[Saxo OAuth] Callback error:", err);
    return NextResponse.redirect(
      new URL("/settings/saxo?error=token_exchange_failed", request.url)
    );
  }
}
