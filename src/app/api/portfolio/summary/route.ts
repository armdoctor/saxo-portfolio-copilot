import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { rateLimit } from "@/lib/rate-limit";
import { isOpenAIConfigured } from "@/lib/config";
import { fetchPositions } from "@/lib/saxo/client";
import { cleanSymbolForFinnhub, fetchCompanyNews } from "@/lib/news/finnhub";
import { openai } from "@ai-sdk/openai";
import { generateText } from "ai";
import { NextRequest, NextResponse } from "next/server";

// In-memory cache per user
const cache = new Map<string, { text: string; generatedAt: number }>();
const CACHE_TTL_MS = 30 * 60 * 1000; // 30 min

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user.id;
  const forceRefresh = req.nextUrl.searchParams.get("refresh") === "1";

  if (!isOpenAIConfigured()) {
    return NextResponse.json({ error: "OpenAI not configured" }, { status: 503 });
  }

  // Serve from cache unless forced refresh
  const cached = cache.get(userId);
  if (!forceRefresh && cached && Date.now() - cached.generatedAt < CACHE_TTL_MS) {
    try {
      const parsed = JSON.parse(cached.text);
      return NextResponse.json({ ...parsed, cached: true });
    } catch {
      // stale/malformed cache entry — fall through to regenerate
    }
  }

  const rl = rateLimit(`summary:${userId}`, { limit: 5, windowMs: 60_000 });
  if (!rl.success) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  // Fetch latest portfolio snapshot
  const snapshot = await prisma.portfolioSnapshot.findFirst({
    where: { userId },
    orderBy: { snapshotAt: "desc" },
    include: { holdings: { orderBy: { marketValue: "desc" } } },
  });

  if (!snapshot || snapshot.holdings.length === 0) {
    return NextResponse.json({ error: "No portfolio data" }, { status: 404 });
  }

  // Try to get live day changes from Saxo positions
  const dayChanges = new Map<string, number>(); // symbol → day change %
  let portfolioDayChangePct: number | null = null;

  try {
    const connection = await prisma.saxoConnection.findUnique({
      where: { userId },
      include: { accounts: true },
    });

    if (connection?.clientKey) {
      const positions = await fetchPositions(userId, connection.clientKey);
      let weightedSum = 0;
      let totalValue = 0;

      for (const pos of positions.Data) {
        const symbol = pos.DisplayAndFormat?.Symbol;
        const dayChange = pos.PositionView.InstrumentPriceDayPercentChange;
        const mktVal = pos.PositionView.MarketValueInBaseCurrency;

        if (symbol && dayChange !== undefined) {
          // Keep the entry with the largest absolute change if duplicates
          if (!dayChanges.has(symbol) || Math.abs(dayChange) > Math.abs(dayChanges.get(symbol)!)) {
            dayChanges.set(symbol, dayChange);
          }
        }
        if (mktVal && dayChange !== undefined) {
          weightedSum += dayChange * mktVal;
          totalValue += mktVal;
        }
      }

      if (totalValue > 0) portfolioDayChangePct = weightedSum / totalValue;
    }
  } catch (err) {
    console.warn("[Summary] Could not fetch live positions for day changes:", err);
  }

  // Identify top movers for news context
  const holdingsWithChanges = snapshot.holdings.slice(0, 10).map((h) => ({
    symbol: h.symbol,
    cleanSymbol: cleanSymbolForFinnhub(h.symbol),
    name: h.name,
    weight: h.weight,
    unrealizedPnl: h.unrealizedPnl ?? 0,
    dayChange: dayChanges.get(h.symbol) ?? dayChanges.get(cleanSymbolForFinnhub(h.symbol)),
  }));

  const newsSymbols = [...holdingsWithChanges]
    .sort((a, b) =>
      a.dayChange !== undefined && b.dayChange !== undefined
        ? Math.abs(b.dayChange) - Math.abs(a.dayChange)
        : b.weight - a.weight
    )
    .slice(0, 5)
    .map((h) => h.cleanSymbol);

  const newsResults = await Promise.allSettled(newsSymbols.map((s) => fetchCompanyNews(s)));

  const newsContext = newsSymbols
    .map((sym, i) => {
      const r = newsResults[i];
      if (r.status !== "fulfilled" || r.value.length === 0) return null;
      const headlines = r.value
        .sort((a, b) => b.datetime - a.datetime)
        .slice(0, 2)
        .map((a) => `    - ${a.headline}`)
        .join("\n");
      return `  ${sym}:\n${headlines}`;
    })
    .filter(Boolean)
    .join("\n");

  // Build context string for the prompt
  const holdingsText = holdingsWithChanges
    .map((h) => {
      const change =
        h.dayChange !== undefined
          ? ` | today: ${h.dayChange >= 0 ? "+" : ""}${h.dayChange.toFixed(2)}%`
          : "";
      return `  ${h.symbol} (${h.name}) | weight: ${h.weight.toFixed(1)}%${change} | total P&L: ${h.unrealizedPnl >= 0 ? "+" : ""}${h.unrealizedPnl.toFixed(0)} ${snapshot.currency}`;
    })
    .join("\n");

  const portfolioDayLine =
    portfolioDayChangePct !== null
      ? `Portfolio estimated day change: ${portfolioDayChangePct >= 0 ? "+" : ""}${portfolioDayChangePct.toFixed(2)}%`
      : "Portfolio day change: unavailable";

  const context = `
Date: ${new Date().toDateString()}
Snapshot taken: ${snapshot.snapshotAt.toISOString()}
Total portfolio value: ${snapshot.totalValue.toFixed(0)} ${snapshot.currency}
${portfolioDayLine}

Holdings (top 10 by value):
${holdingsText}

Recent news for key holdings:
${newsContext || "No recent news available"}`.trim();

  const prompt = `You are a portfolio analyst. Respond with ONLY a valid JSON object — no markdown, no extra text.

The JSON must have exactly two fields:
- "headline": one punchy sentence (max 20 words) stating the portfolio direction and the single biggest driver today
- "detail": 2–4 sentences adding specifics — which other names are moving, why (using the news), concrete percentages

Rules for both fields:
- Focus on TODAY's day-change figures, not total P&L
- Holdings trade on different exchanges across timezones (e.g. SGX, NYSE, LSE). Zero day-change for a holding means that market is currently closed, not that all markets are closed — focus your commentary on holdings that do have non-zero day changes
- Only mention a market being closed if it is directly relevant (e.g. "US markets are closed, but SGX positions are up X%")
- If day-change data is entirely unavailable, say data is limited rather than inferring the market is closed
- Use actual numbers from the data; no vague language
- Flowing prose, no bullets

${context}`;

  try {
    const { text } = await generateText({
      model: openai("gpt-4o-mini"),
      messages: [{ role: "user", content: prompt }],
      maxOutputTokens: 350,
    });

    let headline = "";
    let detail = "";
    try {
      const parsed = JSON.parse(text.trim());
      headline = parsed.headline ?? "";
      detail = parsed.detail ?? "";
    } catch {
      // Fallback: treat whole response as headline if JSON parsing fails
      headline = text.trim().slice(0, 200);
    }

    cache.set(userId, { text: JSON.stringify({ headline, detail }), generatedAt: Date.now() });
    return NextResponse.json({ headline, detail });
  } catch (err) {
    console.error("[Summary] OpenAI error:", err);
    return NextResponse.json({ error: "Failed to generate summary" }, { status: 500 });
  }
}
