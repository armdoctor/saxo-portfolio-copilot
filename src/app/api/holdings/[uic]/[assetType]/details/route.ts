import { auth } from "@/auth";
import { rateLimit } from "@/lib/rate-limit";
import { fetchInstrumentDetails } from "@/lib/saxo/client";
import { resolveYahooSymbol } from "@/lib/yahoo/symbol-resolver";
import { fetchYahooFundamentals } from "@/lib/yahoo/client";
import { NextResponse } from "next/server";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ uic: string; assetType: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rl = rateLimit(`holdings:${session.user.id}`, { limit: 30, windowMs: 60_000 });
  if (!rl.success) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const { uic, assetType } = await params;

  try {
    const data = await fetchInstrumentDetails(
      session.user.id,
      parseInt(uic, 10),
      assetType
    );

    // If Saxo didn't return fundamentals, merge from Yahoo
    const details = data as Record<string, unknown>;
    if (!details.FundamentalData) {
      try {
        const yahooSymbol = await resolveYahooSymbol(session.user.id, parseInt(uic, 10), assetType);
        if (yahooSymbol) {
          const yahooFundamentals = await fetchYahooFundamentals(yahooSymbol);
          return NextResponse.json({ ...details, ...yahooFundamentals });
        }
      } catch (yahooErr) {
        console.error("[Yahoo fundamentals fallback]", yahooErr);
      }
    }

    return NextResponse.json(data);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Details fetch failed";
    if (message.includes("401") || message.includes("expired")) {
      return NextResponse.json({ error: "Session expired" }, { status: 401 });
    }
    if (message.includes("rate limit")) {
      return NextResponse.json({ error: "Rate limited" }, { status: 429 });
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
