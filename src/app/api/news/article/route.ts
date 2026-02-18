import { auth } from "@/auth";
import { rateLimit } from "@/lib/rate-limit";
import { extract } from "@extractus/article-extractor";
import { NextRequest, NextResponse } from "next/server";

interface CacheEntry {
  data: { title: string | null; content: string | null; author: string | null; published: string | null; source: string | null };
  fetchedAt: number;
}

const CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes
const cache = new Map<string, CacheEntry>();

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rl = rateLimit(`article:${session.user.id}`, {
    limit: 10,
    windowMs: 60_000,
  });
  if (!rl.success) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const url = request.nextUrl.searchParams.get("url");
  if (!url) {
    return NextResponse.json({ error: "Missing url parameter" }, { status: 400 });
  }

  try {
    new URL(url);
  } catch {
    return NextResponse.json({ error: "Invalid URL" }, { status: 400 });
  }

  if (!url.startsWith("https://")) {
    return NextResponse.json({ error: "Only HTTPS URLs are allowed" }, { status: 400 });
  }

  // Check cache
  const cached = cache.get(url);
  const now = Date.now();
  if (cached && now - cached.fetchedAt < CACHE_TTL_MS) {
    return NextResponse.json(cached.data);
  }

  try {
    const article = await extract(url);
    if (!article) {
      return NextResponse.json(
        { error: "Could not extract article content" },
        { status: 502 }
      );
    }

    const data = {
      title: article.title ?? null,
      content: article.content ?? null,
      author: article.author ?? null,
      published: article.published ?? null,
      source: article.source ?? null,
    };

    cache.set(url, { data, fetchedAt: now });

    // Periodic cache cleanup
    if (cache.size > 200) {
      for (const [k, v] of cache) {
        if (now - v.fetchedAt > CACHE_TTL_MS) cache.delete(k);
      }
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error("[Article] Extraction failed:", error);
    return NextResponse.json(
      { error: "Failed to extract article" },
      { status: 502 }
    );
  }
}
