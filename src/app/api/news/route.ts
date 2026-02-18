import { auth } from "@/auth";
import { isFinnhubConfigured } from "@/lib/config";
import {
  classifyTopic,
  cleanSymbolForFinnhub,
  fetchCompanyNews,
  fetchCompanyProfile,
} from "@/lib/news/finnhub";
import { prisma } from "@/lib/prisma";
import { rateLimit } from "@/lib/rate-limit";
import { NextResponse } from "next/server";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rl = rateLimit(`news:${session.user.id}`, {
    limit: 15,
    windowMs: 60_000,
  });
  if (!rl.success) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  if (!isFinnhubConfigured()) {
    return NextResponse.json({ articles: [] });
  }

  try {
    const snapshot = await prisma.portfolioSnapshot.findFirst({
      where: { userId: session.user.id },
      orderBy: { snapshotAt: "desc" },
      include: {
        holdings: {
          orderBy: { marketValue: "desc" },
          take: 10,
        },
      },
    });

    if (!snapshot || snapshot.holdings.length === 0) {
      return NextResponse.json({ articles: [] });
    }

    // Build symbol → holding name map, dedupe, cap at 8
    const symbolMap = new Map<string, string>();
    for (const h of snapshot.holdings) {
      const clean = cleanSymbolForFinnhub(h.symbol);
      if (!symbolMap.has(clean)) {
        symbolMap.set(clean, h.name);
      }
    }
    const entries = [...symbolMap.entries()].slice(0, 8);
    const symbols = entries.map(([s]) => s);

    // Fetch news + profiles in parallel
    const [newsResults, profileResults] = await Promise.all([
      Promise.allSettled(symbols.map((s) => fetchCompanyNews(s))),
      Promise.allSettled(symbols.map((s) => fetchCompanyProfile(s))),
    ]);

    const articles = entries.flatMap(([symbol, holdingName], i) => {
      const newsResult = newsResults[i];
      const profileResult = profileResults[i];

      if (newsResult.status !== "fulfilled" || newsResult.value.length === 0) {
        return [];
      }

      const industry =
        profileResult.status === "fulfilled"
          ? profileResult.value.industry
          : "Other";

      return newsResult.value
        .sort((a, b) => b.datetime - a.datetime)
        .slice(0, 5)
        .map((a) => ({
          id: a.id,
          datetime: a.datetime,
          headline: a.headline,
          source: a.source,
          summary: a.summary,
          url: a.url,
          symbol,
          companyName: holdingName,
          topic: classifyTopic(a.headline, a.summary),
          industry,
        }));
    });

    // Sort all articles by recency
    articles.sort((a, b) => b.datetime - a.datetime);

    return NextResponse.json({ articles });
  } catch (error) {
    console.error("[News] Failed to fetch news:", error);
    return NextResponse.json(
      { error: "Failed to fetch news" },
      { status: 500 }
    );
  }
}
