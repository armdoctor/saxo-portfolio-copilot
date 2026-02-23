import { auth } from "@/auth";
import { rateLimit } from "@/lib/rate-limit";
import { fetchChartData, type ChartRange } from "@/lib/saxo/client";
import { resolveYahooSymbol } from "@/lib/yahoo/symbol-resolver";
import { fetchYahooChart } from "@/lib/yahoo/client";
import { NextRequest, NextResponse } from "next/server";

const VALID_RANGES = new Set(["1D", "1W", "1M", "6M", "1Y", "5Y"]);

export async function GET(
  request: NextRequest,
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
  const range = request.nextUrl.searchParams.get("range") || "1M";

  if (!VALID_RANGES.has(range)) {
    return NextResponse.json({ error: "Invalid range" }, { status: 400 });
  }

  const uicNum = parseInt(uic, 10);
  const chartRange = range as ChartRange;

  // Try Yahoo Finance first
  try {
    const yahooSymbol = await resolveYahooSymbol(session.user.id, uicNum, assetType);
    if (yahooSymbol) {
      const yahooData = await fetchYahooChart(yahooSymbol, chartRange);
      return NextResponse.json(yahooData);
    }
  } catch (yahooErr) {
    console.error("[Yahoo chart primary]", yahooErr);
  }

  // Fall back to Saxo
  try {
    const data = await fetchChartData(session.user.id, uicNum, assetType, chartRange);
    return NextResponse.json(data);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Chart fetch failed";

    if (message.includes("401") || message.includes("expired")) {
      return NextResponse.json({ error: "Session expired" }, { status: 401 });
    }
    if (message.includes("rate limit")) {
      return NextResponse.json({ error: "Rate limited" }, { status: 429 });
    }

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
