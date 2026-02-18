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

// ── Company profiles (industry) ────────────────────────────────────────────

export interface CompanyProfile {
  industry: string;
}

const profileCache = new Map<string, { profile: CompanyProfile; fetchedAt: number }>();
const PROFILE_CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

export async function fetchCompanyProfile(symbol: string): Promise<CompanyProfile> {
  const key = symbol.toUpperCase();
  const cached = profileCache.get(key);
  const now = Date.now();

  if (cached && now - cached.fetchedAt < PROFILE_CACHE_TTL_MS) {
    return cached.profile;
  }

  const apiKey = process.env.FINNHUB_API_KEY;
  if (!apiKey) return { industry: "Other" };

  try {
    const res = await fetch(
      `https://finnhub.io/api/v1/stock/profile2?symbol=${encodeURIComponent(key)}&token=${apiKey}`
    );
    if (!res.ok) throw new Error(`Finnhub profile ${res.status}`);
    const data = await res.json();
    const profile: CompanyProfile = {
      industry: data.finnhubIndustry || "Other",
    };
    profileCache.set(key, { profile, fetchedAt: now });
    return profile;
  } catch (err) {
    console.error(`[Finnhub] Failed to fetch profile for ${key}:`, err);
    return { industry: "Other" };
  }
}

// ── Topic classification ───────────────────────────────────────────────────

const TOPIC_PATTERNS: [string, RegExp][] = [
  ["Earnings", /earnings|eps|revenue|quarterly|profit|loss|guidance|beat|miss|forecast|outlook/i],
  ["Deals", /acqui|merger|takeover|deal|buyout|purchase|bid|joint.venture|partnership/i],
  ["Products", /launch|release|unveil|announc|new product|introduce|debut|rollout/i],
  ["Regulation", /sec|ftc|doj|regulat|fine|lawsuit|settlement|investig|probe|sanction|compliance/i],
  ["Leadership", /\bceo\b|\bcfo\b|\bcoo\b|appoint|resign|hire|executive|board|director/i],
  ["Analyst", /upgrade|downgrade|price target|analyst|rating|\bbuy\b|\bsell\b|\bhold\b|overweight|underweight/i],
];

export function classifyTopic(headline: string, summary: string): string {
  const text = headline + " " + (summary ?? "");
  for (const [topic, pattern] of TOPIC_PATTERNS) {
    if (pattern.test(text)) return topic;
  }
  return "Markets";
}
