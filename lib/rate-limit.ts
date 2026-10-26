/**
 * Простейший in-memory rate limiter.
 * Достаточен для одного инстанса; при горизонтальном масштабировании
 * заменить на Redis/Upstash с тем же интерфейсом.
 */

interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();
const MAX_BUCKETS = 10_000;

function sweep(now: number) {
  if (buckets.size <= MAX_BUCKETS) return;
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key);
  }
}

export function hitRateLimit(
  key: string,
  maxAttempts = 10,
  windowMs = 15 * 60 * 1000
): { allowed: boolean; retryAfter: number } {
  const now = Date.now();
  sweep(now);

  const existing = buckets.get(key);

  if (!existing || existing.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, retryAfter: 0 };
  }

  existing.count += 1;

  if (existing.count > maxAttempts) {
    return { allowed: false, retryAfter: Math.ceil((existing.resetAt - now) / 1000) };
  }

  return { allowed: true, retryAfter: 0 };
}

export function resetRateLimit(key: string) {
  buckets.delete(key);
}
