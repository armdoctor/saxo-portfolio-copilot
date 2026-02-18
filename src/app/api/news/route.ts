import { auth } from "@/auth";
import { isFinnhubConfigured } from "@/lib/config";
import {
  cleanSymbolForFinnhub,
  fetchCompanyNews,
  FinnhubArticle,
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

    // Dedupe and clean symbols, cap at 8
    const symbols = [
      ...new Set(
        snapshot.holdings.map((h) => cleanSymbolForFinnhub(h.symbol))
      ),
    ].slice(0, 8);

    const results = await Promise.allSettled(
      symbols.map((s) => fetchCompanyNews(s))
    );

    const seen = new Set<number>();
    const articles: FinnhubArticle[] = [];

    for (const result of results) {
      if (result.status !== "fulfilled") continue;
      for (const article of result.value) {
        if (!seen.has(article.id)) {
          seen.add(article.id);
          articles.push(article);
        }
      }
    }

    // Sort by datetime descending, return top 20
    articles.sort((a, b) => b.datetime - a.datetime);

    return NextResponse.json({ articles: articles.slice(0, 20) });
  } catch (error) {
    console.error("[News] Failed to fetch news:", error);
    return NextResponse.json(
      { error: "Failed to fetch news" },
      { status: 500 }
    );
  }
}
