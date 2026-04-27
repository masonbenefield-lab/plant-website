const store = new Map<string, { count: number; resetAt: number }>();

/**
 * In-memory rate limiter. Returns false if the key has exceeded `limit` requests
 * in the past `windowMs` milliseconds, true if the request is allowed.
 *
 * Note: resets per serverless instance. Sufficient for basic abuse prevention;
 * use Upstash/Redis for hard per-user limits across all instances.
 */
export function checkRateLimit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const entry = store.get(key);

  if (!entry || now > entry.resetAt) {
    store.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }

  if (entry.count >= limit) return false;

  entry.count++;
  return true;
}
