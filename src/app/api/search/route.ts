import { auth } from "@/auth";
import { searchInstruments } from "@/lib/saxo/client";
import { rateLimit } from "@/lib/rate-limit";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const q = req.nextUrl.searchParams.get("q")?.trim();
  if (!q || q.length < 1) {
    return NextResponse.json({ results: [] });
  }

  const rl = rateLimit(`search:${session.user.id}`, {
    limit: 30,
    windowMs: 60_000,
  });
  if (!rl.success) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  try {
    const data = await searchInstruments(session.user.id, q, 25);
    const results = (data.Data ?? []).map((r) => ({
      uic: r.Identifier,
      symbol: r.Symbol,
      name: r.Description,
      assetType: r.AssetType,
      currency: r.CurrencyCode,
      exchange: r.ExchangeId,
    }));
    return NextResponse.json({ results });
  } catch (error) {
    console.error("[Search] Failed:", error);
    return NextResponse.json(
      { error: "Search failed" },
      { status: 500 }
    );
  }
}
