const hits = new Map<string, number[]>();

interface RateLimitOptions {
  limit?: number;
  windowMs?: number;
}

interface RateLimitResult {
  success: boolean;
  remaining: number;
}

export function rateLimit(
  key: string,
  { limit = 20, windowMs = 60_000 }: RateLimitOptions = {}
): RateLimitResult {
  const now = Date.now();
  const cutoff = now - windowMs;

  const timestamps = hits.get(key) ?? [];
  // Remove expired entries
  const valid = timestamps.filter((t) => t > cutoff);

  if (valid.length >= limit) {
    hits.set(key, valid);
    return { success: false, remaining: 0 };
  }

  valid.push(now);
  hits.set(key, valid);

  // Periodic cleanup: prune keys with no recent hits
  if (hits.size > 1000) {
    for (const [k, v] of hits) {
      const fresh = v.filter((t) => t > cutoff);
      if (fresh.length === 0) hits.delete(k);
      else hits.set(k, fresh);
    }
  }

  return { success: true, remaining: limit - valid.length };
}
