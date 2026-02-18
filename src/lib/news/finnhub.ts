export interface FinnhubArticle {
  id: number;
  category: string;
  datetime: number;
  headline: string;
  image: string;
  related: string;
  source: string;
  summary: string;
  url: string;
}

interface CacheEntry {
  articles: FinnhubArticle[];
  fetchedAt: number;
}

const CACHE_TTL_MS = 20 * 60 * 1000; // 20 minutes
const cache = new Map<string, CacheEntry>();

/**
 * Strip exchange suffix from Saxo-style symbols for Finnhub lookup.
 * "CSPX:xlon" → "CSPX", "AAPL" → "AAPL"
 */
export function cleanSymbolForFinnhub(saxoSymbol: string): string {
  return saxoSymbol.split(":")[0];
}

export async function fetchCompanyNews(
  symbol: string
): Promise<FinnhubArticle[]> {
  const key = symbol.toUpperCase();
  const cached = cache.get(key);
  const now = Date.now();

  if (cached && now - cached.fetchedAt < CACHE_TTL_MS) {
    return cached.articles;
  }

  const apiKey = process.env.FINNHUB_API_KEY;
  if (!apiKey) return [];

  const to = new Date();
  const from = new Date(now - 30 * 24 * 60 * 60 * 1000);
  const fmt = (d: Date) => d.toISOString().slice(0, 10);

  const url = `https://finnhub.io/api/v1/company-news?symbol=${encodeURIComponent(key)}&from=${fmt(from)}&to=${fmt(to)}&token=${apiKey}`;

  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Finnhub ${res.status}`);
    const articles: FinnhubArticle[] = await res.json();
    cache.set(key, { articles, fetchedAt: now });
    return articles;
  } catch (err) {
    console.error(`[Finnhub] Failed to fetch news for ${key}:`, err);
    // Return stale cache if available
    if (cached) return cached.articles;
    return [];
  }
}
